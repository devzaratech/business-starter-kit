import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bsk-supabase-studio-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts', 'supabase'), { recursive: true });
  await mkdir(join(root, 'supabase', 'config'), { recursive: true });

  for (const relativePath of [
    'scripts/supabase/use-env.sh',
    'scripts/supabase/studio-url.sh',
    'supabase/config/prod.toml'
  ]) {
    await copyFile(join(repositoryRoot, relativePath), join(root, relativePath));
  }
  return root;
}

function runUseEnv(root, overrides = {}) {
  const environment = { ...process.env, ...overrides };
  delete environment.ENV;
  delete environment.ENABLE_STUDIO;
  delete environment.CONFIRM_SUPABASE_PROD_STUDIO;
  Object.assign(environment, overrides);

  return spawnSync(
    process.env.BASH_PATH || 'bash',
    ['scripts/supabase/use-env.sh', 'prod'],
    { cwd: root, env: environment, encoding: 'utf8' }
  );
}

async function readStudioEnabled(root) {
  const config = await readFile(join(root, 'supabase', 'config.toml'), 'utf8');
  const studioSection = config.split('[studio]')[1]?.split(/^\[/m)[0] ?? '';
  return /^enabled\s*=\s*(true|false)$/m.exec(studioSection)?.[1];
}

test('generated prod config keeps Studio disabled by default', async (t) => {
  const root = await createFixture(t);
  const result = runUseEnv(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readStudioEnabled(root), 'false');
});

test('unconfirmed explicit prod Studio enable is rejected and stays disabled', async (t) => {
  const root = await createFixture(t);
  const result = runUseEnv(root, { ENABLE_STUDIO: 'yes' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to enable Supabase Studio for prod/);
  assert.equal(await readStudioEnabled(root), 'false');
});

test('confirmed explicit prod Studio enable succeeds', async (t) => {
  const root = await createFixture(t);
  const result = runUseEnv(root, {
    ENABLE_STUDIO: 'yes',
    CONFIRM_SUPABASE_PROD_STUDIO: 'yes'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readStudioEnabled(root), 'true');
});
