import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyShutdown } from '../runtime/shutdown.mjs';
import { DockerReader } from '../lib/docker.mjs';
import { fixtures } from '../runtime/fixtures.mjs';
import { buildPlan } from '../lib/plan.mjs';

const auth = { context: 'bsk-es2-1234-1', endpoint: 'unix:///tmp/bsk-test/docker.sock', engineId: 'inner', hostRef: 'disposable-host', disposable: true, authorizationRef: 'test' };
const plan = buildPlan(fixtures('1234-1', `localhost:5000/bsk-es2-fixture@sha256:${'b'.repeat(64)}`).requests[0]);
test('zero-exit error-shaped info reproduces legacy CONTEXT_MISMATCH, not DOCKER_READ', () => {
  const reader = new DockerReader(auth, args => JSON.stringify(args[0] === 'context' ? auth.endpoint : { ID: '', ServerErrors: ['redacted'] }));
  assert.throws(() => reader.resources(plan), e => e.code === 'CONTEXT_MISMATCH');
});
function setup() {
  const evidence = []; let context = auth.endpoint; let stopped = true;
  const session = { permit: { run: '1234-1' }, context: auth.context, endpoint: auth.endpoint, innerId: 'inner',
    inspect() { return { State: { Running: !stopped, Restarting: false, Status: stopped ? 'exited' : 'running' } }; },
    raw: () => ({ stdout: JSON.stringify(context) }) };
  return { session, evidence, setContext: v => { context = v; }, setStopped: v => { stopped = v; } };
}
test('stopped owned sandbox plus refused original socket proves unavailable and records errno', async () => {
  const s = setup();
  const result = await verifyShutdown(s.session, {}, auth, s.evidence, async () => { throw Object.assign(new Error('fake-secret'), { code: 'ECONNREFUSED' }); }, async () => {});
  assert.equal(result, 'ECONNREFUSED'); assert.equal(s.evidence[0].outerStopped, true);
  assert.doesNotMatch(JSON.stringify(s.evidence), /fake-secret/);
});
test('original daemon reachable is retried within bounds, then rejected', async () => {
  const s = setup(); let calls = 0;
  await assert.rejects(verifyShutdown(s.session, {}, auth, s.evidence, async () => { calls++; return { ID: 'inner', OSType: 'linux' }; }, async () => {}), /DAEMON_REACHABLE/);
  assert.equal(calls, 3); assert.equal(s.evidence.length, 3);
});
test('transient original reachability followed by missing socket is recorded, not assumed', async () => {
  const s = setup(); let calls = 0;
  assert.equal(await verifyShutdown(s.session, {}, auth, s.evidence, async () => {
    if (++calls === 1) return { ID: 'inner', OSType: 'linux' };
    throw Object.assign(new Error(), { code: 'ENOENT' });
  }, async () => {}), 'ENOENT');
  assert.equal(s.evidence[0].code, 'DAEMON_REACHABLE');
});
test('later context drift blocks a second socket read', async () => {
  const s = setup(); let reads = 0;
  await assert.rejects(verifyShutdown(s.session, {}, auth, s.evidence, async () => {
    reads++; s.setContext('unix:///foreign.sock'); return { ID: 'inner', OSType: 'linux' };
  }, async () => {}), /CONTEXT_MISMATCH/);
  assert.equal(reads, 1); assert.equal(s.evidence[1].code, 'CONTEXT_MISMATCH');
});
for (const mode of ['context', 'running', 'identity', 'malformed', 'permission', 'timeout', 'ownership']) test(`shutdown fails closed for ${mode}`, async () => {
  const s = setup(); let probes = 0;
  if (mode === 'context') s.setContext('unix:///foreign.sock');
  if (mode === 'running') s.setStopped(false);
  if (mode === 'ownership') s.session.inspect = () => { throw Object.assign(new Error(), { code: 'OWNERSHIP' }); };
  await assert.rejects(verifyShutdown(s.session, {}, auth, s.evidence, async () => {
    probes++;
    if (mode === 'identity') return { ID: 'foreign', OSType: 'linux' };
    if (mode === 'malformed') return { ServerErrors: ['redacted'] };
    throw Object.assign(new Error('fake-secret'), { code: mode === 'permission' ? 'EACCES' : 'ETIMEDOUT' });
  }, async () => {}));
  if (['context', 'running', 'ownership'].includes(mode)) assert.equal(probes, 0);
  assert.doesNotMatch(JSON.stringify(s.evidence), /fake-secret/);
});
