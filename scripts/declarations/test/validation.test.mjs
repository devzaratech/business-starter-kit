import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBundle } from '../lib/validate.mjs';
import { fixture, resources } from './helpers.mjs';

function denied(bundle, code) {
  const result = validateBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.length > 0);
  if (code) assert.ok(result.diagnostics.some((d) => d.code === code), JSON.stringify(result));
  for (const d of result.diagnostics) {
    assert.equal(typeof d.code, 'string');
    assert.equal(typeof d.message, 'string');
    assert.match(d.path, /^\//);
  }
  return result;
}

for (const count of [1, 5, 10]) {
  test(`accepts two independent projects with ${count} arbitrary environments each`, () => {
    const bundle = fixture();
    const names = ['review-142', 'sandbox', 'perf-lab', ...Array.from({ length: 7 }, (_, i) => `preview-${i}`)];
    for (const project of ['fixture-a', 'fixture-b']) {
      for (const name of names.slice(1, count)) {
        bundle.resources.push({ apiVersion: 'bsk/v0alpha1', kind: 'Environment',
          metadata: { name, installationRef: 'fixture-install', projectRef: project },
          spec: { policyRef: 'disposable' } });
      }
    }
    assert.deepEqual(validateBundle(bundle), { valid: true, diagnostics: [] });
  });
}

test('same names in separate installations are independent', () => {
  const bundle = fixture();
  const copy = structuredClone(bundle);
  for (const r of copy.resources) r.metadata.installationRef = 'other-install';
  for (const r of copy.catalog.routes) r.installationRef = 'other-install';
  bundle.resources.push(...copy.resources);
  bundle.catalog.routes.push(...copy.catalog.routes);
  assert.equal(validateBundle(bundle).valid, true);
});

test('validates resources without mutating or normalizing the input', () => {
  const bundle = fixture();
  bundle.resources[4].spec.resources = resources();
  bundle.resources[4].spec.secretRefs = ['opaque-b', 'opaque-a'];
  bundle.resources[0].spec.budgetRef = 'future-budget';
  bundle.resources[2].spec.quotaRef = 'future-quota';
  bundle.resources[2].spec.placementRef = 'future-placement';
  const before = JSON.stringify(bundle);
  assert.equal(validateBundle(bundle).valid, true);
  assert.equal(JSON.stringify(bundle), before);
});

const mutations = [
  ['unknown bundle field', b => { b.extra = true; }],
  ['wrong bundle version', b => { b.apiVersion = 'bsk/v1'; }],
  ['wrong resource version', b => { b.resources[0].apiVersion = '1.0'; }],
  ['future resource kind', b => { b.resources[0].kind = 'Deployment'; }],
  ['status input', b => { b.resources[0].status = {}; }],
  ['unknown metadata', b => { b.resources[0].metadata.uid = 'fake'; }],
  ['unknown spec', b => { b.resources[4].spec.command = 'fake-secret-command'; }],
  ['unknown catalog field', b => { b.catalog.hosts = []; }],
  ['unknown route field', b => { b.catalog.routes[0].upstream = 'http://fake-secret'; }],
  ['missing owner', b => { delete b.resources[0].spec.ownerRef; }],
  ['wrong type port', b => { b.resources[4].spec.port = '8080'; }],
  ['unknown project metadata scope', b => { b.resources[0].metadata.projectRef = 'fixture-a'; }],
  ['unexpected service environment', b => { b.resources[4].metadata.environmentRef = 'review-142'; }],
  ['missing catalog', b => { delete b.catalog; }],
  ['duplicate runtime', b => { b.catalog.runtimes.push('fixture-http'); }],
  ['duplicate policy', b => { b.catalog.policies.push('disposable'); }],
  ['bad catalog identity', b => { b.catalog.policies = ['../outside']; }],
  ['duplicate secret reference', b => { b.resources[4].spec.secretRefs = ['same', 'same']; }],
  ['inline secret', b => { b.resources[4].spec.secretRefs = [{ value: 'fake-secret' }]; }],
  ['port zero', b => { b.resources[4].spec.port = 0; }],
  ['port overflow', b => { b.resources[4].spec.port = 65536; }],
  ['route nonboolean', b => { b.catalog.routes[0].stripPrefix = 'false'; }],
  ['route missing visibility', b => { delete b.catalog.routes[0].visibility; }]
];
for (const [name, mutate] of mutations) {
  test(`rejects ${name}`, () => { const b = fixture(); mutate(b); denied(b, 'SCHEMA'); });
}
for (const value of [null, [], false, 'fake-secret', 42]) {
  test(`rejects non-object root ${JSON.stringify(value)}`, () => denied(value, 'SCHEMA'));
}
for (const name of ['', 'UPPER', 'review-142\n', '../prod', 'a/b', '-bad', 'bad-', 'a'.repeat(64), 'a b', 'a;exec']) {
  test(`rejects malformed identifier ${JSON.stringify(name)}`, () => {
    const b = fixture(); b.resources[2].metadata.name = name; denied(b, 'SCHEMA');
  });
}

