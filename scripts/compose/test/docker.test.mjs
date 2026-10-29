import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerReader } from '../lib/docker.mjs';
import { buildPlan } from '../lib/plan.mjs';
import { request } from '../test-support/fixtures.mjs';
import { authorization } from '../test-support/runtime.mjs';
import { runtimeObjects } from '../test-support/runtime.mjs';
import { inspectLimits } from '../lib/lifecycle.mjs';
import { createHash } from 'node:crypto';

test('denies default/Desktop contexts, endpoint aliases and absent authorization before daemon reads', () => {
  for (const change of [a => { a.context = 'default'; }, a => { a.context = 'desktop-linux'; },
    a => { a.endpoint = 'unix:///var/run/docker.sock'; }, a => { a.endpoint = 'unix:///run/docker.sock'; },
    a => { a.endpoint = 'unix:///tmp/../var/run/docker.sock'; }, a => { a.endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine'; },
    a => { a.disposable = false; }, a => { delete a.engineId; }, a => { delete a.authorizationRef; }]) {
    const a = authorization(); change(a); let called = false;
    assert.throws(() => new DockerReader(a, () => { called = true; }).resources(buildPlan(request())), e => e.code === 'CONTEXT_REQUIRED');
    assert.equal(called, false);
  }
});
test('pins context endpoint and Linux engine identity, never accepts environment overrides', () => {
  for (const [endpoint, engine, os] of [['unix:///wrong', 'explicit-disposable-engine', 'linux'],
    ['unix:///tmp/bsk-es2/docker.sock', 'wrong', 'linux'], ['unix:///tmp/bsk-es2/docker.sock', 'explicit-disposable-engine', 'windows']]) {
    const reader = new DockerReader(authorization(), args => {
      if (args[0] === 'context') return JSON.stringify(endpoint);
      return JSON.stringify({ ID: engine, OSType: os });
    });
    assert.throws(() => reader.resources(buildPlan(request())), e => e.code === 'CONTEXT_MISMATCH');
  }
});
test('all inspection calls are explicitly context scoped and read-only; failures are redacted', () => {
  const calls = [];
  const reader = new DockerReader(authorization(), args => {
    calls.push(args);
    if (args[0] === 'context') return JSON.stringify(authorization().endpoint);
    if (args.includes('info')) return JSON.stringify({ ID: authorization().engineId, OSType: 'linux' });
    throw new Error('fake-secret-transport-error');
  });
  assert.throws(() => reader.resources(buildPlan(request())), e => e.code === 'DOCKER_READ' && !e.message.includes('fake-secret'));
  for (const call of calls.slice(1)) assert.deepEqual(call.slice(0, 2), ['--context', authorization().context]);
  assert.ok(calls.every(c => !c.some(arg => ['up', 'down', 'rm', 'prune', 'stop', 'kill'].includes(arg))));
});

for (const cpuMillis of [250, 1001]) test(`normalizes Docker CPU ${cpuMillis} millis, deduplicates IDs and captures version fields`, () => {
  const input = request();
  for (const workload of input.workloads) workload.resources.cpuLimitMillis = cpuMillis;
  const plan = buildPlan(input);
  const raw = runtimeObjects(plan).map(o => {
    const id = createHash('sha256').update(`${o.kind}:${o.name}`).digest('hex');
    if (o.kind === 'container') return { kind: o.kind, Id: id, Name: `/${o.name}`, Config: { Labels: o.labels },
      HostConfig: { NanoCpus: cpuMillis * 1000000, Memory: 33554432, PidsLimit: 32, Privileged: false, NetworkMode: 'bridge' },
      NetworkSettings: { Networks: Object.fromEntries(o.networks.map(n => [n, {}])), Ports: { '8080/tcp': null } },
      Mounts: o.mounts.map(name => ({ Type: 'volume', Name: name })) };
    return { kind: o.kind, Id: id, Name: o.name, Labels: o.labels, Internal: true, Driver: 'bridge', Containers: {} };
  });
  const reader = new DockerReader(authorization(), args => {
    if (args[0] === 'context') return JSON.stringify(authorization().endpoint);
    if (args[2] === 'info') return JSON.stringify({ ID: authorization().engineId, OSType: 'linux', ServerVersion: 'fixture-engine', KernelVersion: 'fixture-kernel', CgroupVersion: '2' });
    if (args[2] === 'compose') return 'fixture-compose\n';
    const values = raw.filter(o => o.kind === args[2]);
    if (args[3] === 'ls') return values.map(o => o.kind === 'volume' ? o.Name : o.Id).join('\n');
    const match = values.find(o => o.Id === args[4] || o.Name.replace(/^\//, '') === args[4]);
    assert.ok(match); return JSON.stringify([match]);
  });
  const objects = reader.resources(plan);
  assert.equal(objects.length, 5);
  const report = inspectLimits({ plan, admission: { requested: plan.requested, admitted: plan.usage } }, objects);
  assert.equal(report.configurationMatches, true); assert.equal(report.enforced, 'unknown');
  assert.deepEqual(reader.versions(plan), { engine: 'fixture-engine', kernel: 'fixture-kernel', cgroup: '2', compose: 'fixture-compose', engineId: authorization().engineId, context: authorization().context });
});
