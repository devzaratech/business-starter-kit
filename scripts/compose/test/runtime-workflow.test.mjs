import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('runtime workflow requires manual owner authorization and an exact commit on a hosted runner', () => {
  const yaml = readFileSync(new URL('../../../.github/workflows/es2-runtime.yml', import.meta.url), 'utf8');
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(yaml, /^\s*(pull_request(?:_target)?|push|schedule|workflow_call|workflow_run):/m);
  for (const required of ["github.event_name == 'workflow_dispatch'", 'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner', 'inputs.expected_sha == github.sha',
    "inputs.confirm == 'AUTHORIZE_DISPOSABLE_ES2'", 'runs-on: ubuntu-24.04', 'timeout-minutes: 20',
    'persist-credentials: false', 'contents: read', 'if: always()', 'retention-days: 7']) assert.ok(yaml.includes(required), required);
  assert.doesNotMatch(yaml, /self-hosted|secrets\.|contents: write|actions: write|cancel-in-progress: true/);
  const commands = [...yaml.matchAll(/^\s+run: (.+)$/gm)].map(m => m[1]);
  assert.deepEqual(commands, ['npm ci --ignore-scripts', 'npm run compose:test', 'node scripts/compose/runtime/run.mjs']);
});

test('normal CI never invokes the mutating runtime entrypoint', () => {
  const yaml = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(yaml, /runtime\/run\.mjs|es2-runtime\.yml/);
  assert.match(yaml, /npm run compose:test/);
});

test('unauthorized local entrypoint exits before any filesystem or Docker effect', t => {
  const root = mkdtempSync(join(tmpdir(), 'bsk-runtime-deny-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = readdirSync(root);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../runtime/run.mjs', import.meta.url))],
    { cwd: root, env: { PATH: '', RUNNER_TEMP: root }, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error); assert.equal(result.status, 2); assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), { status: 'blocked', code: 'AUTHORIZATION' });
  assert.deepEqual(readdirSync(root), before);
});

test('input images are immutable and fixture source has no network dependency installation', () => {
  const images = JSON.parse(readFileSync(new URL('../runtime/images.json', import.meta.url)));
  for (const name of ['dind', 'python', 'registry']) assert.match(images[name], /^docker\.io\/library\/[a-z]+@sha256:[a-f0-9]{64}$/);
  const dockerfile = readFileSync(new URL('../runtime/fixture/Dockerfile', import.meta.url), 'utf8');
  assert.doesNotMatch(dockerfile, /RUN |ADD |curl|wget|pip |apt |apk /);
});
