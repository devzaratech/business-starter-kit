import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtures } from './fixtures.mjs';
import { requireThat } from './guard.mjs';
import { Inventory } from '../lib/inventory.mjs';
import { buildPlan, admit } from '../lib/plan.mjs';
import { expectedObjects, inspectLimits, planLifecycle } from '../lib/lifecycle.mjs';

export const labelDriftGap = 'Expected-resource label drift at unchanged cardinality has unit coverage only; runtime ownership negatives reject scoped extra volumes.';

export function proveLabelMismatch(entry, objects, name, key) {
  const expected = expectedObjects(entry.plan);
  requireThat(objects.length === expected.length && new Set(objects.map(o => `${o.kind}:${o.name}`)).size === expected.length &&
    objects.every(o => expected.some(e => e.kind === o.kind && e.name === o.name)), 'DRIFT_CARDINALITY');
  const target = objects.find(o => o.kind === 'network' && o.name === name);
  const original = expected.find(o => o.kind === 'network' && o.name === name);
  requireThat(target && original && target.labels[key] !== original.labels[key], 'DRIFT_LABEL');
  let code; try { inspectLimits(entry, objects); } catch (e) { code = e.code; }
  requireThat(code === 'OWNERSHIP', 'DRIFT_REJECTION');
  const repaired = structuredClone(objects);
  repaired.find(o => o.kind === 'network' && o.name === name).labels[key] = original.labels[key];
  requireThat(inspectLimits(entry, repaired).configurationMatches, 'DRIFT_CONFOUNDER');
  return { count: objects.length, expectedCount: expected.length, rejection: code, changedLabel: key, labelOnlyRepairPasses: true };
}

export async function runLabelDrift(h) {
  const f = fixtures(h.permit.run, h.imageRef);
  const installation = `${f.requests[0].target.installationRef}-drift`;
  const input = structuredClone(f.requests[0]); input.target.installationRef = installation;
  input.declarations.resources.forEach(r => { r.metadata.installationRef = installation; });
  const resources = input.workloads[0].resources;
  input.workloads = [{ name: 'probe', role: 'worker', image: h.imageRef, resources }];
  for (const b of [...f.host.projectBudgets, ...f.host.environmentBudgets]) b.installationRef = installation;
  const store = Inventory.initialize(join(h.root, 'label-drift-inventory'), f.host);
  store.claim(input, 0); const entry = store.snapshot().entries[0]; const plan = buildPlan(input);
  admit(plan, f.host, h.store.snapshot().entries);
  const tags = { 'dev.bsk.test-run': h.permit.run, 'dev.bsk.test-role': 'expected-label-drift' };
  const compose = structuredClone(plan.compose);
  for (const o of [...Object.values(compose.services), ...Object.values(compose.networks)]) Object.assign(o.labels, tags);
  writeFileSync(join(h.socketDir, 'compose-label-drift.json'), JSON.stringify(compose), { mode: 0o600 });
  h.save('label-drift-plan', plan);
  h.labelDriftPending = true;
  h.docker.inner(['compose', '-p', plan.scope, '-f', '/run/bsk/compose-label-drift.json', 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '30'], { timeout: 60000 });
  // Compose omits unused networks; this worker-only fixture still expects ingress.
  const ingress = plan.compose.networks.ingress;
  const names = h.docker.inner(['network', 'ls', '--format', '{{.Name}}']).stdout.trim().split('\n');
  requireThat(!names.includes(ingress.name), 'DRIFT_NETWORK_EXISTS');
  const ingressLabels = { ...ingress.labels, ...tags, 'com.docker.compose.project': plan.scope };
  const create = ['network', 'create', '--internal', '--driver', ingress.driver];
  for (const [k, v] of Object.entries(ingressLabels)) create.push('--label', `${k}=${v}`);
  const ingressId = h.docker.inner([...create, ingress.name]).stdout.trim();
  requireThat(/^[a-f0-9]{64}$/.test(ingressId), 'DRIFT_ID');
  const ingressRecord = { kind: 'network', id: ingressId, labels: ingressLabels };
  const actualIngress = h.docker.inspect(ingressRecord);
  requireThat(actualIngress.Name === ingress.name && actualIngress.Internal === ingress.internal &&
    actualIngress.Driver === ingress.driver && Object.keys(actualIngress.Containers ?? {}).length === 0, 'DRIFT_NETWORK_TOPOLOGY');
  h.aux.push(ingressRecord);
  h.save('label-drift-ingress', { name: ingress.name, ...ingressRecord, internal: actualIngress.Internal, driver: actualIngress.Driver });
  const initial = h.reader.resources(plan); requireThat(inspectLimits(entry, initial).configurationMatches, 'DRIFT_BASELINE');
  // Register networks first so reverse-order cleanup removes their container first.
  for (const o of [...initial].sort((a, b) => (a.kind === 'container') - (b.kind === 'container'))) {
    if (o.kind === 'network' && o.id === ingressId) continue;
    const record = { kind: o.kind, id: o.id, labels: { ...o.labels, ...tags } };
    h.docker.inspect(record); h.aux.push(record);
  }
  h.labelDriftPending = false;
  const name = plan.compose.networks.ingress.name; const key = 'dev.bsk.project'; const evidence = [];
  for (const mode of ['wrong', 'missing']) {
    const old = h.aux.find(r => r.kind === 'network' && r.labels['dev.bsk.scope'] === plan.scope && r.id === h.reader.resources(plan).find(o => o.name === name).id);
    requireThat(old, 'DRIFT_OWNER');
    const actual = h.docker.inspect(old); requireThat(Object.keys(actual.Containers ?? {}).length === 0, 'DRIFT_ATTACHED');
    h.labelDriftPending = true;
    h.docker.removeOwned(old); h.aux = h.aux.filter(r => r !== old);
    const labels = { ...plan.compose.networks.ingress.labels, ...tags, 'com.docker.compose.project': plan.scope };
    if (mode === 'wrong') labels[key] = 'synthetic-other-owner'; else delete labels[key];
    const args = ['network', 'create', '--internal', '--driver', 'bridge'];
    for (const [k, v] of Object.entries(labels)) args.push('--label', `${k}=${v}`);
    const id = h.docker.inner([...args, name]).stdout.trim();
    requireThat(/^[a-f0-9]{64}$/.test(id), 'DRIFT_ID');
    const record = { kind: 'network', id, labels }; h.docker.inspect(record); h.aux.push(record); h.labelDriftPending = false;
    const proof = proveLabelMismatch(entry, h.reader.resources(plan), name, key);
    const driftReader = { resources(p) {
      const objects = h.reader.resources(p);
      proveLabelMismatch(entry, objects, name, key);
      return objects;
    } };
    let code; try { planLifecycle(store, plan.planId, 'destroy', driftReader, { confirmPlanId: plan.planId, confirmDataLoss: true }); } catch (e) { code = e.code; }
    requireThat(code === 'OWNERSHIP', 'DRIFT_LIFECYCLE');
    h.docker.inspect(record);
    evidence.push({ mode, ...proof, lifecycleRejection: code, resourceStillPresent: true });
  }
  return { scope: plan.scope, cases: evidence, primaryProjectsUntouched: true };
}
