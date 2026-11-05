import { isDeepStrictEqual } from 'node:util';
import { planCandidate } from '../../lib/plan.mjs';
import { canonical, validateSnapshot, compare } from '../../lib/model.mjs';
import { buildPlan } from '../../../compose/lib/plan.mjs';
import { inspectLimits } from '../../../compose/lib/lifecycle.mjs';

export function reject(code) { throw Object.assign(new Error(`Caddy adapter rejected input: ${code}.`), { code }); }
const same = (a, b) => isDeepStrictEqual(canonical(a), canonical(b));
const deploymentKey = t => JSON.stringify([t.installationRef, t.projectRef, t.environmentRef, t.deploymentRef]);
const id = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function keys(v, required, optional = []) {
  return v && typeof v === 'object' && !Array.isArray(v) && required.every(k => Object.hasOwn(v, k)) &&
    Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}

export function verifyCandidate(value, snapshot) {
  try {
    const s = validateSnapshot(snapshot);
    const candidate = planCandidate(s, value?.target?.gatewayRef);
    if (!same(candidate, value)) reject('CANDIDATE');
    if (candidate.target.driver !== 'caddy') reject('DRIVER_UNSUPPORTED');
    // TLS requires a separately implemented certificate material contract.
    if (!same(candidate.desired.listenerPorts, [80])) reject('LISTENERS_UNSUPPORTED');
    return { candidate, input: s.input };
  } catch (e) {
    if (['DRIVER_UNSUPPORTED', 'LISTENERS_UNSUPPORTED'].includes(e.code)) throw e;
    reject('CANDIDATE');
  }
}

function ipv4(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(value)) reject('ENDPOINT_POLICY');
  const parts = value.split('.').map(Number);
  if (parts.some(n => n > 255)) reject('ENDPOINT_POLICY');
  return parts.reduce((n, p) => n * 256 + p, 0);
}
function privateIPv4(n) {
  // RFC 1918 only: 10/8, 172.16/12 and 192.168/16.
  return (n >= 167772160 && n <= 184549375) || (n >= 2886729728 && n <= 2887778303) || (n >= 3232235520 && n <= 3232301055);
}
function addressPolicy(a) {
  if (!keys(a, ['containerId', 'networkId', 'ipv4', 'subnet', 'running', 'imageRef']) || !id(a.containerId) || !id(a.networkId)) reject('RUNTIME_INPUT');
  if (a.running !== true || typeof a.subnet !== 'string') reject('ENDPOINT_POLICY');
  const match = /^([^/]+)\/([0-9]{1,2})$/.exec(a.subnet);
  if (!match) reject('ENDPOINT_POLICY');
  const prefix = Number(match[2]); const base = ipv4(match[1]); const address = ipv4(a.ipv4);
  if (prefix < 8 || prefix > 30 || String(prefix) !== match[2]) reject('ENDPOINT_POLICY');
  const size = 2 ** (32 - prefix); const end = base + size - 1;
  if (base % size || !privateIPv4(base) || !privateIPv4(end) || address <= base || address >= end) reject('ENDPOINT_POLICY');
  return { base, end };
}
function runtimeShape(runtime, candidate) {
  try { if (Buffer.byteLength(JSON.stringify(runtime)) > 32 * 1024 * 1024) reject('RUNTIME_INPUT'); }
  catch { reject('RUNTIME_INPUT'); }
  if (!keys(runtime, ['apiVersion', 'candidatePlanId', 'registryGeneration', 'target', 'engineRef', 'deployments']) ||
    runtime.apiVersion !== 'bsk.caddy.runtime/v0alpha1' || typeof runtime.engineRef !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,256}$/.test(runtime.engineRef) || !Array.isArray(runtime.deployments) || runtime.deployments.length > 1000) reject('RUNTIME_INPUT');
  const { installationRef, gatewayRef, hostRef } = candidate.target;
  if (!same(runtime.target, { installationRef, gatewayRef, hostRef }) || runtime.candidatePlanId !== candidate.planId ||
    runtime.registryGeneration !== candidate.registryGeneration) reject('RUNTIME_SCOPE');
}
function validateObjects(objects) {
  if (!Array.isArray(objects) || objects.length > 2200) reject('RUNTIME_INPUT');
  for (const o of objects) {
    const common = ['kind', 'id', 'name', 'labels'];
    const fields = o?.kind === 'container' ? [...common, 'limits', 'privileged', 'hostNetwork', 'networks', 'ports', 'mounts'] :
      o?.kind === 'network' ? [...common, 'internal', 'driver', 'attachments'] : common;
    if (!['container', 'network', 'volume'].includes(o?.kind) || !keys(o, fields, o.kind === 'container' ? ['secretMounts'] : []) ||
      (o.kind !== 'volume' && !id(o.id))) reject('RUNTIME_INPUT');
  }
}

