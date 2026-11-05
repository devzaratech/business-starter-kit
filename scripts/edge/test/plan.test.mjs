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

for (const stripPrefix of [false, true]) test(`adversarial binding names preserve ordered longest-prefix semantics (strip=${stripPrefix})`, () => {
  const b = fixture(); b.routes[0].metadata.name = 'a-root'; b.routes[2].metadata.name = 'z-api';
  b.routes[2].spec.stripPrefix = stripPrefix;
  const deep = structuredClone(b.routes[2]); deep.metadata.name = 'zz-api-v2'; deep.spec.pathPrefix = '/api/v2'; b.routes.push(deep);
  const p = planCandidate(snapshot(b), 'edge');
  assert.deepEqual(p.desired.routes.filter(r => r.hostname === 'one.alpha.test').map(r => r.pathPrefix), ['/api/v2', '/api', '/']);
  assert.equal(JSON.stringify(p), JSON.stringify(planCandidate(snapshot(reverse(b)), 'edge')));
  for (const [path, prefix, stripped] of [['/api/v2/users', '/api/v2', '/users'], ['/api/v2', '/api/v2', '/'],
    ['/api/users', '/api', '/users'], ['/api', '/api', '/'], ['/api/v2x', '/api', '/v2x'],
    ['/apix', '/', '/apix'], ['/fallback', '/', '/fallback'], ['/', '/', '/']]) {
    const result = matchRoute(p, 'one.alpha.test', path);
    assert.equal(result.route.pathPrefix, prefix);
    assert.equal(result.forwardPath, stripPrefix ? stripped : path);
  }
});

test('reference matching chooses the longest prefix even if a route array is reordered', () => {
  const b = fixture(); b.routes[0].metadata.name = 'a-root'; b.routes[2].metadata.name = 'z-api';
  const p = planCandidate(snapshot(b), 'edge'); p.desired.routes.reverse();
  const before = JSON.stringify(p);
  assert.equal(matchRoute(p, 'one.alpha.test', '/api/users').route.pathPrefix, '/api');
  assert.equal(matchRoute(p, 'one.alpha.test', '/api/users').forwardPath, '/users');
  assert.equal(JSON.stringify(p), before);
});

test('binding references are unambiguous across projects and arbitrary environments', () => {
  const b = fixture();
  const environment = structuredClone(b.declarations.resources.find(r => r.kind === 'Environment' && r.metadata.projectRef === 'alpha'));
  environment.metadata.name = 'preview-next'; b.declarations.resources.push(environment);
  const deployment = structuredClone(b.deployments[0]); deployment.resource.metadata.environmentRef = 'preview-next'; b.deployments.push(deployment);
  b.zones[0].owners.push({ projectRef: 'alpha', environmentRef: 'preview-next' });
  const route = structuredClone(b.routes[0]); route.metadata.environmentRef = 'preview-next'; route.spec.hostname = 'next.alpha.test'; b.routes.push(route);
  const refs = planCandidate(snapshot(b), 'edge').desired.routes.filter(r => r.bindingRef?.name === 'one-root').map(r => r.bindingRef);
  assert.equal(refs.length, 4);
  assert.equal(new Set(refs.map(r => JSON.stringify(r))).size, 4);
  assert.deepEqual(refs.find(r => r.environmentRef === 'preview-next'), { installationRef: 'fixture-install', kind: 'DomainBinding',
    projectRef: 'alpha', environmentRef: 'preview-next', name: 'one-root' });
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
