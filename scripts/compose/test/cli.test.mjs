import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { request, host } from '../test-support/fixtures.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'bsk-es2-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, value] of [['a.json', request()], ['b.json', request('fixture-b')], ['host.json', host()]]) writeFileSync(join(root, file), JSON.stringify(value));
  return root;
}
function run(root, args) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.ifError(r.error); return r;
}
test('offline plan works from any cwd and writes no inventory/config files', t => {
  const root = setup(t); const files = readdirSync(root); const r = run(root, ['plan', 'a.json']);
  assert.equal(r.status, 0, r.stderr); const p = JSON.parse(r.stdout);
  assert.equal(p.runtime, 'not-observed'); assert.equal(p.compose.services.db.ports, undefined);
  assert.deepEqual(readdirSync(root), files);
});
test('explicit local init and claims persist; failed A claim preserves B', t => {
  const root = setup(t);
  assert.equal(run(root, ['init', 'state', 'host.json']).status, 0);
  assert.equal(run(root, ['claim', 'state', 'b.json', '0']).status, 0);
  const before = readFileSync(join(root, 'state', 'inventory.json'));
  const r = run(root, ['claim', 'state', 'a.json', '0']);
  assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).code, 'STALE_REVISION');
  assert.deepEqual(readFileSync(join(root, 'state', 'inventory.json')), before);
  assert.equal(JSON.parse(run(root, ['inventory', 'state']).stdout).entries.length, 1);
});
for (const args of [[], ['apply', 'a.json'], ['prune'], ['plan', 'a.json', '--apply'], ['exec', 'state'], ['plan', 'https://secret.test/input']]) {
  test(`rejects unsupported operation ${args[0] ?? 'empty'}`, t => {
    const root = setup(t); const before = readdirSync(root); const r = run(root, args);
    assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.equal(JSON.parse(r.stderr).code, 'USAGE');
    assert.deepEqual(readdirSync(root), before);
  });
}
test('malformed and oversized input errors never echo file contents', t => {
  const root = setup(t);
  for (const content of ['fake-secret-not-json', ' '.repeat(1048577)]) {
    writeFileSync(join(root, 'bad.json'), content); const r = run(root, ['plan', 'bad.json']);
    assert.equal(r.status, 2); assert.doesNotMatch(r.stderr, /fake-secret/); assert.equal(r.stdout, '');
  }
});
