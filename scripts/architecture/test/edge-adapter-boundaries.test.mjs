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

test('Caddy preflight has no direct filesystem, network or process execution dependency', async () => {
  const root = new URL('../../edge/adapters/caddy/', import.meta.url);
  const allowed = new Set(['node:util', './observe.mjs', './render.mjs', './resolve.mjs', './ports.d.ts',
    '../../lib/model.mjs', '../../lib/plan.mjs', '../../lib/ports.d.ts',
    '../../../compose/lib/plan.mjs', '../../../compose/lib/lifecycle.mjs']);
  for (const file of await readdir(root)) {
    if (!file.endsWith('.mjs')) continue;
    const source = await readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|WebSocket|require)\s*\(|\bprocess\s*\./, file);
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(allowed.has(match[1]), `${file} imports ${match[1]}`);
    }
  }
});
