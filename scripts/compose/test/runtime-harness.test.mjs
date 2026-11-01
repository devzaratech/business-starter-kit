import test from 'node:test';
import assert from 'node:assert/strict';
import { Harness } from '../runtime/harness.mjs';
import { fixtures } from '../runtime/fixtures.mjs';
import { buildPlan } from '../lib/plan.mjs';
import { expectedObjects } from '../lib/lifecycle.mjs';

function outageSetup() {
  const calls = [];
  const plan = buildPlan(fixtures('1234-1', `localhost:5000/bsk-es2-fixture@sha256:${'b'.repeat(64)}`).requests[0]);
  const authorization = { context: 'bsk-es2-1234-1', endpoint: 'unix:///tmp/bsk-test/docker.sock', engineId: 'inner', hostRef: 'disposable-host', disposable: true, authorizationRef: 'test' };
  const docker = { permit: { run: '1234-1' }, context: authorization.context, endpoint: authorization.endpoint, innerId: 'inner',
    raw: () => ({ stdout: JSON.stringify(authorization.endpoint) }),
    outer(args) { calls.push(args); }, inspect() { return { State: { Running: false, Restarting: false, Status: 'exited' } }; },
    inner(args) { const o = expectedObjects(plan).find(o => o.kind === args[0] && o.name === args[2]);
      return { status: 0, stdout: JSON.stringify([{ Id: o.name, Name: o.name }]) }; },
    removeOwned(r, outer) { calls.push(['remove', r.id, outer]); } };
  const h = new Harness({ run: '1234-1' }, docker); h.plans = [plan]; h.outerContainer = { id: 'daemon' };
  h.authorization = authorization;
  h.shutdownRead = async () => { throw Object.assign(new Error(), { code: 'ECONNREFUSED' }); };
  return { h, calls };
}

test('bootstrap rejects pre-existing sandbox names before create or pull', async () => {
  const calls = [];
  const docker = { raw: () => ({ stdout: JSON.stringify({ ID: 'outer', OSType: 'linux' }) }),
    outer(args) { calls.push(args); return { stdout: 'bsk-es2-daemon-data-1234-1\n' }; } };
  const h = new Harness({ run: '1234-1' }, docker);
  await assert.rejects(h.bootstrap(), /TARGET_NOT_EMPTY/);
  assert.ok(calls.every(c => !c.includes('create') && !c.includes('pull') && !c.includes('run')));
});

test('partially created or foreign resources prevent sandbox deletion', async () => {
  const calls = [];
  const docker = { inner(args) { calls.push(args); return { status: 1 }; }, removeOwned() { calls.push(['remove']); } };
  const h = new Harness({ run: '1234-1' }, docker);
  h.plans = fixtures('1234-1', `localhost:5000/bsk-es2-fixture@sha256:${'b'.repeat(64)}`).requests.map(buildPlan);
  h.outerContainer = { id: 'daemon' };
  await assert.rejects(h.cleanup(), /CLEANUP_INCOMPLETE/);
  assert.ok(calls.every(c => c[0] !== 'remove'));
});

test('cleanup verifies a stopped-daemon transport rejection before outer disposal', async () => {
  const { h, calls } = outageSetup();
  h.reader = { resources() { throw Object.assign(new Error('unavailable'), { code: 'DOCKER_READ' }); } };
  const result = await h.cleanup();
  assert.equal(result.daemonUnavailableRejection, 'ECONNREFUSED');
  assert.ok(calls.some(c => c[0] === 'container' && c[1] === 'stop'));
  assert.equal(calls.at(-1)[0], 'remove');
});

test('cleanup never substitutes a successful read for daemon-outage evidence', async () => {
  const { h, calls } = outageSetup(); h.reader = { resources: () => [] };
  const saved = []; h.root = 'test-spy'; h.save = (name, value) => saved.push({ name, value });
  h.shutdownRead = async () => ({ ID: 'inner', OSType: 'linux' });
  await assert.rejects(h.cleanup(), /DAEMON_REACHABLE/);
  assert.ok(calls.every(c => !(c[0] === 'remove' && c[1] === 'daemon')));
  assert.equal(saved[0].name, 'cleanup');
  assert.equal(saved[0].value.shutdownEvidence.at(-1).code, 'DAEMON_REACHABLE');
});

test('image-preparation failure before plans still permits verified sandbox cleanup', async () => {
  const removed = []; let read = false;
  const h = new Harness({ run: '1234-1' }, { inspect() {}, outer() {}, removeOwned(r) { removed.push(r.id); } });
  h.outerContainer = { id: 'daemon' }; h.outerVolume = { id: 'daemon-data' };
  h.reader = { resources() { read = true; throw new TypeError('no plan'); } };
  const result = await h.cleanup();
  assert.equal(result.daemonUnavailableRejection, null); assert.equal(read, false);
  assert.deepEqual(removed, ['daemon', 'daemon-data']);
});

test('runtime checks persist explicit failure codes and never echo transport messages', async () => {
  const h = new Harness({ run: '1234-1' }, {});
  await assert.rejects(h.check('load', () => { throw new Error('fake-secret'); }));
  assert.deepEqual(h.checks, [{ name: 'load', status: 'failed', code: 'ASSERTION' }]);
});
