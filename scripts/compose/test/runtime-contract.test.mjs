import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, verifyOwner, assertEngine, resultStatus } from '../runtime/guard.mjs';
import { fixtures } from '../runtime/fixtures.mjs';
import { cgroupValues, verifyCgroup, verifyLoad, connectProbe } from '../runtime/probes.mjs';

const sha = 'a'.repeat(40);
const env = () => ({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux',
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'devzaratech/business-starter-kit',
  GITHUB_REPOSITORY_OWNER: 'devzaratech', GITHUB_ACTOR: 'devzaratech', GITHUB_TRIGGERING_ACTOR: 'devzaratech',
  GITHUB_SHA: sha, BSK_EXPECTED_SHA: sha, BSK_RUNTIME_CONFIRM: 'AUTHORIZE_DISPOSABLE_ES2',
  GITHUB_RUN_ID: '1234', GITHUB_RUN_ATTEMPT: '1', RUNNER_TEMP: '/tmp/bsk-runner' });

test('authorization binds explicit owner, hosted Linux, event, commit and run identity', () => {
  const permit = authorize(env(), 'linux');
  assert.equal(permit.run, '1234-1'); assert.equal(permit.commit, sha);
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'self-hosted',
    RUNNER_OS: 'Windows', GITHUB_EVENT_NAME: 'pull_request', GITHUB_ACTOR: 'contributor',
    GITHUB_TRIGGERING_ACTOR: 'contributor', GITHUB_REPOSITORY: 'fork/business-starter-kit',
    BSK_EXPECTED_SHA: 'b'.repeat(40), BSK_RUNTIME_CONFIRM: '', GITHUB_RUN_ID: '../escape', RUNNER_TEMP: '/tmp/../var' })) {
    assert.throws(() => authorize({ ...env(), [key]: value }, 'linux'), /AUTHORIZATION/);
  }
  assert.throws(() => authorize(env(), 'win32'), /AUTHORIZATION/);
});

test('cleanup ownership requires exact recorded ID and all expected labels', () => {
  const expected = { id: 'fixture-id', labels: { 'dev.bsk.test-run': '1234-1', 'dev.bsk.project': 'fixture-a' } };
  verifyOwner({ Id: expected.id, Config: { Labels: expected.labels } }, expected);
  for (const actual of [{ Id: 'other', Config: { Labels: expected.labels } },
    { Id: expected.id, Config: { Labels: {} } }, { Id: expected.id, Config: { Labels: { ...expected.labels, 'dev.bsk.project': 'fixture-b' } } }]) {
    assert.throws(() => verifyOwner(actual, expected), /OWNERSHIP/);
  }
});

test('inner daemon must be new, Linux, cgroup v2 and bear the exact run label', () => {
  const info = { ID: 'inner', OSType: 'linux', CgroupVersion: '2', Labels: ['dev.bsk.test-run=1234-1'] };
  assertEngine(info, 'outer', '1234-1');
  for (const change of [{ ID: 'outer' }, { OSType: 'windows' }, { Labels: [] }, { CgroupVersion: '1' }]) {
    assert.throws(() => assertEngine({ ...info, ...change }, 'outer', '1234-1'), /TARGET|CGROUP/);
  }
});

test('fixtures bind a unique installation, two environments and immutable synthetic image', () => {
  const image = `localhost:5000/bsk-es2-fixture@sha256:${'b'.repeat(64)}`;
  const f = fixtures('1234-1', image);
  assert.equal(f.requests.length, 2);
  assert.notEqual(f.requests[0].target.projectRef, f.requests[1].target.projectRef);
  assert.notEqual(f.requests[0].target.environmentRef, f.requests[1].target.environmentRef);
  assert.ok(f.requests.every(r => r.target.installationRef === 'es2-1234-1' && r.workloads.every(w => w.image === image)));
  assert.throws(() => fixtures('1234-1', 'python:latest'), /IMAGE/);
});

test('cgroup assertions require exact values and observed bounded failure counters', () => {
  const raw = { 'cpu.max': '25000 100000\n', 'memory.max': '67108864\n', 'pids.max': '32\n',
    'cpu.stat': 'usage_usec 100\nnr_throttled 1\n', 'memory.events': 'oom_kill 0\n', 'pids.events': 'max 0\n' };
  const before = cgroupValues(raw);
  verifyCgroup(before, { cpuLimitMillis: 250, memoryLimitBytes: 67108864, pidsLimit: 32 });
  assert.throws(() => verifyCgroup({ ...before, memoryBytes: 0 }, { cpuLimitMillis: 250, memoryLimitBytes: 67108864, pidsLimit: 32 }), /CGROUP/);
  const after = { ...before, usageUsec: 200, throttled: 2, oomKills: 1, pidsDenied: 1 };
  verifyLoad('cpu', before, after, 0); verifyLoad('pids', before, after, 0); verifyLoad('memory', before, after, 137);
  for (const type of ['cpu', 'pids', 'memory']) assert.throws(() => verifyLoad(type, before, before, 0), /LOAD/);
  assert.throws(() => cgroupValues({ ...raw, 'memory.events': '' }), /CGROUP/);
});

test('failed, blocked and absent acceptance checks never aggregate to conformance', () => {
  assert.equal(resultStatus([{ status: 'passed' }], ['secrets']), 'incomplete');
  assert.equal(resultStatus([{ status: 'failed' }], []), 'failed');
  assert.equal(resultStatus([{ status: 'blocked' }], []), 'blocked');
  assert.equal(resultStatus([], []), 'incomplete');
  assert.equal(resultStatus([{ status: 'passed' }], []), 'demonstrated');
});

test('negative connectivity is decided by TCP establishment without an application read', () => {
  const code = connectProbe('172.20.0.2', false);
  assert.match(code, /socket\.create_connection/);
  assert.doesNotMatch(code, /\.sendall\(|\.recv\(/);
  assert.match(code, /else:\n s\.close\(\); raise RuntimeError\('private endpoint reachable'\)/);
});
