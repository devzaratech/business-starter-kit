import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateBundle } from '../../declarations/lib/validate.mjs';

const declarationSchema = JSON.parse(readFileSync(new URL('../../../contracts/schemas/bsk-declaration-v0alpha1.schema.json', import.meta.url)));
const schema = JSON.parse(readFileSync(new URL('../../../contracts/schemas/bsk-compose-v0alpha1.schema.json', import.meta.url)));
const ajv = new Ajv2020({ strict: true, allErrors: true });
ajv.addSchema(declarationSchema);
const shape = ajv.compile(schema);
const hostShape = ajv.compile({ $ref: `${schema.$id}#/$defs/host` });
const slugShape = ajv.compile({ $ref: `${schema.$id}#/$defs/slug` });
export const dimensions = ['cpuMillis', 'memoryBytes', 'pids', 'storageBytes'];
export function fail(code) { throw Object.assign(new Error(`Compose driver rejected input: ${code}.`), { code }); }
export function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])]));
  return v;
}
export const hash = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export const identity = t => [t.installationRef, t.projectRef, t.environmentRef];
export function scopeName(t) {
  for (const field of ['installationRef', 'projectRef', 'environmentRef']) if (!slugShape(t?.[field])) fail('SCHEMA');
  return `bsk-${t.projectRef.slice(0, 10)}-${t.environmentRef.slice(0, 8)}-${hash(identity(t)).slice(0, 24)}`;
}
export function labels(t, scope, service = '_shared') {
  return Object.fromEntries(Object.entries({ installation: t.installationRef, project: t.projectRef,
    environment: t.environmentRef, deployment: t.deploymentRef, service, scope, 'managed-by': 'bsk-compose-v0alpha1'
  }).map(([k, v]) => [`dev.bsk.${k}`, v]));
}
function sumUsage(workloads, requested) {
  const total = Object.fromEntries(dimensions.map(k => [k, 0n]));
  for (const w of workloads) {
    const r = w.resources;
    const amounts = [requested ? r.cpuRequestMillis : r.cpuLimitMillis,
      requested ? r.memoryRequestBytes : r.memoryLimitBytes, r.pidsLimit, r.storageBudgetBytes];
    dimensions.forEach((d, i) => { total[d] += BigInt(amounts[i]) * BigInt(r.replicas); });
  }
  if (Object.values(total).some(n => n > BigInt(Number.MAX_SAFE_INTEGER))) fail('OVERFLOW');
  return Object.fromEntries(dimensions.map(k => [k, Number(total[k])]));
}

