import { createHash } from 'node:crypto';
import { fixture } from './fixtures.mjs';
import { planCandidate } from '../lib/plan.mjs';
import { buildPlan, admit } from '../../compose/lib/plan.mjs';
import { limits, host } from '../../compose/test-support/fixtures.mjs';
import { runtimeObjects } from '../../compose/test-support/runtime.mjs';

export function caddyFixture() {
  const input = fixture(); input.gateways[0].spec.listenerPorts = [80];
  input.routes.filter(r => r.spec.pathPrefix === '/').forEach(r => { r.metadata.name = `a-${r.metadata.name}`; });
  input.routes.filter(r => r.spec.pathPrefix === '/api').forEach(r => { r.metadata.name = 'z-api'; });
  const deep = structuredClone(input.routes[2]); deep.metadata.name = 'zz-api-v2'; deep.spec.pathPrefix = '/api/v2'; input.routes.push(deep);
  const snapshot = { apiVersion: 'bsk.edge/v0alpha1', kind: 'RouteRegistrySnapshot', generation: 7, input };
  const candidate = planCandidate(snapshot, 'edge');
  const h = host(); h.hostRef = 'host-a';
  h.projectBudgets = ['alpha', 'bravo', 'charlie'].map(projectRef => ({ installationRef: input.installationRef, projectRef, limits: { ...h.capacity } }));
  h.environmentBudgets = h.projectBudgets.map(b => ({ ...b, environmentRef: 'review-42' }));
  const deployments = []; const previous = [];
  for (const [i, projectRef] of ['alpha', 'bravo', 'charlie'].entries()) {
    const request = { apiVersion: 'bsk.compose/v0alpha1', declarations: structuredClone(input.declarations),
      target: { installationRef: input.installationRef, projectRef, environmentRef: 'review-42', deploymentRef: 'release-1', hostRef: 'host-a' },
      workloads: [{ name: 'http', role: 'http', serviceRef: 'http', image: input.deployments[i].resource.spec.artifact, resources: limits(), dataRefs: ['db'] },
        { name: 'db', role: 'data', image: `fixture/db@sha256:${'b'.repeat(64)}`, resources: limits(), persistent: true },
        { name: 'worker', role: 'worker', image: `fixture/worker@sha256:${'c'.repeat(64)}`, resources: limits() }] };
    const plan = buildPlan(request); const admission = admit(plan, h, previous);
    const entry = { request, plan, admission }; previous.push(entry);
    const objects = runtimeObjects(plan).map(o => ({ ...o, id: o.kind === 'volume' ? o.id : createHash('sha256').update(`${projectRef}:${o.id}`).digest('hex') }));
    for (const n of objects.filter(o => o.kind === 'network')) n.attachments = objects.filter(o => o.kind === 'container' && o.networks.includes(n.name)).map(o => o.id);
    const container = objects.find(o => o.kind === 'container' && o.labels['dev.bsk.service'] === 'http');
    const network = objects.find(o => o.kind === 'network' && o.name === plan.compose.networks.ingress.name);
    deployments.push({ entry, objects, addresses: [{ containerId: container.id, networkId: network.id,
      ipv4: `172.${20 + i}.0.2`, subnet: `172.${20 + i}.0.0/24`, running: true, imageRef: request.workloads[0].image }] });
  }
  const runtime = { apiVersion: 'bsk.caddy.runtime/v0alpha1', candidatePlanId: candidate.planId, registryGeneration: candidate.registryGeneration,
    target: { installationRef: input.installationRef, gatewayRef: 'edge', hostRef: 'host-a' }, engineRef: 'synthetic-pinned-engine', deployments };
  return { snapshot, candidate, runtime };
}

export function recandidate(f) {
  f.candidate = planCandidate(f.snapshot, 'edge');
  f.runtime.candidatePlanId = f.candidate.planId; f.runtime.registryGeneration = f.candidate.registryGeneration;
}

export function rebuild(d) {
  d.entry.plan = buildPlan(d.entry.request);
  d.entry.admission = { requested: d.entry.plan.requested, admitted: d.entry.plan.usage, enforced: 'unknown', observed: null, storageEnforcement: 'unsupported' };
}
