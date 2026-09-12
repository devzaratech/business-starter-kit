import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDependencyGraph } from '../lib/dependency-rules.mjs';

function record(name, kind, required = [], visibility = 'public') {
  return {
    path: `${name}/bsk.module.json`,
    manifest: {
      schemaVersion: '1.0',
      module: {
        name, version: '0.1.0', kind, visibility,
        freedomClass: visibility === 'public' ? 'F1' : 'F3',
        supportLevel: 'GA', license: visibility === 'public' ? 'Apache-2.0' : 'Proprietary'
      },
      compatibility: { bskPlatform: '1.x' },
      dependencies: { required, optional: [], forbiddenKinds: [] },
      capabilities: { provides: [], requires: [] }
    }
  };
}

test('kernel cannot depend on adapter', () => {
  const errors = validateDependencyGraph([
    record('kernel-security', 'kernel', ['postgres-adapter']),
    record('postgres-adapter', 'adapter')
  ]);
  assert.match(errors.join('\n'), /kernel-security.*adapter/);
});

test('public OSS module cannot depend on private extension', () => {
  const errors = validateDependencyGraph([
    record('audit', 'capability', ['sap-private']),
    record('sap-private', 'private-extension', [], 'private')
  ]);
  assert.match(errors.join('\n'), /public module audit.*private module sap-private/);
});

test('adapter may depend on public contract', () => {
  assert.deepEqual(validateDependencyGraph([
    record('storage-contract', 'contract'),
    record('s3-adapter', 'adapter', ['storage-contract'])
  ]), []);
});

test('reports unresolved required dependency', () => {
  assert.match(
    validateDependencyGraph([record('audit', 'capability', ['missing-module'])]).join('\n'),
    /unresolved required dependency missing-module/
  );
});
