import test from 'node:test';
import assert from 'node:assert/strict';
import { proveLabelMismatch, runLabelDrift } from '../runtime/label-drift.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyOwner } from '../runtime/guard.mjs';
import { Harness } from '../runtime/harness.mjs';
import { buildPlan } from '../lib/plan.mjs';
import { request } from '../test-support/fixtures.mjs';
import { runtimeObjects } from '../test-support/runtime.mjs';

function setup() {
  const plan = buildPlan(request()); const objects = runtimeObjects(plan);
  const target = objects.find(o => o.kind === 'network');
  const entry = { plan, admission: { requested: plan.requested, admitted: plan.usage } };
  return { entry, objects, target };
}
for (const missing of [false, true]) test(`proves only ${missing ? 'missing' : 'wrong'} expected label causes rejection`, () => {
  const { entry, objects, target } = setup();
  if (missing) delete target.labels['dev.bsk.project']; else target.labels['dev.bsk.project'] = 'foreign';
  const result = proveLabelMismatch(entry, objects, target.name, 'dev.bsk.project');
  assert.equal(result.rejection, 'OWNERSHIP'); assert.equal(result.count, objects.length);
  assert.equal(result.labelOnlyRepairPasses, true);
});

test('orchestrates isolated expected-network replacements with retained cleanup ownership', async t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-label-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let plan; let objects = []; let serial = 0;
  const id = () => createHash('sha256').update(String(++serial)).digest('hex');
  const tags = { 'dev.bsk.test-run': '1234-1', 'dev.bsk.test-role': 'expected-label-drift' };
  const h = { root, socketDir: root, store: { snapshot: () => ({ entries: [] }) }, permit: { run: '1234-1' }, imageRef: `localhost:5000/bsk-es2-fixture@sha256:${'a'.repeat(64)}`, aux: [],
    save(_name, value) { plan = value; }, reader: { resources: () => structuredClone(objects) } };
  h.docker = {
    inner(args) {
      if (args[0] === 'compose') { objects = runtimeObjects(plan).map(o => ({ ...o, id: id(), labels: { ...o.labels, ...tags } })); return { stdout: '' }; }
      assert.deepEqual(args.slice(0, 5), ['network', 'create', '--internal', '--driver', 'bridge']);
      const labels = {}; args.forEach((a, i) => { if (a === '--label') { const [k, v] = args[i + 1].split('='); labels[k] = v; } });
      const network = { kind: 'network', name: args.at(-1), id: id(), internal: true, driver: 'bridge', attachments: [], labels };
      objects.push(network); return { stdout: network.id };
    },
    inspect(record) {
      const o = objects.find(o => o.id === record.id); assert.ok(o); verifyOwner({ Id: o.id, Labels: o.labels }, record);
      return { Containers: {} };
    },
    removeOwned(record) { this.inspect(record); objects = objects.filter(o => o.id !== record.id); }
  };
  const evidence = await runLabelDrift(h);
  assert.equal(evidence.cases.length, 2); assert.ok(evidence.cases.every(c => c.count === 3 && c.lifecycleRejection === 'OWNERSHIP'));
  assert.equal(h.labelDriftPending, false); assert.equal(h.aux.length, 3);
  for (const record of h.aux.reverse()) h.docker.removeOwned(record);
  assert.equal(objects.length, 0);
});
for (const mode of ['extra', 'missing', 'other-label', 'duplicate']) test(`rejects confounding ${mode} drift`, () => {
  const { entry, objects, target } = setup(); target.labels['dev.bsk.project'] = 'foreign';
  if (mode === 'extra') objects.push({ ...target, name: 'extra', id: 'extra' });
  if (mode === 'missing') objects.pop();
  if (mode === 'other-label') target.labels['dev.bsk.installation'] = 'foreign';
  if (mode === 'duplicate') objects[0].id = target.id;
  assert.throws(() => proveLabelMismatch(entry, objects, target.name, 'dev.bsk.project'));
});

test('partial Compose creation retains pending ownership uncertainty', async t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-label-failure-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const h = { root, socketDir: root, store: { snapshot: () => ({ entries: [] }) }, permit: { run: '1234-1' },
    imageRef: `localhost:5000/bsk-es2-fixture@sha256:${'a'.repeat(64)}`, save() {},
    docker: { inner() { throw new Error('synthetic create failure'); } } };
  await assert.rejects(runLabelDrift(h)); assert.equal(h.labelDriftPending, true);
});

test('pending label fixture prevents outer sandbox disposal', async () => {
  let removed = false;
  const h = new Harness({ run: '1234-1' }, { removeOwned() { removed = true; } });
  h.labelDriftPending = true; h.outerContainer = { id: 'sandbox' };
  await assert.rejects(h.cleanup(), e => e.code === 'CLEANUP_INCOMPLETE');
  assert.equal(removed, false);
});
