import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Inventory } from '../lib/inventory.mjs';
import { inspectLimits, planLifecycle } from '../lib/lifecycle.mjs';
import { request, host } from '../test-support/fixtures.mjs';
import { runtimeObjects } from '../test-support/runtime.mjs';

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'bsk-es2-lifecycle-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = Inventory.initialize(root, host()); store.claim(request(), 0); store.claim(request('fixture-b'), 1);
  const entry = store.snapshot().entries.find(e => e.plan.target.projectRef === 'fixture-a');
  const objects = runtimeObjects(entry.plan);
  return { root, store, entry, objects, reader: { resources: () => structuredClone(objects) } };
}
const denies = (fn, code) => assert.throws(fn, e => e.code === code);
test('stop/down plans preserve data and never change either project inventory', t => {
  const { root, store, entry, reader } = setup(t); const before = readFileSync(join(root, 'inventory.json'));
  for (const action of ['stop', 'down']) {
    const p = planLifecycle(store, entry.plan.planId, action, reader);
    assert.equal(p.mode, 'intent-only'); assert.equal(p.preservesVolumes, true);
    assert.ok(p.actions.every(a => a.kind !== 'volume'));
    assert.ok(p.actions.every(a => a.projectScope === entry.plan.scope));
  }
  assert.deepEqual(readFileSync(join(root, 'inventory.json')), before);
});
test('destroy intent needs explicit data-loss confirmation bound to exact plan', t => {
  const { store, entry, reader } = setup(t);
  denies(() => planLifecycle(store, entry.plan.planId, 'destroy', reader), 'CONFIRMATION_REQUIRED');
  denies(() => planLifecycle(store, entry.plan.planId, 'destroy', reader, { confirmPlanId: 'wrong', confirmDataLoss: true }), 'CONFIRMATION_REQUIRED');
  const p = planLifecycle(store, entry.plan.planId, 'destroy', reader, { confirmPlanId: entry.plan.planId, confirmDataLoss: true });
  assert.equal(p.preservesVolumes, false); assert.ok(p.actions.some(a => a.kind === 'volume'));
});

test('lifecycle identity and observations are independent of Docker inspection order', t => {
  const { store, entry, objects, reader } = setup(t);
  for (const action of ['stop', 'down', 'destroy']) {
    const confirmation = { confirmPlanId: entry.plan.planId, confirmDataLoss: true };
    const forward = planLifecycle(store, entry.plan.planId, action, reader, confirmation);
    const reverse = planLifecycle(store, entry.plan.planId, action,
      { resources: () => structuredClone(objects).reverse() }, confirmation);
    assert.deepEqual(reverse, forward);
  }
});
for (const [name, change] of [
  ['foreign owner', objects => { objects[0].labels['dev.bsk.project'] = 'fixture-b'; }],
  ['unlabeled volume', objects => { objects.find(o => o.kind === 'volume').labels = {}; }],
  ['foreign scope', objects => { objects[0].labels['com.docker.compose.project'] = 'foreign'; }],
  ['unexpected container', objects => { objects.push({ ...structuredClone(objects[0]), name: 'unexpected', id: 'unknown' }); }],
  ['missing resource', objects => { objects.pop(); }],
  ['duplicate ID', objects => { objects[1].id = objects[0].id; }]
]) {
  test(`denies ${name} before lifecycle actions`, t => {
    const { store, entry, reader, objects } = setup(t); change(objects);
    denies(() => planLifecycle(store, entry.plan.planId, 'down', reader), 'OWNERSHIP');
  });
}
for (const [name, mutate] of [
  ['privileged', o => { o[0].privileged = true; }], ['host network', o => { o[0].hostNetwork = true; }],
  ['published port', o => { o[0].ports = [5432]; }], ['foreign network', o => { o[0].networks.push('foreign'); }],
  ['foreign mount', o => { o[0].mounts.push('/var/run/docker.sock'); }]
]) {
  test(`denies observed ${name}`, t => {
    const { entry, objects } = setup(t); mutate(objects);
    denies(() => inspectLimits(entry, objects), 'RUNTIME_POLICY');
  });
}
test('inspection distinguishes requested/admitted/observed from unproven kernel enforcement', t => {
  const { entry, objects } = setup(t); let r = inspectLimits(entry, objects);
  assert.equal(r.configurationMatches, true); assert.equal(r.enforced, 'unknown');
  assert.equal(r.runtimeConformance, false); assert.equal(r.source, 'docker-inspect');
  objects[0].limits.memoryBytes = 0; r = inspectLimits(entry, objects);
  assert.equal(r.configurationMatches, false); assert.ok(r.observed.length > 0);
});
test('missing inventory, unsupported action and reader failure deny', t => {
  const { store, entry, reader } = setup(t);
  denies(() => planLifecycle(store, 'unknown', 'down', reader), 'INVENTORY_MISSING');
  denies(() => planLifecycle(store, entry.plan.planId, 'prune', reader), 'ACTION');
  denies(() => planLifecycle(store, entry.plan.planId, 'down', { resources() { throw Object.assign(new Error('unavailable'), { code: 'DOCKER_READ' }); } }), 'DOCKER_READ');
});

test('a real registry commit during inspection invalidates the lifecycle intent', t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-es2-stale-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const store = Inventory.initialize(root, host()); const entry = store.claim(request(), 0).entries[0];
  const reader = { resources(plan) { store.claim(request('fixture-b'), 1); return runtimeObjects(plan); } };
  denies(() => planLifecycle(store, entry.plan.planId, 'down', reader), 'STALE_REVISION');
  assert.equal(store.snapshot().entries.length, 2);
});
