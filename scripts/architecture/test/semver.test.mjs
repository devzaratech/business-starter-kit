import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateManifestShape } from '../lib/module-manifest.mjs';

const schema = JSON.parse(await readFile(new URL('../../../contracts/schemas/bsk-module.schema.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv2020({ strict: true }).compile(schema);
const seed = JSON.parse(await readFile(new URL('../../../packages/core-domain/bsk.module.json', import.meta.url), 'utf8'));
const validVersions = ['0.0.0', '1.2.3', '1.2.3-alpha.1+build.7', '1.2.3-0', '1.2.3-0A', '1.2.3+001', '1.2.3-x-y-z.--', '999999999999999999999.0.0'];
const invalidVersions = ['01.2.3', '1.02.3', '1.2.03', '1.2.3-01', '1.2.3-alpha..1', '1.2.3+build..1', '1.2.3-', '1.2.3+', '1.2.3-alpha+build+again', 'v1.2.3', '1.2', '1.2.3\n', '1.2.3 beta', '1.2.3-α'];

for (const [expected, versions] of [[true, validVersions], [false, invalidVersions]]) {
  for (const version of versions) {
    test(`SemVer ${expected ? 'accepts' : 'rejects'} ${JSON.stringify(version)} consistently`, () => {
      const manifest = structuredClone(seed);
      manifest.module.version = version;
      assert.equal(validateSchema(manifest), expected, 'canonical schema');
      assert.equal(validateManifestShape(manifest).length === 0, expected, 'executable validation');
    });
  }
}
