import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import childProcess from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { planBundle } from '../lib/plan.mjs';
import { fixture, resources, snapshot } from './helpers.mjs';

function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  return value;
}

test('hashes the specified canonical UTF-8 JSON with SHA-256', () => {
  const b = { resources: [{ spec: { ownerRef: 'o' }, metadata: { name: 'p', installationRef: 'i' },
    kind: 'Project', apiVersion: 'bsk/v0alpha1' }], apiVersion: 'bsk/v0alpha1',
  catalog: { runtimes: [], routes: [], policies: [] } };
  assert.equal(planBundle(b).planId, '63381afdced0c3e381866254de65dbd9fffc8379eb63c2820b2e170439aad2ad');
});

test('plans contain only declaration actions with explicit unverified runtime checks', () => {
  const p = planBundle(fixture());
  assert.equal(p.apiVersion, 'bsk/v0alpha1');
  assert.equal(p.mode, 'dry-run');
  assert.match(p.planId, /^[a-f0-9]{64}$/);
  assert.equal(p.actions.length, 6);
  assert.deepEqual(p.diagnostics, []);
  assert.deepEqual(p.actions.find(a => a.resourceKey[1] === 'Project'), {
    action: 'declare', resourceKey: ['fixture-install', 'Project', null, null, 'fixture-a'],
    spec: { ownerRef: 'fixture-team' }, runtimeChecks: 'not-evaluated'
  });
  for (const a of p.actions) {
    assert.deepEqual(Object.keys(a).sort(), ['action', 'resourceKey', 'runtimeChecks', 'spec']);
    assert.equal(a.runtimeChecks, 'not-evaluated');
    assert.equal(a.action, 'declare');
  }
  assert.doesNotMatch(JSON.stringify(p), /"(?:applied|healthy|succeeded)"/);
});

test('reordering resources, set arrays and object keys gives identical serialized plans', () => {
  const b = fixture();
  b.catalog.policies.push('other-policy');
  b.catalog.runtimes.push('other-runtime');
  b.resources[4].spec.secretRefs = ['secret-b', 'secret-a'];
  b.resources[4].spec.resources = resources();
  const before = JSON.stringify(b);
  const shuffled = reverseKeys(structuredClone(b));
  shuffled.resources.reverse();
  shuffled.catalog.routes.reverse();
  shuffled.catalog.policies.reverse();
  shuffled.catalog.runtimes.reverse();
  shuffled.resources.find(r => r.kind === 'Service' && r.metadata.projectRef === 'fixture-a').spec.secretRefs.reverse();
  assert.equal(JSON.stringify(planBundle(b)), JSON.stringify(planBundle(shuffled)));
  assert.equal(JSON.stringify(b), before);
});

for (const [name, mutate] of [
  ['owner', b => { b.resources[0].spec.ownerRef = 'another-owner'; }],
  ['port', b => { b.resources[4].spec.port = 8081; }],
  ['resource limit', b => { b.resources[4].spec.resources = resources(); }],
  ['policy catalog', b => { b.catalog.policies.push('other'); }],
  ['runtime catalog', b => { b.catalog.runtimes.push('other'); }],
  ['route target', b => { b.catalog.routes[0].pathPrefix = '/v2'; }],
  ['route visibility', b => { b.catalog.routes[0].visibility = 'private'; }],
  ['strip semantics', b => { b.catalog.routes[0].stripPrefix = true; }],
  ['installation scope', b => { for (const r of b.resources) r.metadata.installationRef = 'other'; for (const r of b.catalog.routes) r.installationRef = 'other'; }]
]) {
  test(`plan identity includes ${name}`, () => {
    const b = fixture(); const original = planBundle(b); mutate(b);
    const next = planBundle(b);
    assert.deepEqual(next.diagnostics, []);
    assert.notEqual(next.planId, original.planId);
  });
}

test('invalid scope, route and shape cannot produce any plan actions', () => {
  for (const b of [fixture('invalid-cross-project'), null, fixture()]) {
    if (b?.catalog?.routes.length) b.catalog.routes.push({ ...b.catalog.routes[0] });
    const p = planBundle(b);
    assert.equal(p.planId, null);
    assert.deepEqual(p.actions, []);
    assert.ok(p.diagnostics.length > 0);
  }
});

test('resource tuple sorting is independent of locale and input order', () => {
  const b = fixture();
  b.resources.push({ ...structuredClone(b.resources[0]), metadata: { ...b.resources[0].metadata, name: 'fixture-1' } });
  const p = planBundle(b);
  assert.deepEqual(p.actions.map(a => a.resourceKey), [
    ['fixture-install', 'Environment', 'fixture-a', null, 'review-142'],
    ['fixture-install', 'Environment', 'fixture-b', null, 'review-142'],
    ['fixture-install', 'Project', null, null, 'fixture-1'],
    ['fixture-install', 'Project', null, null, 'fixture-a'],
    ['fixture-install', 'Project', null, null, 'fixture-b'],
    ['fixture-install', 'Service', 'fixture-a', null, 'http'],
    ['fixture-install', 'Service', 'fixture-b', null, 'http']
  ]);
});

test('output does not alias mutable caller specs', () => {
  const b = fixture(); b.resources[4].spec.secretRefs = ['opaque'];
  const p = planBundle(b); const before = JSON.stringify(p);
  b.resources[4].spec.secretRefs.push('different');
  assert.equal(JSON.stringify(p), before);
});

test('evaluation has no filesystem, network, subprocess, clock or environment dependency', t => {
  const root = fileURLToPath(new URL('./fixtures/', import.meta.url));
  const before = snapshot(root);
  const b = fixture();
  const deny = () => { throw new Error('Side effect attempted during pure evaluation'); };
  const originalEnv = process.env;
  let p;
  try {
    for (const object of [fs, fsPromises]) {
      for (const method of ['readFile', 'readFileSync', 'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'open', 'openSync', 'mkdir', 'mkdirSync', 'rename', 'renameSync', 'rm', 'rmSync', 'unlink', 'unlinkSync', 'createWriteStream']) {
        if (typeof object[method] === 'function') t.mock.method(object, method, deny);
      }
    }
    for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) t.mock.method(childProcess, method, deny);
    for (const method of ['connect', 'createConnection', 'createServer']) t.mock.method(net, method, deny);
    for (const object of [http, https]) for (const method of ['get', 'request']) t.mock.method(object, method, deny);
    t.mock.method(globalThis, 'fetch', deny);
    t.mock.method(Date, 'now', deny);
    t.mock.method(process, 'cwd', deny);
    syncBuiltinESMExports();
    process.env = new Proxy({}, { get: deny, set: deny, ownKeys: deny });
    p = planBundle(b);
  } finally {
    process.env = originalEnv;
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(p.actions.length, 6);
  assert.deepEqual(p.diagnostics, []);
  assert.deepEqual(snapshot(root), before);
});
