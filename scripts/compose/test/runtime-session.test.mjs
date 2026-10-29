import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerSession, cleanEnvironment } from '../runtime/session.mjs';

const permit = { run: '1234-1' };
function setup() {
  const calls = []; const actual = { Id: 'owned-id', Config: { Labels: { 'dev.bsk.test-run': permit.run } } };
  const inner = { ID: 'inner', OSType: 'linux', CgroupVersion: '2', Labels: ['dev.bsk.test-run=1234-1'] };
  const session = new DockerSession(permit, args => {
    calls.push(args);
    const stdout = args.includes('info') ? JSON.stringify(args[1] === 'unix:///var/run/docker.sock' ? { ID: 'outer', OSType: 'linux' } : inner) :
      args[0] === 'context' ? JSON.stringify('unix:///tmp/bsk-es2-1234-1/docker.sock') : args.includes('inspect') ? JSON.stringify([actual]) : 'ok';
    return { status: 0, stdout, stderr: '' };
  });
  session.outerId = 'outer'; session.context = 'bsk-es2-1234-1'; session.endpoint = 'unix:///tmp/bsk-es2-1234-1/docker.sock'; session.innerId = 'inner';
  return { session, calls, actual, inner };
}

test('all runtime operations pin explicit context, endpoint and engine before mutation', () => {
  const { session, calls } = setup(); session.inner(['container', 'stop', 'owned-id']);
  assert.deepEqual(calls.at(-1), ['--context', 'bsk-es2-1234-1', 'container', 'stop', 'owned-id']);
  assert.ok(calls.some(c => c[0] === 'context' && c[1] === 'inspect'));
  assert.ok(calls.some(c => c[0] === '--context' && c[2] === 'info'));
  assert.ok(calls.every(c => !c.includes('default')));
});

test('engine drift blocks every attempted inner mutation', () => {
  const { session, calls, inner } = setup(); inner.ID = 'replaced';
  assert.throws(() => session.inner(['container', 'rm', 'owned-id']), /TARGET/);
  assert.ok(calls.every(c => !c.includes('rm')));
});

test('cleanup checks actual exact ID and all ownership labels before removing', () => {
  const { session, calls, actual } = setup();
  const record = { kind: 'container', id: 'owned-id', labels: { 'dev.bsk.test-run': permit.run } };
  actual.Config.Labels = {};
  assert.throws(() => session.removeOwned(record), /OWNERSHIP/);
  assert.ok(calls.every(c => !c.includes('rm')));
  actual.Config.Labels = record.labels; session.removeOwned(record);
  assert.deepEqual(calls.at(-1).slice(-3), ['container', 'rm', 'owned-id']);
});

test('outer sandbox cleanup also verifies the bootstrap daemon and recorded owner', () => {
  const { session, calls, actual } = setup(); actual.Id = 'foreign';
  assert.throws(() => session.removeOwned({ kind: 'container', id: 'owned-id', labels: { 'dev.bsk.test-run': permit.run } }, true), /OWNERSHIP/);
  assert.ok(calls.every(c => !c.includes('rm')));
});

test('transport errors and timeouts are bounded, recorded and redacted', () => {
  let options;
  const session = new DockerSession(permit, (_args, opts) => {
    options = opts; return { status: null, error: { code: 'ETIMEDOUT' }, stdout: '', stderr: 'fake-secret' };
  });
  assert.throws(() => session.raw(['--context', 'bsk-es2-1234-1', 'info']), /DOCKER_COMMAND/);
  assert.equal(options.timeout, 15000); assert.equal(options.shell, false);
  assert.equal(session.commands[0].error, 'ETIMEDOUT');
  assert.doesNotMatch(JSON.stringify(session.commands), /fake-secret/);
});

test('ambient Docker, Compose, build and proxy secrets do not reach child processes', () => {
  const env = cleanEnvironment({ PATH: '/bin', DOCKER_HOST: 'foreign', COMPOSE_FILE: 'foreign', BUILDX_BUILDER: 'foreign',
    NODE_OPTIONS: 'foreign', HTTP_PROXY: 'fake-secret', TOKEN: 'fake-secret', LANG: 'C' });
  assert.deepEqual(env, { PATH: '/bin', LANG: 'C' });
});
