import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

test('GitHub Actions and Jenkins enforce the same architecture commands', async () => {
  const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
  const [githubCi, jenkins] = await Promise.all([
    readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8'),
    readFile(resolve(root, 'Jenkinsfile'), 'utf8')
  ]);

  for (const command of ['npm run architecture:test', 'npm run architecture:check']) {
    assert.match(githubCi, new RegExp(command.replace(':', '\\:')));
    assert.match(jenkins, new RegExp(command.replace(':', '\\:')));
  }

  assert.match(githubCi, /architecture-guardrails/);
});

test('both CI engines install locked schema dependencies before architecture tests', async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  for (const file of ['.github/workflows/ci.yml', 'Jenkinsfile']) {
    const pipeline = await readFile(resolve(root, file), 'utf8');
    const install = pipeline.indexOf('npm ci');
    const tests = pipeline.indexOf('npm run architecture:test');
    assert.ok(install >= 0 && install < tests, `${file} must install before architecture tests`);
  }
});

test('PR CI includes the actual Foundation Guardrails base', async () => {
  const pipeline = await readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const pullRequests = pipeline.split('  pull_request:')[1]?.split('  push:')[0] ?? '';
  assert.match(pullRequests, /^      - chore\/multi-env-hardening$/m);
});

test('architecture CI covers Windows and Node 20', async () => {
  const pipeline = await readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const architecture = pipeline.split('  architecture-guardrails:')[1]?.split('  spring-api-tests:')[0] ?? '';
  assert.match(architecture, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(architecture, /runs-on: \$\{\{ matrix\.os \}\}/);
  assert.match(architecture, /node-version: '20'/);
});

test('architecture:test uses native discovery without shell wildcard expansion', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['architecture:test'], 'cd scripts/architecture && node --test');
});

test('CI and local quality gates run the real env-aware infrastructure tests', async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['infrastructure:test'], 'cd scripts/quality && node --test');

  for (const file of [
    '.github/workflows/ci.yml',
    'Jenkinsfile',
    'Makefile',
    'scripts/quality/run-all-tests.sh'
  ]) {
    const pipeline = await readFile(resolve(root, file), 'utf8');
    assert.match(pipeline, /npm run infrastructure:test/, `${file} must run real-input infrastructure tests`);
  }

  const githubCi = await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8');
  const composeJob = githubCi.split('  docker-compose-validation:')[1]?.split('  sonarqube:')[0] ?? '';
  assert.match(composeJob, /node-version: '20'/);
});
