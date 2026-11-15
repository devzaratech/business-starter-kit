import { isDeepStrictEqual } from 'node:util';
import { canonical, compare, hash } from '../../lib/model.mjs';
import { reject } from './resolve.mjs';

const targetKey = t => JSON.stringify([t?.installationRef, t?.projectRef, t?.environmentRef, t?.deploymentRef]);
const digest = /^sha256:[a-f0-9]{64}$/;
const equal = (a, b) => isDeepStrictEqual(canonical(a), canonical(b));
export const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));

export function selectAdmissions(inventory, candidate) {
  if (!fields(inventory, ['version', 'host', 'revision', 'entries']) || inventory.version !== 1 ||
    inventory.host?.hostRef !== candidate.target.hostRef || !Number.isSafeInteger(inventory.revision) ||
    inventory.revision < 0 || !Array.isArray(inventory.entries) || inventory.entries.length > 1000) reject('INVENTORY_SCOPE');
  const wanted = new Set(candidate.desired.routes.map(r => targetKey(r.upstream)));
  const entries = new Map();
  for (const entry of inventory.entries) {
    const key = targetKey(entry?.plan?.target);
    if (!wanted.has(key)) continue;
    if (entries.has(key)) reject('DEPLOYMENT_AMBIGUOUS');
    if (entry.plan.target.hostRef !== candidate.target.hostRef) reject('OWNERSHIP');
    entries.set(key, entry);
  }
  if (wanted.size !== entries.size) reject('DEPLOYMENT_MISSING');
  return [...entries.values()].sort((a, b) => compare(a.plan.planId, b.plan.planId));
}

export function runtimeBundle(sample, candidate, scope, entries, started, finished) {
  if (!fields(sample, ['scope', 'collectedAt', 'deployments']) || !Array.isArray(sample.deployments) ||
    sample.deployments.length !== entries.length) reject('OBSERVATION_INCOMPLETE');
  if (!equal(sample.scope, scope)) reject('OBSERVATION_SCOPE');
  if (![sample.collectedAt, started, finished].every(n => Number.isSafeInteger(n) && n >= 0) || sample.collectedAt < started ||
    sample.collectedAt > finished) reject('OBSERVATION_STALE');
  if (Buffer.byteLength(JSON.stringify(sample)) > 32 * 1024 * 1024) reject('OBSERVATION_INCOMPLETE');
  const byPlan = new Map();
  for (const deployment of sample.deployments) {
    if (!fields(deployment, ['planId', 'objects', 'addresses', 'containers', 'ingressPeers']) ||
      !Array.isArray(deployment.containers) || deployment.containers.length > 1000 ||
      !Array.isArray(deployment.ingressPeers) || deployment.ingressPeers.length > 1000 ||
      byPlan.has(deployment.planId)) reject('OBSERVATION_CONTRADICTORY');
    byPlan.set(deployment.planId, deployment);
  }
  const deployments = entries.map(entry => {
    const d = byPlan.get(entry.plan.planId);
    if (!d) reject('OBSERVATION_INCOMPLETE');
    return { entry, objects: d.objects, addresses: d.addresses };
  });
  return { apiVersion: 'bsk.caddy.runtime/v0alpha1', candidatePlanId: candidate.planId,
    registryGeneration: candidate.registryGeneration,
    target: { installationRef: scope.installationRef, gatewayRef: scope.gatewayRef, hostRef: scope.hostRef },
    engineRef: scope.engineRef, deployments };
}

// Call after the B1 renderer verifies ES2 object ownership and expected topology.
export function verifyTopology(sample, runtime) {
  const byPlan = new Map(sample.deployments.map(d => [d.planId, d]));
  for (const { entry, objects, addresses } of runtime.deployments) {
    const { containers: facts, ingressPeers } = byPlan.get(entry.plan.planId);
    const containers = objects.filter(o => o.kind === 'container');
    const networks = objects.filter(o => o.kind === 'network');
    const expectedPeers = addresses.map(({ containerId, networkId, ipv4, subnet }) => ({ containerId, networkId, ipv4, subnet }));
    if (!equal(canonical(ingressPeers, true), canonical(expectedPeers, true))) reject('OBSERVATION_CONTRADICTORY');
    if (facts.length !== containers.length) reject('OBSERVATION_CONTRADICTORY');
    const ids = new Set();
    for (const fact of facts) {
      if (!fields(fact, ['containerId', 'imageId', 'inspectedImageId', 'imageRef', 'repoDigests', 'running', 'networks']) ||
        ids.has(fact.containerId) || typeof fact.running !== 'boolean' || !Array.isArray(fact.networks) ||
        !Array.isArray(fact.repoDigests) || typeof fact.imageId !== 'string' || !digest.test(fact.imageId)) {
        reject('OBSERVATION_CONTRADICTORY');
      }
      const container = containers.find(o => o.id === fact.containerId);
      if (!container) reject('OBSERVATION_CONTRADICTORY');
      ids.add(fact.containerId);
      const workload = entry.plan.workloads.find(w => w.name === container.labels['dev.bsk.service']);
      if (!workload || fact.imageId !== fact.inspectedImageId || fact.imageRef !== workload.image ||
        !fact.repoDigests.includes(workload.image)) reject('ARTIFACT_MISMATCH');
      const expected = networks.filter(n => container.networks.includes(n.name)).map(n => ({ name: n.name, id: n.id }));
      if (!equal(canonical(fact.networks, true), canonical(expected, true))) reject('OBSERVATION_CONTRADICTORY');
      const address = addresses.find(a => a.containerId === fact.containerId);
      if (address && (address.running !== fact.running || address.imageRef !== fact.imageRef)) reject('OBSERVATION_CONTRADICTORY');
    }
    for (const network of networks) {
      const expected = containers.filter(c => c.networks.includes(network.name)).map(c => c.id).sort();
      if (!Array.isArray(network.attachments) || !equal([...network.attachments].sort(), expected)) reject('OBSERVATION_CONTRADICTORY');
    }
  }
  return hash(canonical(sample.deployments, true));
}