/** Pure trusted-input boundary. The embedding application supplies admitted inventory
 * and observations collected together from the pinned host/engine. Never accept this
 * bundle from project declarations or interpret its fields as authentication.
 * @param {import('../../lib/ports.d.ts').IngressCandidate} value
 * @param {unknown} snapshot
 * @param {import('./ports.d.ts').TrustedComposeRuntime} runtime
 * @returns {import('./ports.d.ts').ResolvedRoute[]}
 */
export function resolveComposeUpstreams(value, snapshot, runtime) {
  const { candidate, input } = verifyCandidate(value, snapshot);
  runtimeShape(runtime, candidate);
  const packages = new Map();
  for (const d of runtime.deployments) {
    if (!keys(d, ['entry', 'objects', 'addresses']) || !keys(d.entry, ['request', 'plan', 'admission']) ||
      !Array.isArray(d.addresses) || d.addresses.length > 1000) reject('RUNTIME_INPUT');
    let plan;
    try { plan = buildPlan(d.entry.request); } catch { reject('ADMISSION'); }
    if (!same(plan, d.entry.plan) || !same(d.entry.admission, { requested: plan.requested, admitted: plan.usage,
      enforced: 'unknown', observed: null, storageEnforcement: 'unsupported' })) reject('ADMISSION');
    if (plan.target.installationRef !== candidate.target.installationRef || plan.target.hostRef !== candidate.target.hostRef) reject('OWNERSHIP');
    const key = deploymentKey(plan.target);
    if (packages.has(key)) reject('DEPLOYMENT_AMBIGUOUS');
    packages.set(key, { ...d, plan });
  }
  const prepared = new Map(); const usedPackages = new Set(); const allIds = new Set(); const subnets = new Map();
  const resolutions = [];
  for (const route of candidate.desired.routes) {
    const key = deploymentKey(route.upstream); const d = packages.get(key);
    if (!d) reject('DEPLOYMENT_MISSING'); usedPackages.add(key);
    const cacheKey = JSON.stringify([key, route.upstream.serviceRef]);
    if (!prepared.has(cacheKey)) {
      const p = d.plan; const w = p.workloads.find(w => w.role === 'http' && w.serviceRef === route.upstream.serviceRef);
      if (!w) reject('ROLE_UNSUPPORTED');
      const declaration = input.deployments.find(o => deploymentKey({ ...o.resource.metadata, deploymentRef: o.resource.metadata.name }) === key);
      if (!declaration || declaration.visibility !== 'public') reject('PRIVATE_EXPOSURE');
      if (w.image !== declaration.resource.spec.artifact) reject('ARTIFACT_MISMATCH');
      if (w.port !== route.upstream.port) reject('PORT_MISMATCH');
      validateObjects(d.objects);
      try { if (!inspectLimits(d.entry, d.objects).configurationMatches) reject('RUNTIME_POLICY'); }
      catch (e) { reject(e.code === 'OWNERSHIP' ? 'OWNERSHIP' : 'RUNTIME_POLICY'); }
      for (const o of d.objects) {
        if (allIds.has(o.id)) reject('OWNERSHIP'); allIds.add(o.id);
      }
      const network = d.objects.find(o => o.kind === 'network' && o.name === p.compose.networks.ingress.name);
      const containers = d.objects.filter(o => o.kind === 'container' && o.labels['dev.bsk.service'] === w.name);
      if (!network || containers.length !== w.resources.replicas) reject('INGRESS_ATTACHMENT');
      const endpoints = []; const seen = new Set();
      for (const a of d.addresses) {
        const range = addressPolicy(a);
        if (a.imageRef !== w.image) reject('ARTIFACT_MISMATCH');
        if (seen.has(a.containerId)) reject('ENDPOINT_AMBIGUOUS'); seen.add(a.containerId);
        const container = containers.find(o => o.id === a.containerId);
        if (!container || a.networkId !== network.id || !container.networks.includes(network.name) ||
          !network.attachments.includes(container.id) || container.labels['com.docker.compose.service'] !== w.name) reject('INGRESS_ATTACHMENT');
        const prior = subnets.get(network.id);
        if (prior && (prior.base !== range.base || prior.end !== range.end)) reject('ENDPOINT_POLICY');
        if ([...subnets.entries()].some(([id, r]) => id !== network.id && r.base <= range.end && range.base <= r.end)) reject('ENDPOINT_OVERLAP');
        subnets.set(network.id, range);
        if (endpoints.some(e => e.ipv4 === a.ipv4)) reject('ENDPOINT_AMBIGUOUS');
        endpoints.push({ containerId: container.id, networkId: network.id, networkName: network.name, ipv4: a.ipv4, port: w.port });
      }
      if (seen.size !== containers.length) reject('INGRESS_ATTACHMENT');
      endpoints.sort((a, b) => compare(a.ipv4, b.ipv4) || compare(a.containerId, b.containerId));
      prepared.set(cacheKey, endpoints);
    }
    resolutions.push({ bindingRef: structuredClone(route.bindingRef), endpoints: structuredClone(prepared.get(cacheKey)) });
  }
  if (usedPackages.size !== packages.size) reject('UNUSED_DEPLOYMENT');
  return resolutions;
}
