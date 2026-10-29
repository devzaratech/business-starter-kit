import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerReader } from '../lib/docker.mjs';
import { buildPlan } from '../lib/plan.mjs';
import { request } from '../test-support/fixtures.mjs';
import { authorization } from '../test-support/runtime.mjs';

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