test('rejects duplicate scoped resources', () => {
  const b = fixture(); b.resources.push(structuredClone(b.resources[0])); denied(b, 'DUPLICATE_RESOURCE');
});
for (const [name, mutate] of [
  ['missing project', b => { b.resources.splice(0, 1); }],
  ['wrong installation', b => { b.resources[2].metadata.installationRef = 'other'; }],
  ['cross-project service fixture', () => {}],
  ['unknown policy', b => { b.resources[2].spec.policyRef = 'unknown'; }],
  ['unknown runtime', b => { b.resources[4].spec.runtimeRef = 'unknown'; }],
  ['unknown route service', b => { b.catalog.routes[0].serviceRef = 'unknown'; }],
  ['unknown route environment', b => { b.catalog.routes[0].environmentRef = 'sandbox'; }],
  ['route installation mismatch', b => { b.catalog.routes[0].installationRef = 'other'; }],
  ['route cannot borrow service from another project', b => { b.resources.splice(4, 1); }]
]) {
  test(`denies ${name}`, () => {
    const b = name === 'cross-project service fixture' ? fixture('invalid-cross-project') : fixture();
    mutate(b); denied(b, 'UNRESOLVED_REFERENCE');
  });
}

test('allows nested path claims for the same hostname owner', () => {
  const b = fixture(); b.catalog.routes.push({ ...b.catalog.routes[0], pathPrefix: '/api' });
  assert.equal(validateBundle(b).valid, true);
});
for (const [name, mutate, code] of [
  ['exact duplicate', r => r, 'DUPLICATE_ROUTE'],
  ['visibility cannot bypass exclusivity', r => ({ ...r, visibility: 'private' }), 'DUPLICATE_ROUTE'],
  ['another project cannot capture nested path', r => ({ ...r, projectRef: 'fixture-b', pathPrefix: '/other' }), 'HOSTNAME_OWNERSHIP'],
  ['another environment cannot capture hostname', r => ({ ...r, environmentRef: 'sandbox', pathPrefix: '/api' }), 'HOSTNAME_OWNERSHIP']
]) {
  test(`denies route ${name}`, () => {
    const b = fixture();
    b.resources.push({ ...structuredClone(b.resources[2]), metadata: { ...b.resources[2].metadata, name: 'sandbox' } });
    b.catalog.routes.push(mutate({ ...b.catalog.routes[0] })); denied(b, code);
  });
}
for (const hostname of ['localhost', 'UPPER.test', 'a.test.', '*.test', '127.0.0.1', '::1', 'a.test:80', 'user@a.test', 'https://a.test', 'a..test', '-a.test', 'a-.test', 'é.test', `${'a'.repeat(64)}.test`, `${('a'.repeat(63) + '.').repeat(4)}test`, 'a.test\n']) {
  test(`rejects unsafe hostname ${JSON.stringify(hostname)}`, () => {
    const b = fixture(); b.catalog.routes[0].hostname = hostname; denied(b, 'SCHEMA');
  });
}
for (const pathPrefix of ['/a/', '//a', '/a//b', '/.', '/../x', '/a%2fb', '/a?x', '/a#x', '/a.*', 'api', '/a\n']) {
  test(`rejects unsafe route path ${JSON.stringify(pathPrefix)}`, () => {
    const b = fixture(); b.catalog.routes[0].pathPrefix = pathPrefix; denied(b, 'SCHEMA');
  });
}
for (const field of Object.keys(resources())) {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '10']) {
    test(`rejects unsafe ${field} ${String(value)}`, () => {
      const b = fixture(); b.resources[4].spec.resources = { ...resources(), [field]: value }; denied(b, 'SCHEMA');
    });
  }
}
test('rejects incomplete and open resource objects', () => {
  const b = fixture(); b.resources[4].spec.resources = { replicas: 1 }; denied(b, 'SCHEMA');
  b.resources[4].spec.resources = { ...resources(), gpu: 1 }; denied(b, 'SCHEMA');
});
for (const field of ['cpuRequestMillis', 'memoryRequestBytes']) {
  test(`rejects ${field} greater than its limit`, () => {
    const b = fixture(); b.resources[4].spec.resources = { ...resources(), [field]: 10000 }; denied(b, 'RESOURCE_BOUNDS');
  });
}
test('rejects overflow when multiplying limits by replicas', () => {
  const b = fixture(); b.resources[4].spec.resources = { ...resources(), memoryLimitBytes: Number.MAX_SAFE_INTEGER }; denied(b, 'RESOURCE_OVERFLOW');
});
test('rejects overflow in aggregate declared resources', () => {
  const b = fixture();
  for (const r of b.resources.filter(r => r.kind === 'Service')) r.spec.resources = { ...resources(), replicas: 1, memoryLimitBytes: Number.MAX_SAFE_INTEGER };
  denied(b, 'RESOURCE_OVERFLOW');
});
test('rejects combined resource and route count above 1000 before graph checks', () => {
  const b = fixture(); b.resources = Array.from({ length: 999 }, () => null); denied(b, 'BUNDLE_LIMIT');
});
test('diagnostics do not echo values and are reproducibly ordered', () => {
  const b = fixture(); b.resources[4].spec.runtimeRef = 'fake-secret-runtime';
  b.resources[2].spec.policyRef = 'fake-secret-policy';
  const result = denied(b);
  assert.deepEqual(validateBundle(b), result);
  assert.doesNotMatch(JSON.stringify(result), /fake-secret/);
  assert.ok(result.diagnostics.some(d => d.path === '/resources/2/spec/policyRef'));
});