export function buildPlan(input) {
  if (!shape(input)) fail('SCHEMA');
  if (!validateBundle(input.declarations).valid) fail('DECLARATIONS');
  const t = input.target;
  const declarations = input.declarations.resources.filter(r => r.metadata.installationRef === t.installationRef);
  if (!declarations.some(r => r.kind === 'Project' && r.metadata.name === t.projectRef) ||
      !declarations.some(r => r.kind === 'Environment' && r.metadata.projectRef === t.projectRef && r.metadata.name === t.environmentRef)) fail('REFERENCE');
  const scope = scopeName(t);
  const workloads = structuredClone(input.workloads).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (new Set(workloads.map(w => w.name)).size !== workloads.length) fail('DUPLICATE');
  const httpRefs = new Set();
  for (const w of workloads) {
    const r = w.resources;
    if (r.cpuRequestMillis > r.cpuLimitMillis || r.memoryRequestBytes > r.memoryLimitBytes) fail('RESOURCE_BOUNDS');
    if (r.memoryLimitBytes < 6291456) fail('RESOURCE_BOUNDS');
    w.dataRefs = [...(w.dataRefs ?? [])].sort();
    if (w.dataRefs.some(name => !workloads.some(other => other.name === name && other.role === 'data'))) fail('REFERENCE');
    if (w.role === 'http') {
      const svc = declarations.find(r => r.kind === 'Service' && r.metadata.projectRef === t.projectRef && r.metadata.name === w.serviceRef);
      if (!svc) fail('REFERENCE');
      if (httpRefs.has(w.serviceRef)) fail('DUPLICATE');
      httpRefs.add(w.serviceRef);
      if (svc.spec.secretRefs?.length) fail('SECRETS_UNSUPPORTED');
      if (svc.spec.resources && hash(svc.spec.resources) !== hash(r)) fail('RESOURCE_BOUNDS');
      w.port = svc.spec.port;
    }
  }
  const usage = sumUsage(workloads, false);
  const requested = sumUsage(workloads, true);
  const compose = { name: scope, services: {}, networks: {}, volumes: {} };
  for (const name of ['ingress', 'data']) compose.networks[name] = { name: `${scope}-${name}`, driver: 'bridge', internal: true, labels: labels(t, scope) };
  for (const w of workloads) {
    const r = w.resources;
    const service = { image: w.image, labels: labels(t, scope, w.name),
      networks: w.role === 'http' ? (w.dataRefs.length ? ['ingress', 'data'] : ['ingress']) : ['data'],
      cpus: r.cpuLimitMillis / 1000, mem_limit: r.memoryLimitBytes, memswap_limit: r.memoryLimitBytes,
      mem_reservation: r.memoryRequestBytes, pids_limit: r.pidsLimit, deploy: { replicas: r.replicas },
      cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'], init: true,
      logging: { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } }
    };
    if (w.role === 'http') service.expose = [String(w.port)];
    if (w.persistent) {
      const key = `data-${w.name}`;
      compose.volumes[key] = { name: `${scope}-${key}`, labels: labels(t, scope, w.name) };
      service.volumes = [{ type: 'volume', source: key, target: '/data' }];
    }
    compose.services[w.name] = service;
  }
  const plan = { apiVersion: 'bsk.compose/v0alpha1', target: structuredClone(t), scope,
    compose, workloads, usage, requested, runtime: 'not-observed' };
  return { ...canonical(plan), planId: hash(plan) };
}

export function assertHost(h) {
  if (!hostShape(h)) fail('HOST_SCHEMA');
  for (const d of dimensions) if (h.reserved[d] > h.capacity[d]) fail('CAPACITY');
  for (const list of [h.projectBudgets, h.environmentBudgets]) {
    const keys = list.map(b => JSON.stringify([b.installationRef, b.projectRef, b.environmentRef ?? null]));
    if (new Set(keys).size !== keys.length) fail('DUPLICATE');
  }
}
export function admit(plan, h, entries) {
  assertHost(h);
  if (plan.target.hostRef !== h.hostRef) fail('HOST_MISMATCH');
  if (['cpu', 'memory', 'pids'].some(k => h.capabilities[k] !== 'supported') || h.storageMode === 'enforce') fail('CAPABILITY');
  const t = plan.target;
  const sameProject = p => p.target.installationRef === t.installationRef && p.target.projectRef === t.projectRef;
  const project = h.projectBudgets.find(b => b.installationRef === t.installationRef && b.projectRef === t.projectRef);
  const environment = h.environmentBudgets.find(b => b.installationRef === t.installationRef && b.projectRef === t.projectRef && b.environmentRef === t.environmentRef);
  if (!project || !environment) fail('BUDGET_MISSING');
  for (const d of dimensions) {
    const sum = filter => entries.filter(e => filter(e.plan)).reduce((n, e) => n + BigInt(e.plan.usage[d]), BigInt(plan.usage[d]));
    if (sum(() => true) > BigInt(h.capacity[d]) - BigInt(h.reserved[d])) fail('CAPACITY');
    if (sum(sameProject) > BigInt(project.limits[d])) fail('PROJECT_BUDGET');
    if (sum(p => sameProject(p) && p.target.environmentRef === t.environmentRef) > BigInt(environment.limits[d])) fail('ENVIRONMENT_BUDGET');
  }
  return { requested: structuredClone(plan.requested), admitted: structuredClone(plan.usage),
    enforced: 'unknown', observed: null, storageEnforcement: 'unsupported' };
}
