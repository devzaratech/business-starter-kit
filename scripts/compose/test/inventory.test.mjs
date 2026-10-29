import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { Inventory } from '../lib/inventory.mjs';
import { request, host } from '../test-support/fixtures.mjs';

function setup(t, h = host()) {
  const root = fs.mkdtempSync(join(tmpdir(), 'bsk-es2-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  Inventory.initialize(root, h); return { root, store: new Inventory(root) };
}
const denies = (fn, code) => assert.throws(fn, e => e.code === code);

test('persists exact plans and returns detached inventory snapshots', t => {
  const { root, store } = setup(t); const result = store.claim(request(), 0);
  assert.equal(result.revision, 1);
  assert.equal(new Inventory(root).snapshot().entries.length, 1);
  result.entries[0].plan.scope = 'tampered';
  assert.notEqual(store.snapshot().entries[0].plan.scope, 'tampered');
});
test('idempotent replay does not allocate twice; conflicting identity and stale revision deny', t => {
  const { store } = setup(t); store.claim(request(), 0);
  assert.equal(store.claim(request(), 1).revision, 1);
  const other = request(); other.target.deploymentRef = 'another';
  denies(() => store.claim(other, 1), 'IDENTITY_CONFLICT');
  denies(() => store.claim(request('fixture-b'), 0), 'STALE_REVISION');
  assert.equal(store.snapshot().entries.length, 1);
});
test('failed admission of A leaves B record and inventory bytes unchanged', t => {
  const { root, store } = setup(t); store.claim(request('fixture-b'), 0);
  const before = fs.readFileSync(join(root, 'inventory.json'));
  const bad = request(); bad.workloads[0].resources.memoryLimitBytes = 1073741824;
  denies(() => store.claim(bad, 1), 'CAPACITY');
  assert.deepEqual(fs.readFileSync(join(root, 'inventory.json')), before);
  assert.equal(store.snapshot().entries[0].plan.target.projectRef, 'fixture-b');
});
test('corrupt or forged registry, duplicate scopes and host changes fail closed', t => {
  const { root, store } = setup(t); store.claim(request(), 0);
  const file = join(root, 'inventory.json'); const baseline = fs.readFileSync(file);
  for (const mutate of [s => { s.entries[0].plan.usage.cpuMillis = 1; },
    s => { s.entries.push(structuredClone(s.entries[0])); },
    s => { s.host.hostRef = 'foreign'; }, s => { s.revision = -1; },
    s => { s.extra = true; }, s => { s.entries[0].admission.enforced = 'supported'; }]) {
    const s = JSON.parse(baseline); mutate(s); fs.writeFileSync(file, JSON.stringify(s));
    denies(() => store.snapshot(), 'CORRUPT_INVENTORY');
  }
  fs.writeFileSync(file, '{'); denies(() => store.snapshot(), 'CORRUPT_INVENTORY');
});
test('existing locks are never stolen or expired automatically', t => {
  const { root, store } = setup(t); fs.writeFileSync(join(root, '.lock'), 'stale-or-active');
  denies(() => store.claim(request(), 0), 'INVENTORY_BUSY');
  assert.equal(fs.readFileSync(join(root, '.lock'), 'utf8'), 'stale-or-active');
});
test('write failure before rename preserves all existing claims', t => {
  const { root, store } = setup(t); store.claim(request('fixture-b'), 0);
  const before = fs.readFileSync(join(root, 'inventory.json'));
  try {
    t.mock.method(fs, 'renameSync', () => { throw new Error('injected disk failure'); });
    syncBuiltinESMExports();
    denies(() => store.claim(request(), 1), 'INVENTORY_WRITE');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.deepEqual(fs.readFileSync(join(root, 'inventory.json')), before);
  assert.deepEqual(fs.readdirSync(root), ['inventory.json']);
});
test('requires an initialized registry and rejects reinitialization', t => {
  const root = fs.mkdtempSync(join(tmpdir(), 'bsk-es2-empty-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  denies(() => new Inventory(root).snapshot(), 'CORRUPT_INVENTORY');
  Inventory.initialize(root, host()); denies(() => Inventory.initialize(root, host()), 'ALREADY_INITIALIZED');
});
test('real processes cannot race past atomic capacity and ownership admission', async t => {
  const h = host(); h.capacity.cpuMillis = 1000;
  const { root, store } = setup(t, h);
  const moduleUrl = new URL('../lib/inventory.mjs', import.meta.url).href;
  const fixtureUrl = new URL('../test-support/fixtures.mjs', import.meta.url).href;
  const launch = project => new Promise((resolve, reject) => {
    const code = `import {Inventory} from ${JSON.stringify(moduleUrl)}; import {request} from ${JSON.stringify(fixtureUrl)}; try {new Inventory(${JSON.stringify(root)}).claim(request(${JSON.stringify(project)}),0);process.exitCode=0;}catch(e){process.stdout.write(e.code);process.exitCode=1;}`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code]);
    let out = ''; child.stdout.on('data', d => { out += d; });
    child.on('error', reject); child.on('close', status => resolve({ status, out }));
  });
  const results = await Promise.all([launch('fixture-a'), launch('fixture-b')]);
  assert.equal(results.filter(r => r.status === 0).length, 1);
  assert.match(results.find(r => r.status !== 0).out, /INVENTORY_BUSY|STALE_REVISION|CAPACITY/);
  assert.equal(store.snapshot().entries.length, 1);
  assert.equal(store.snapshot().revision, 1);
});
