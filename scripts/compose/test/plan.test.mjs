import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, admit, scopeName } from '../lib/plan.mjs';
import { request, host } from '../test-support/fixtures.mjs';

const rejects = (fn, code) => assert.throws(fn, e => e.code === code);

test('scopes are deterministic, bounded and separate ambiguous identities', () => {
  const t = request().target;
  assert.equal(scopeName(t), scopeName({ ...t, deploymentRef: 'attempt-2' }));
  assert.notEqual(scopeName(t), scopeName({ ...t, projectRef: 'fixture-b' }));
  assert.notEqual(scopeName({ ...t, projectRef: 'a-b', environmentRef: 'c' }), scopeName({ ...t, projectRef: 'a', environmentRef: 'b-c' }));
  assert.match(scopeName(t), /^bsk-[a-z0-9-]+-[a-f0-9]{24}$/);
  assert.ok(scopeName({ ...t, projectRef: 'p'.repeat(63), environmentRef: 'e'.repeat(63) }).length <= 63);
});

test('renders isolated topology, persistent volume and complete ownership labels', () => {
  const p = buildPlan(request()); const c = p.compose;
  assert.equal(c.name, p.scope);
  assert.equal(c.networks.ingress.internal, true);
  assert.equal(c.networks.data.internal, true);
  assert.notEqual(c.networks.ingress.name, c.networks.data.name);
  assert.deepEqual(c.services.http.networks, ['ingress', 'data']);
  assert.deepEqual(c.services.db.networks, ['data']);
  assert.equal(c.services.http.cpus, 0.25);
  assert.equal(c.services.http.mem_limit, 33554432);
  assert.equal(c.services.http.memswap_limit, 33554432);
  assert.equal(c.services.http.pids_limit, 32);
  assert.equal(c.services.db.volumes[0].type, 'volume');
  assert.equal(c.services.db.volumes[0].target, '/data');
  assert.equal(c.services.http.ports, undefined);
  assert.equal(c.services.db.ports, undefined);
  assert.equal(c.services.http.container_name, undefined);
  assert.equal(c.services.http.cap_drop[0], 'ALL');
  for (const r of [...Object.values(c.services), ...Object.values(c.networks), ...Object.values(c.volumes)]) {
    for (const key of ['installation', 'project', 'environment', 'service', 'deployment', 'scope', 'managed-by']) assert.ok(r.labels[`dev.bsk.${key}`]);
  }
  const b = buildPlan(request('fixture-b'));
  assert.notEqual(p.scope, b.scope);
  assert.notEqual(c.volumes['data-db'].name, b.compose.volumes['data-db'].name);
});

test('HTTP without data references never joins the private network; workers never join ingress', () => {
  const r = request(); r.workloads[0].dataRefs = [];
  r.workloads.push({ ...r.workloads[1], name: 'worker', role: 'worker', persistent: false });
  const p = buildPlan(r);
  assert.deepEqual(p.compose.services.http.networks, ['ingress']);
  assert.deepEqual(p.compose.services.worker.networks, ['data']);
});

test('output is stable under set/key reorder and does not mutate input', () => {
  const r = request(); const before = JSON.stringify(r);
  const p = buildPlan(r); r.workloads.reverse(); r.declarations.resources.reverse();
  assert.equal(JSON.stringify(p), JSON.stringify(buildPlan(r)));
  assert.equal(JSON.stringify(request()), before);
});

for (const [key, value] of [['privileged', true], ['network_mode', 'host'], ['ports', ['5432:5432']],
  ['volumes', ['/var/run/docker.sock:/sock']], ['cap_add', ['SYS_ADMIN']], ['command', ['sh']],
  ['devices', ['/dev/sda']], ['environment', { SECRET: 'fake-secret' }]]) {
  test(`rejects unsafe or raw Compose field ${key}`, () => {
    const r = request(); r.workloads[1][key] = value; rejects(() => buildPlan(r), 'SCHEMA');
  });
}
for (const field of ['installationRef', 'projectRef', 'environmentRef']) {
  test(`rejects undeclared ${field}`, () => {
    const r = request(); r.target[field] = 'foreign'; rejects(() => buildPlan(r), 'REFERENCE');
  });
}
test('rejects duplicates, wrong HTTP binding, missing data and unsupported secrets', () => {
  let r = request(); r.workloads.push(structuredClone(r.workloads[0])); rejects(() => buildPlan(r), 'DUPLICATE');
  r = request(); r.workloads[0].serviceRef = 'foreign'; rejects(() => buildPlan(r), 'REFERENCE');
  r = request(); r.workloads[0].dataRefs = ['foreign']; rejects(() => buildPlan(r), 'REFERENCE');
  r = request(); r.declarations.resources[4].spec.secretRefs = ['secret']; rejects(() => buildPlan(r), 'SECRETS_UNSUPPORTED');
  r = request(); r.workloads[0].image = 'example.test/image:latest'; rejects(() => buildPlan(r), 'SCHEMA');
});

test('admission reserves effective limits times replicas and preserves unknown observation', () => {
  const r = request(); r.workloads[0].resources.replicas = 2;
  const p = buildPlan(r); const a = admit(p, host(), []);
  assert.equal(a.requested.cpuMillis, 300);
  assert.equal(a.admitted.cpuMillis, 750);
  assert.equal(a.admitted.memoryBytes, 100663296);
  assert.equal(a.enforced, 'unknown'); assert.equal(a.observed, null);
  assert.equal(a.storageEnforcement, 'unsupported');
});
test('rejects unknown/unsupported mandatory enforcement and storage enforce mode', () => {
  for (const resource of ['cpu', 'memory', 'pids']) for (const value of ['unknown', 'unsupported']) {
    const h = host(); h.capabilities[resource] = value; rejects(() => admit(buildPlan(request()), h, []), 'CAPABILITY');
  }
  const h = host(); h.storageMode = 'enforce'; rejects(() => admit(buildPlan(request()), h, []), 'CAPABILITY');
});
test('rejects host reserve, project and environment overcommit including existing claims', () => {
  const p = buildPlan(request());
  let h = host(); h.capacity.cpuMillis = 500; rejects(() => admit(p, h, []), 'CAPACITY');
  h = host(); h.projectBudgets[0].limits.memoryBytes = 100; rejects(() => admit(p, h, []), 'PROJECT_BUDGET');
  h = host(); h.environmentBudgets[0].limits.pids = 1; rejects(() => admit(p, h, []), 'ENVIRONMENT_BUDGET');
  h = host(); const b = buildPlan(request('fixture-b')); h.capacity.cpuMillis = 1000;
  rejects(() => admit(p, h, [{ plan: b }]), 'CAPACITY');
});
test('rejects resource bounds and unsafe arithmetic', () => {
  const r = request(); r.workloads[0].resources.cpuRequestMillis = 1000; rejects(() => buildPlan(r), 'RESOURCE_BOUNDS');
  r.workloads[0].resources.cpuRequestMillis = 100;
  r.workloads[0].resources.replicas = Number.MAX_SAFE_INTEGER; rejects(() => buildPlan(r), 'OVERFLOW');
});
