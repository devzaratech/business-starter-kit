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

test('optional public to private dependencies are rejected', () => {
  const source = record('runtime', 'runtime');
  source.manifest.dependencies.optional = ['private-contract'];
  const errors = validateDependencyGraph([
    source, record('private-contract', 'contract', [], 'private')
  ]);
  assert.match(errors.join('\n'), /public module runtime.*private module private-contract/);
});

test('optional dependencies obey forbiddenKinds', () => {
  const source = record('runtime', 'runtime');
  source.manifest.dependencies.optional = ['provider'];
  source.manifest.dependencies.forbiddenKinds = ['adapter'];
  assert.match(validateDependencyGraph([source, record('provider', 'adapter')]).join('\n'), /forbidden kind adapter/);
});

test('optional core to edge dependencies are rejected', () => {
  const source = record('kernel', 'kernel');
  source.manifest.dependencies.optional = ['provider'];
  assert.match(validateDependencyGraph([source, record('provider', 'adapter')]).join('\n'), /kernel.*must not depend on adapter/);
});

test('unresolved optional dependencies are allowed', () => {
  const source = record('runtime', 'runtime');
  source.manifest.dependencies.optional = ['absent'];
  assert.deepEqual(validateDependencyGraph([source]), []);
});

test('resolved optional public contracts are allowed', () => {
  const source = record('runtime', 'runtime');
  source.manifest.dependencies.optional = ['contract'];
  assert.deepEqual(validateDependencyGraph([source, record('contract', 'contract')]), []);
});

// Policy expectations are independent of the implementation table. See the
// corrective design for why side roles do not form a numeric layer ordering.
const allowedTargets = {
  contract: ['contract'],
  'extension-contract': ['contract', 'extension-contract'],
  kernel: ['contract', 'extension-contract', 'kernel'],
  'compliance-kernel': ['contract', 'extension-contract', 'kernel', 'compliance-kernel'],
  capability: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability'],
  observability: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability'],
  adapter: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'adapter'],
  runtime: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability', 'runtime', 'adapter'],
  'compliance-pack': ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'compliance-pack'],
  profile: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability', 'runtime', 'adapter', 'compliance-pack', 'profile'],
  application: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability', 'runtime', 'adapter', 'compliance-pack', 'profile', 'application'],
  'reference-client': ['contract', 'extension-contract', 'runtime', 'reference-client'],
  deployment: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability', 'runtime', 'adapter', 'compliance-pack', 'profile', 'application', 'reference-client', 'deployment', 'conformance'],
  conformance: ['contract', 'extension-contract', 'kernel', 'compliance-kernel', 'capability', 'observability', 'runtime', 'adapter', 'compliance-pack', 'profile', 'application', 'reference-client', 'deployment', 'conformance', 'private-extension'],
  'private-extension': ['contract', 'extension-contract', 'private-extension']
};

test('every kind pair obeys the explicit policy for required and optional edges', () => {
  for (const sourceKind of Object.keys(allowedTargets)) {
    for (const targetKind of Object.keys(allowedTargets)) {
      for (const edge of ['required', 'optional']) {
        const source = record('source', sourceKind);
        source.manifest.dependencies[edge] = ['target'];
        const errors = validateDependencyGraph([source, record('target', targetKind)]);
        assert.equal(errors.length === 0, allowedTargets[sourceKind].includes(targetKind), `${sourceKind} ${edge} -> ${targetKind}: ${errors}`);
      }
    }
  }
});

test('core cannot route back to runtimes through a profile', () => {
  const errors = validateDependencyGraph([
    record('core', 'capability', ['profile']),
    record('profile', 'profile', ['runtime']),
    record('runtime', 'runtime')
  ]);
  assert.match(errors.join('\n'), /core.*must not depend on profile/);
});

test('same-layer composition does not allow self-dependencies', () => {
  assert.match(validateDependencyGraph([record('one', 'kernel', ['one'])]).join('\n'), /self-dependency/);
});

test('unknown kinds fail closed instead of bypassing direction checks', () => {
  assert.match(validateDependencyGraph([record('one', 'typo')]).join('\n'), /unknown.*kind/);
});

test('required Freedom Class rules are independent from public visibility', () => {
  const allowed = { F1: ['F1'], F2: ['F1', 'F2'], F3: ['F1', 'F2', 'F3'] };
  for (const sourceClass of Object.keys(allowed)) {
    for (const targetClass of Object.keys(allowed)) {
      const source = record('source', 'runtime', ['target']);
      const target = record('target', 'contract');
      source.manifest.module.freedomClass = sourceClass;
      target.manifest.module.freedomClass = targetClass;
      target.manifest.module.license = targetClass === 'F3' ? 'Proprietary' : 'Apache-2.0';
      const errors = validateDependencyGraph([source, target]);
      assert.equal(errors.length === 0, allowed[sourceClass].includes(targetClass), `${sourceClass} requires ${targetClass}: ${errors}`);
    }
  }
});

test('optional public integrations may cross Freedom Classes without requiring them', () => {
  for (const sourceClass of ['F1', 'F2', 'F3']) {
    for (const targetClass of ['F1', 'F2', 'F3']) {
      const source = record('source', 'runtime');
      const target = record('target', 'contract');
      source.manifest.dependencies.optional = ['target'];
      source.manifest.module.freedomClass = sourceClass;
      target.manifest.module.freedomClass = targetClass;
      assert.deepEqual(validateDependencyGraph([source, target]), [], `${sourceClass} optionally uses ${targetClass}`);
    }
  }
});

test('an F1 required path cannot acquire F2 or F3 transitively', () => {
  for (const targetClass of ['F2', 'F3']) {
    const target = record('vendor', 'contract');
    target.manifest.module.freedomClass = targetClass;
    const errors = validateDependencyGraph([
      record('app', 'application', ['capability']),
      record('capability', 'capability', ['vendor']), target
    ]);
    assert.match(errors.join('\n'), /capability.*F1.*required.*vendor/);
  }
});

test('cross-class optional permission does not bypass public-private boundaries', () => {
  const source = record('source', 'runtime');
  source.manifest.dependencies.optional = ['target'];
  assert.match(validateDependencyGraph([source, record('target', 'contract', [], 'private')]).join('\n'), /public module source.*private module target/);
});

test('generic capability cannot depend on an observability backend', () => {
  for (const edge of ['required', 'optional']) {
    const source = record('audit', 'capability');
    source.manifest.dependencies[edge] = ['grafana'];
    assert.match(validateDependencyGraph([source, record('grafana', 'observability')]).join('\n'), /audit.*must not depend on observability/);
  }
});

test('telemetry contracts remain consumable without the reference distribution', () => {
  assert.deepEqual(validateDependencyGraph([
    record('audit', 'capability', ['otel-contract']),
    record('otel-contract', 'contract')
  ]), []);
});
