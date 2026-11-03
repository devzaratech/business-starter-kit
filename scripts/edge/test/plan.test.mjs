import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { planCandidate, matchRoute } from '../lib/plan.mjs';
import { fixture, reverse, denies } from '../test-support/fixtures.mjs';

const snapshot = input => ({ apiVersion: 'bsk.edge/v0alpha1', kind: 'RouteRegistrySnapshot', generation: 4, input });
test('pure candidates describe only desired public routes and logical upstreams', () => {
  const b = fixture(); b.routes.filter(r => r.metadata.projectRef === 'charlie').forEach(r => { r.spec.visibility = 'private'; });
  const p = planCandidate(snapshot(b), 'edge');
  assert.equal(p.mode, 'dry-run'); assert.equal(p.kind, 'IngressCandidate'); assert.equal(p.registryGeneration, 4);
  assert.equal(p.applied, null); assert.equal(p.observed, null); assert.equal(p.desired.routes.length, 6);
  assert.doesNotMatch(JSON.stringify(p), /charlie|http:\/\/|socket|healthy|deployed/);
  assert.deepEqual(p.desired.routes[0].upstream, { installationRef: 'fixture-install', projectRef: 'alpha', environmentRef: 'review-42',
    serviceRef: 'http', deploymentRef: 'release-1', hostRef: 'host-a', port: 8080 });
  const { planId, ...body } = p;
  assert.equal(planId, createHash('sha256').update(JSON.stringify(body)).digest('hex'));
});
test('candidate bytes are stable under input/object-key/set reordering without mutating input', () => {
  const b = fixture(); const before = JSON.stringify(b);
  assert.equal(JSON.stringify(planCandidate(snapshot(b), 'edge')), JSON.stringify(planCandidate(snapshot(reverse(b)), 'edge')));
  assert.equal(JSON.stringify(b), before);
});
test('segment boundaries, longest prefix and explicit strip semantics', () => {
  const b = fixture(); const deep = structuredClone(b.routes[2]); deep.metadata.name = 'deep'; deep.spec.pathPrefix = '/api/v2'; b.routes.push(deep);
  const p = planCandidate(snapshot(b), 'edge');
  assert.equal(matchRoute(p, 'one.alpha.test', '/api/v2/users').forwardPath, '/users');
  assert.equal(matchRoute(p, 'one.alpha.test', '/api').forwardPath, '/');
  assert.equal(matchRoute(p, 'one.alpha.test', '/apix').route.pathPrefix, '/');
  assert.equal(matchRoute(p, 'one.alpha.test', '/other').forwardPath, '/other');
  assert.equal(matchRoute(p, 'unknown.test', '/'), null);
  denies(() => matchRoute(p, 'one.alpha.test', '/api%2fv2'), 'SCHEMA');
  b.routes[2].spec.stripPrefix = false;
  assert.equal(matchRoute(planCandidate(snapshot(b), 'edge'), 'one.alpha.test', '/api/x').forwardPath, '/api/x');
});
test('unknown gateway and forged snapshot state reject before planning', () => {
  denies(() => planCandidate(snapshot(fixture()), 'foreign'), 'UNRESOLVED_REFERENCE');
  denies(() => planCandidate({ ...snapshot(fixture()), generation: -1 }, 'edge'), 'CORRUPT_REGISTRY');
});
test('planning performs no filesystem mutation, process execution or network effects', t => {
  const b = fixture();
  for (const [object, names] of [[fs, ['writeFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'openSync']],
    [fsp, ['writeFile', 'mkdir', 'rename', 'unlink', 'open']], [cp, ['spawn', 'spawnSync', 'exec', 'execFile', 'execFileSync', 'execSync']],
    [net, ['connect', 'createConnection', 'createServer']], [http, ['request', 'get', 'createServer']], [https, ['request', 'get', 'createServer']]]) {
    for (const name of names) t.mock.method(object, name, () => { throw new Error(`Forbidden side effect: ${name}`); });
  }
  syncBuiltinESMExports();
  try { assert.equal(planCandidate(snapshot(b), 'edge').desired.routes.length, 9); }
  finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});
