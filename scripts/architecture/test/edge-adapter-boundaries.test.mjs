import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('provider-neutral edge code never imports an ingress adapter', async () => {
  const root = new URL('../../edge/lib/', import.meta.url);
  for (const file of await readdir(root)) {
    if (!/\.(?:mjs|ts)$/.test(file)) continue;
    const source = await readFile(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.doesNotMatch(match[1], /(?:adapters|caddy|nginx|traefik)/i, `${file} must depend inward on contracts`);
    }
  }
});
