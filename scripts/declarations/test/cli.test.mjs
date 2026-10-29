import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, snapshot } from '../test-support/helpers.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'bsk-es1-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'bundle.json'), JSON.stringify(fixture()));
  writeFileSync(join(root, '.env'), 'FAKE_SECRET=never-read-this\n');
  return root;
}
function run(root, args, overrides = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, BUSINESS_STARTER_ENV: 'prod', BSK_SECRET: 'never-read-this', ...overrides } });
  assert.ifError(r.error);
  return r;
}

for (const command of ['validate', 'plan']) {
  test(`${command} works from an unrelated cwd and does not change files`, t => {
    const root = setup(t); const before = snapshot(root);
    const r = run(root, [command, 'bundle.json']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    const output = JSON.parse(r.stdout);
    if (command === 'validate') assert.deepEqual(output, { valid: true, diagnostics: [] });
    else { assert.equal(output.mode, 'dry-run'); assert.equal(output.actions.length, 6); }
    assert.doesNotMatch(r.stdout, /never-read-this/);
    assert.deepEqual(snapshot(root), before);
  });
  test(`${command} exits 1 for invalid declarations with JSON diagnostics`, t => {
    const root = setup(t);
    writeFileSync(join(root, 'bundle.json'), JSON.stringify(fixture('invalid-cross-project')));
    const before = snapshot(root); const r = run(root, [command, 'bundle.json']);
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '');
    const output = JSON.parse(r.stdout);
    assert.ok(output.diagnostics.some(d => d.code === 'UNRESOLVED_REFERENCE'));
    if (command === 'plan') { assert.deepEqual(output.actions, []); assert.equal(output.planId, null); }
    else assert.equal(output.valid, false);
    assert.deepEqual(snapshot(root), before);
  });
}

test('plan bytes match across processes, resource order and differing environment variables', t => {
  const root = setup(t); const before = run(root, ['plan', 'bundle.json']);
  const b = fixture(); b.resources.reverse(); b.catalog.routes.reverse();
  writeFileSync(join(root, 'bundle.json'), JSON.stringify(b));
  const after = run(root, ['plan', 'bundle.json'], { BUSINESS_STARTER_ENV: 'sandbox', BSK_SECRET: 'different' });
  assert.equal(before.status, 0); assert.equal(after.status, 0);
  assert.equal(before.stdout, after.stdout);
});

for (const args of [[], ['validate'], ['plan', 'bundle.json', 'extra'], ['apply', 'bundle.json'],
  ['down', 'bundle.json'], ['destroy', 'bundle.json'], ['--help'], ['validate', '--apply'],
  ['plan', 'bundle.json', '--output', 'out.json'], ['validate', '-'],
  ['plan', 'https://fake-secret.test/bundle'], ['validate', '//fake-secret/share/bundle.json'],
  ['plan', '\\\\fake-secret\\share\\bundle.json']]) {
  test(`rejects unsupported command or file argument ${JSON.stringify(args)}`, t => {
    const root = setup(t); const before = snapshot(root); const r = run(root, args);
    assert.equal(r.status, 2); assert.equal(r.stdout, '');
    assert.equal(JSON.parse(r.stderr).code, 'USAGE');
    assert.doesNotMatch(r.stderr, /fake-secret/);
    assert.deepEqual(snapshot(root), before);
  });
}

for (const [name, contents, code] of [
  ['malformed JSON', '{"value":"fake-secret"', 'JSON'],
  ['non-JSON env file', 'FAKE_SECRET=fake-secret', 'JSON'],
  ['malformed UTF-8', Buffer.from([0xff, 0xfe, 0x7b, 0x7d]), 'JSON'],
  ['oversized ASCII', ' '.repeat(1048577), 'SIZE'],
  ['oversized UTF-8', 'é'.repeat(524289), 'SIZE']
]) {
  test(`reports ${name} without echoing content`, t => {
    const root = setup(t); writeFileSync(join(root, 'bundle.json'), contents);
    const before = snapshot(root); const r = run(root, ['validate', 'bundle.json']);
    assert.equal(r.status, 2); assert.equal(r.stdout, '');
    assert.equal(JSON.parse(r.stderr).code, code);
    assert.doesNotMatch(r.stderr, /fake-secret/);
    assert.deepEqual(snapshot(root), before);
  });
}

test('accepts a valid file at exactly 1 MiB', t => {
  const root = setup(t); const data = JSON.stringify(fixture());
  writeFileSync(join(root, 'bundle.json'), data.padEnd(1048576));
  const r = run(root, ['validate', 'bundle.json']);
  assert.equal(r.status, 0, r.stderr);
});

for (const file of ['missing-fake-secret.json', '.']) {
  test(`read error is redacted for ${file}`, t => {
    const root = setup(t); const r = run(root, ['plan', file]);
    assert.equal(r.status, 2); assert.equal(r.stdout, '');
    assert.equal(JSON.parse(r.stderr).code, 'READ');
    assert.doesNotMatch(r.stderr, /fake-secret|bsk-es1-cli-/);
  });
}
