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

test('package-lock registry URLs do not depend on private mirrors', async () => {
  const lockfile = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  const offenders = [];

  for (const [location, metadata] of Object.entries(lockfile.packages ?? {})) {
    const resolved = metadata?.resolved;
    if (typeof resolved !== 'string' || !resolved.startsWith('http')) continue;

    const url = new URL(resolved);
    const privateHost = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname.includes('.internal.');
    const mirrorPath = url.pathname.includes('/artifactory/api/npm/npm-public/');

    if (privateHost || mirrorPath) {
      offenders.push(`${location}: ${resolved}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `package-lock.json contains non-portable registry URLs:\n${offenders.join('\n')}`,
  );
});
