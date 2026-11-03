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

for (const scenario of ['success', 'existing', 'create-failure', 'invalid-id', 'wrong-label', 'wrong-name', 'wrong-topology', 'attached', 'read-failure']) test(`unused ingress setup: ${scenario}`, async t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-label-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let plan; let objects = []; let serial = 0; let creations = 0; let removals = 0; let savedIngress;
  const id = () => createHash('sha256').update(String(++serial)).digest('hex');
  const tags = { 'dev.bsk.test-run': '1234-1', 'dev.bsk.test-role': 'expected-label-drift' };
  const h = { root, socketDir: root, store: { snapshot: () => ({ entries: [] }) }, permit: { run: '1234-1' }, imageRef: `localhost:5000/bsk-es2-fixture@sha256:${'a'.repeat(64)}`, aux: [],
    save(name, value) { if (name === 'label-drift-plan') plan = value; if (name === 'label-drift-ingress') savedIngress = value; },
    reader: { resources() {
      if (scenario === 'read-failure' || !objects.some(o => o.name === plan.compose.networks.ingress.name)) throw Object.assign(new Error('DOCKER_READ'), { code: 'DOCKER_READ' });
      return structuredClone(objects);
    } } };
  h.docker = {
    inner(args) {
      // Compose does not create networks unused by every service.
      if (args[0] === 'compose') {
        objects = runtimeObjects(plan).filter(o => o.name !== plan.compose.networks.ingress.name).map(o => ({ ...o, id: id(), labels: { ...o.labels, ...tags } }));
        if (scenario === 'existing') objects.push({ kind: 'network', name: plan.compose.networks.ingress.name, id: id(), labels: { foreign: 'true' } });
        return { stdout: '' };
      }
      if (args[1] === 'ls') {
        assert.deepEqual(args, ['network', 'ls', '--format', '{{.Name}}']);
        return { stdout: objects.filter(o => o.kind === 'network').map(o => o.name).join('\n') };
      }
      assert.deepEqual(args.slice(0, 5), ['network', 'create', '--internal', '--driver', 'bridge']);
      creations++;
      if (scenario === 'create-failure') throw Object.assign(new Error('DOCKER_COMMAND'), { code: 'DOCKER_COMMAND' });
      const labels = {}; args.forEach((a, i) => { if (a === '--label') { const [k, v] = args[i + 1].split('='); labels[k] = v; } });
      const network = { kind: 'network', name: args.at(-1), id: id(), internal: true, driver: 'bridge', attachments: [], labels: { ...labels } };
      if (scenario === 'wrong-label') network.labels['dev.bsk.test-run'] = 'foreign';
      if (scenario === 'wrong-name') network.name = 'foreign';
      if (scenario === 'wrong-topology') network.internal = false;
      objects.push(network); return { stdout: scenario === 'invalid-id' ? 'invalid' : network.id };
    },
    inspect(record) {
      const o = objects.find(o => o.id === record.id); assert.ok(o); verifyOwner({ Id: o.id, Labels: o.labels }, record);
      return { Id: o.id, Name: o.name, Labels: o.labels, Internal: o.internal, Driver: o.driver, Containers: scenario === 'attached' ? { foreign: {} } : {} };
    },
    removeOwned(record) { removals++; this.inspect(record); objects = objects.filter(o => o.id !== record.id); }
  };
  if (scenario !== 'success') {
    const codes = { existing: 'DRIFT_NETWORK_EXISTS', 'create-failure': 'DOCKER_COMMAND', 'invalid-id': 'DRIFT_ID', 'wrong-label': 'OWNERSHIP', 'wrong-name': 'DRIFT_NETWORK_TOPOLOGY', 'wrong-topology': 'DRIFT_NETWORK_TOPOLOGY', attached: 'DRIFT_NETWORK_TOPOLOGY', 'read-failure': 'DOCKER_READ' };
    await assert.rejects(runLabelDrift(h), e => e.code === codes[scenario]);
    assert.equal(h.labelDriftPending, true); assert.equal(h.aux.length, scenario === 'read-failure' ? 1 : 0); assert.equal(removals, 0);
    assert.equal(creations, scenario === 'existing' ? 0 : 1);
    return;
  }
  const evidence = await runLabelDrift(h);
  assert.equal(creations, 3); assert.equal(savedIngress.name, plan.compose.networks.ingress.name);
  assert.match(savedIngress.id, /^[a-f0-9]{64}$/); assert.equal(savedIngress.labels['dev.bsk.test-run'], h.permit.run);
  assert.equal(savedIngress.labels['com.docker.compose.project'], plan.scope);
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
