import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseManifest, validateManifestShape } from '../lib/module-manifest.mjs';

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

const invalidShapes = [
  ['numeric name', (m) => { m.module.name = 123; }, /module.*name/],
  ['array version', (m) => { m.module.version = ['1.2.3']; }, /module.*version/],
  ['null root', () => null, /object/],
  ['array root', () => [], /object/],
  ['string root', () => 'module', /object/],
  ['empty platform', (m) => { m.compatibility.bskPlatform = ''; }, /compatibility.*bskPlatform/],
  ['numeric platform', (m) => { m.compatibility.bskPlatform = 1; }, /compatibility.*bskPlatform/]
];
for (const objectPath of ['', 'module', 'compatibility', 'dependencies', 'capabilities']) {
  invalidShapes.push([`unknown property in ${objectPath || 'root'}`, (m) => {
    (objectPath ? m[objectPath] : m).unknown = true;
  }, /unknown|additional propert/]);
}
for (const [object, fields] of Object.entries({ dependencies: ['required', 'optional', 'forbiddenKinds'], capabilities: ['provides', 'requires'] })) {
  for (const field of fields) {
    for (const item of [null, 42, {}, ['nested'], false]) {
      invalidShapes.push([`${object}.${field} invalid item ${JSON.stringify(item)}`, (m) => { m[object][field] = [item]; }, new RegExp(`${object}.*${field}`)]);
    }
    invalidShapes.push([`${object}.${field} duplicate items`, (m) => { m[object][field] = ['duplicate', 'duplicate']; }, /unique|duplicate/]);
  }
}
for (const [name, mutate, diagnostic] of invalidShapes) {
  test(`canonical schema rejects ${name}`, () => {
    const candidate = structuredClone(validManifest);
    const replacement = mutate(candidate);
    const invalid = replacement === undefined ? candidate : replacement;
    assert.match(validateManifestShape(invalid).join('\n'), diagnostic);
  });
}

test('parse diagnostics preserve source filename and property path', () => {
  const invalid = structuredClone(validManifest);
  invalid.capabilities.provides = [false];
  assert.throws(() => parseManifest(JSON.stringify(invalid), 'packages/example/bsk.module.json'), /packages\/example\/bsk.module.json:[\s\S]*capabilities.*provides/);
});

test('parse diagnostics preserve source filename for malformed JSON', () => {
  assert.throws(() => parseManifest('{', 'broken/bsk.module.json'), /broken\/bsk.module.json: invalid JSON/);
});

test('changing only the canonical schema changes executable validation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'bsk-schema-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const libraryDir = join(root, 'scripts', 'architecture', 'lib');
  const schemaDir = join(root, 'contracts', 'schemas');
  await Promise.all([mkdir(libraryDir, { recursive: true }), mkdir(schemaDir, { recursive: true })]);
  const schema = JSON.parse(await readFile(new URL('../../../contracts/schemas/bsk-module.schema.json', import.meta.url), 'utf8'));
  schema.properties.module.properties.supportLevel.enum = ['TestOnlyLevel'];
  // Use the installed Ajv from the real checkout; only the schema location and
  // parser copy live in a temporary fixture. No repository files are mutated.
  const parserSource = (await readFile(new URL('../lib/module-manifest.mjs', import.meta.url), 'utf8'))
    .replace("'ajv/dist/2020.js'", JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('ajv/dist/2020.js')).href));
  const parserPath = join(libraryDir, 'module-manifest.mjs');
  await Promise.all([
    writeFile(join(schemaDir, 'bsk-module.schema.json'), JSON.stringify(schema)),
    writeFile(parserPath, parserSource)
  ]);
  const isolated = await import(pathToFileURL(parserPath).href);
  const candidate = structuredClone(validManifest);
  candidate.module.supportLevel = 'TestOnlyLevel';
  assert.deepEqual(isolated.validateManifestShape(candidate), []);
  assert.match(isolated.validateManifestShape(validManifest).join('\n'), /supportLevel/);
});
