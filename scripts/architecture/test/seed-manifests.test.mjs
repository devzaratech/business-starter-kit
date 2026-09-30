import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverManifests } from '../lib/discover-manifests.mjs';
import { validateDependencyGraph } from '../lib/dependency-rules.mjs';

test('core seed manifests exist and are public F1 Apache-2.0 Preview modules', async () => {
  const modules = await discoverManifests(new URL('../../../packages/', import.meta.url));
  const names = modules.map((m) => m.manifest.module.name);

  assert.deepEqual(names, ['audit', 'auth-rbac', 'core-domain', 'tenancy']);

  for (const { manifest } of modules) {
    assert.equal(manifest.module.visibility, 'public');
    assert.equal(manifest.module.freedomClass, 'F1');
    assert.equal(manifest.module.license, 'Apache-2.0');
    assert.equal(manifest.module.supportLevel, 'Preview');
    assert.equal(manifest.compatibility.bskPlatform, '1.x');
  }

  assert.deepEqual(validateDependencyGraph(modules), []);
});

test('placeholder core manifests do not advertise unimplemented dependencies or capabilities', async () => {
  const modules = await discoverManifests(new URL('../../../packages/', import.meta.url));
  for (const { manifest } of modules) {
    const name = manifest.module.name;
    assert.deepEqual(manifest.dependencies.required, [], `${name}: required`);
    assert.deepEqual(manifest.dependencies.optional, [], `${name}: optional`);
    assert.deepEqual(manifest.capabilities.provides, [], `${name}: provides`);
    assert.deepEqual(manifest.capabilities.requires, [], `${name}: requires`);
    for (const kind of ['runtime', 'adapter', 'deployment', 'application', 'reference-client', 'private-extension']) {
      assert.ok(manifest.dependencies.forbiddenKinds.includes(kind), `${name} still forbids ${kind}`);
    }
  }
});
