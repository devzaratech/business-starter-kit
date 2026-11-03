import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPlan } from '../lib/plan.mjs';
import { secretMounts, validateSecretMount } from '../lib/secrets.mjs';
import { request } from '../test-support/fixtures.mjs';
import { runtimeObjects } from '../test-support/runtime.mjs';
import { inspectLimits } from '../lib/lifecycle.mjs';
import { SyntheticSecrets, grantSyntheticReferences } from '../runtime/synthetic-secrets.mjs';
import { fixtures } from '../runtime/fixtures.mjs';

export function secretRequest() {
  const input = request(); input.declarations.resources.find(r => r.kind === 'Service' && r.metadata.projectRef === input.target.projectRef).spec.secretRefs = ['token'];
  input.secretProvider = { kind: 'disposable-synthetic', bindings: [{ installationRef: input.target.installationRef,
    projectRef: input.target.projectRef, environmentRef: input.target.environmentRef, serviceRef: 'http', ref: 'token' }] };
  return input;
}
test('positive references remain opaque and default path rejects them', () => {
  const input = secretRequest(); const plan = buildPlan(input);
  assert.equal(plan.workloads.find(w => w.name === 'http').secretRefs[0], 'token');
  assert.equal(secretMounts(plan, 'http')[0].target, '/run/secrets/token');
  assert.equal(secretMounts(plan, 'db').length, 0);
  delete input.secretProvider; assert.throws(() => buildPlan(input), e => e.code === 'SECRETS_UNSUPPORTED');
});

test('lifecycle rejects missing, writable or extra secret observations', () => {
  const plan = buildPlan(secretRequest()); const objects = runtimeObjects(plan);
  const o = objects.find(o => o.labels['dev.bsk.service'] === 'http');
  const entry = { plan, admission: { requested: plan.requested, admitted: plan.usage } };
  assert.throws(() => inspectLimits(entry, objects));
  o.secretMounts = secretMounts(plan, 'http'); assert.equal(inspectLimits(entry, objects).configurationMatches, true);
  o.secretMounts[0].readOnly = false; assert.throws(() => inspectLimits(entry, objects));
});
test('provider requires authorization and registration, never exports generated material', () => {
  const p = buildPlan(secretRequest()); const calls = [];
  const h = { authorization: { disposable: true, engineId: 'inner' }, outerContainer: { id: 'sandbox' },
    recordFor: () => ({ id: 'owned-container' }),
    docker: { innerId: 'inner', inspect() {}, outer(args) { calls.push(args); return { stdout: '' }; } } };
  const provider = new SyntheticSecrets(h); const mount = secretMounts(p, 'http')[0];
  assert.throws(() => provider.verify(p, 'http', mount));
  provider.prepare([p]); assert.equal(provider.verify(p, 'http', mount), true);
  provider.audit([p], JSON.stringify({ plan: p }));
  assert.throws(() => provider.audit([p], ' '.repeat(1048577)));
  const execute = h.docker.outer;
  h.docker.outer = () => { throw Object.assign(new Error('Synthetic command failed.'), { code: 'DOCKER_COMMAND' }); };
  assert.throws(() => provider.audit([p], '{}'), e => e.code === 'DOCKER_COMMAND');
  h.docker.outer = execute;
  assert.ok(calls.some(args => args.some(a => a.includes('/dev/urandom'))));
  assert.ok(calls.some(args => args.some(a => a.includes('set -C'))));
  assert.throws(() => provider.verify(p, 'db', mount));
  h.authorization.engineId = 'foreign'; assert.throws(() => provider.verify(p, 'http', mount));
  h.authorization.engineId = 'inner'; provider.cleanup([p]); assert.equal(provider.files.size, 0);
});
test('same reference identifiers across projects resolve to distinct scoped sources', () => {
  const f = fixtures('1234-1', `localhost:5000/bsk-es2-fixture@sha256:${'a'.repeat(64)}`); grantSyntheticReferences(f);
  const [a, b] = f.requests.map(buildPlan);
  assert.notEqual(secretMounts(a, 'http')[0].source, secretMounts(b, 'http')[0].source);
  const r = secretRequest(); r.secretProvider.bindings[0].value = 'synthetic-sensitive-value';
  assert.throws(() => buildPlan(r), e => !e.message.includes('synthetic-sensitive-value'));
});
for (const mode of ['missing', 'foreign', 'ambiguous', 'path', 'unauthorized']) test(`rejects ${mode} binding before resolution`, () => {
  const input = secretRequest(); const b = input.secretProvider.bindings[0];
  if (mode === 'missing') b.ref = 'missing';
  if (mode === 'foreign') b.projectRef = 'foreign';
  if (mode === 'ambiguous') input.secretProvider.bindings.push({ ...b });
  if (mode === 'path') b.ref = '../token';
  if (mode === 'unauthorized') input.secretProvider.kind = 'host';
  assert.throws(() => buildPlan(input));
});
test('mount approval is exact, read-only and requires trusted source verification', () => {
  const p = buildPlan(secretRequest()); const m = secretMounts(p, 'http')[0];
  const raw = { Type: 'bind', Source: m.source, Destination: m.target, RW: false };
  assert.deepEqual(validateSecretMount(p, 'http', raw, () => true), m);
  for (const change of [{ RW: true }, { Source: '/foreign' }, { Destination: '/tmp/token' }, { Type: 'volume' }]) {
    assert.throws(() => validateSecretMount(p, 'http', { ...raw, ...change }, () => true));
  }
  assert.throws(() => validateSecretMount(p, 'http', raw));
  assert.throws(() => validateSecretMount(p, 'http', raw, () => false));
  assert.throws(() => validateSecretMount(p, 'db', raw, () => true));
});

