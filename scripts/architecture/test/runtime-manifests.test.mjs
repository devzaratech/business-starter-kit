import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverManifests } from '../lib/discover-manifests.mjs';

test('existing app runtimes have conservative Preview manifests', async () => {
  const modules = await discoverManifests(new URL('../../../apps/', import.meta.url));
  const byName = new Map(modules.map(({ manifest }) => [manifest.module.name, manifest]));

  assert.deepEqual([...byName.keys()].sort(), [
    'api-fastapi', 'api-node', 'api-php', 'api-spring', 'web-react', 'worker-node'
  ]);

  for (const name of ['api-fastapi', 'api-node', 'api-php', 'api-spring', 'worker-node']) {
    const manifest = byName.get(name);
    assert.equal(manifest.module.kind, 'runtime');
    assert.equal(manifest.module.supportLevel, 'Preview');
    assert.equal(manifest.module.visibility, 'public');
    assert.equal(manifest.module.freedomClass, 'F1');
    assert.equal(manifest.module.license, 'Apache-2.0');
    assert.deepEqual(manifest.dependencies.required, []);
  }

  const web = byName.get('web-react');
  assert.equal(web.module.kind, 'reference-client');
  assert.equal(web.module.supportLevel, 'Preview');
  assert.equal(web.module.license, 'Apache-2.0');
});
