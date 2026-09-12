import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

test('repository npm config uses the public registry and replaces lockfile registry hosts', async () => {
  const npmrc = await readFile(resolve(root, '.npmrc'), 'utf8');
  const lines = npmrc
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.ok(
    lines.includes('registry=https://registry.npmjs.org/'),
    '.npmrc must pin the public npm registry for reproducible OSS installs',
  );
  assert.ok(
    lines.includes('replace-registry-host=always'),
    '.npmrc must replace registry hosts recorded by mirrors/proxies',
  );
});