test('command evidence never records stdin material', async () => {
  const { DockerSession } = await import('../runtime/session.mjs');
  let received;
  const session = new DockerSession({ run: 'test' }, (_args, options) => { received = options.input; return { status: 0, stdout: '' }; });
  session.raw(['test-only'], { input: 'sensitive-canary-for-redaction' });
  assert.equal(received, 'sensitive-canary-for-redaction');
  assert.ok(!JSON.stringify(session.commands).includes('sensitive-canary-for-redaction'));
});

test('DockerReader normalizes only explicitly approved secret binds and lifecycle verifies them', async () => {
  const { DockerReader } = await import('../lib/docker.mjs');
  const { authorization } = await import('../test-support/runtime.mjs');
  const plan = buildPlan(secretRequest()); const mount = secretMounts(plan, 'http')[0];
  const raw = runtimeObjects(plan).map(o => {
    const id = createHash('sha256').update(o.name).digest('hex');
    if (o.kind !== 'container') return { kind: o.kind, Id: id, Name: o.name, Labels: o.labels, Internal: true, Driver: 'bridge', Containers: {} };
    return { kind: o.kind, Id: id, Name: '/' + o.name, Config: { Labels: o.labels },
      HostConfig: { NanoCpus: 250000000, Memory: 33554432, PidsLimit: 32, Privileged: false, NetworkMode: 'bridge' },
      NetworkSettings: { Networks: Object.fromEntries(o.networks.map(n => [n, {}])), Ports: {} },
      Mounts: [...o.mounts.map(Name => ({ Type: 'volume', Name })), ...(o.labels['dev.bsk.service'] === 'http' ? [{ Type: 'bind', Source: mount.source, Destination: mount.target, RW: false }] : [])] };
  });
  const run = args => {
    if (args[0] === 'context') return JSON.stringify(authorization().endpoint);
    if (args[2] === 'info') return JSON.stringify({ ID: authorization().engineId, OSType: 'linux' });
    const group = raw.filter(o => o.kind === args[2]);
    if (args[3] === 'ls') return group.map(o => o.kind === 'volume' ? o.Name : o.Id).join('\n');
    return JSON.stringify([group.find(o => o.Id === args[4] || o.Name.replace(/^\//, '') === args[4])]);
  };
  const reader = new DockerReader(authorization(), run, () => true);
  const objects = reader.resources(plan);
  assert.equal(inspectLimits({ plan, admission: { requested: plan.requested, admitted: plan.usage } }, objects).configurationMatches, true);
  assert.throws(() => new DockerReader(authorization(), run).resources(plan));
  raw.find(o => o.kind === 'container' && o.Config.Labels['dev.bsk.service'] === 'http').Mounts[0].RW = true;
  assert.throws(() => reader.resources(plan));
});
