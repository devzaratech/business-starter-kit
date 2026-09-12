import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManifestShape } from '../lib/module-manifest.mjs';

const validManifest = {
  schemaVersion: '1.0',
  module: {
    name: 'tenancy',
    version: '0.1.0',
    kind: 'capability',
    visibility: 'public',
    freedomClass: 'F1',
    supportLevel: 'GA',
    license: 'Apache-2.0'
  },
  compatibility: { bskPlatform: '1.x' },
  dependencies: {
    required: [],
    optional: [],
    forbiddenKinds: ['private-extension']
  },
  capabilities: {
    provides: ['tenancy'],
    requires: []
  }
};

test('accepts a complete BSK module manifest', () => {
  assert.deepEqual(validateManifestShape(validManifest), []);
});

test('rejects a manifest that mixes support level with freedom class', () => {
  const invalid = structuredClone(validManifest);
  invalid.module.freedomClass = 'GA';
  assert.match(validateManifestShape(invalid).join('\n'), /freedomClass/);
});

test('canonical schema declares the supported classifications', async () => {
  const schema = JSON.parse(
    await readFile(new URL('../../../contracts/schemas/bsk-module.schema.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(schema.properties.module.properties.freedomClass.enum, ['F1', 'F2', 'F3']);
  assert.deepEqual(schema.properties.module.properties.supportLevel.enum, ['GA', 'Preview', 'Lab']);
});

import { discoverManifests } from '../lib/discover-manifests.mjs';

const fixtureUrl = new URL('./fixtures/', import.meta.url);

test('discovers bsk.module.json recursively', async () => {
  const modules = await discoverManifests(new URL('valid/', fixtureUrl));
  assert.equal(modules.length, 1);
  assert.equal(modules[0].manifest.module.name, 'tenancy');
});

test('rejects duplicate module names', async () => {
  await assert.rejects(
    () => discoverManifests(new URL('invalid/', fixtureUrl)),
    /duplicate module name: duplicate-module/
  );
});
