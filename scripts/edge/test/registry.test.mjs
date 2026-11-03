import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { RouteRegistry } from '../lib/registry.mjs';
import { hash } from '../lib/model.mjs';
import { fixture, denies } from '../test-support/fixtures.mjs';

function setup(t, authorize = () => true, input = fixture()) {
  const root = fs.mkdtempSync(join(tmpdir(), 'bsk-edge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const routes = input.routes; input.routes = [];
  const store = RouteRegistry.initialize(root, input, { authorize });
  return { root, store, routes };
}
const claim = routes => ({ action: 'claim', routes });
const ref = r => ({ ...r.metadata });
const release = routes => ({ action: 'release', bindingRefs: routes.map(r => { const { installationRef, ...scoped } = ref(r); return scoped; }) });

test('atomic claims persist a complete generation and preserve unrelated projects', t => {
  const { root, store, routes } = setup(t);
  const a = routes.filter(r => r.metadata.projectRef === 'alpha');
  const b = routes.filter(r => r.metadata.projectRef !== 'alpha');
  assert.equal(store.transact(claim(b), 0).generation, 1);
  assert.equal(store.transact(claim(a), 1).generation, 2);
  const fresh = new RouteRegistry(root, { authorize: () => true });
  assert.equal(fresh.snapshot().input.routes.length, 9);
  assert.equal(fresh.transact(release(a), 2).input.routes.length, 6);
  assert.deepEqual(fresh.snapshot().input.routes, store.snapshot().input.routes);
  assert.equal(fs.readdirSync(root).length, 1);
});

test('stale revisions, unauthorized writes and duplicate claims preserve bytes', t => {
  const { root, store, routes } = setup(t); store.transact(claim(routes), 0);
  const before = fs.readFileSync(join(root, 'registry.json'));
  denies(() => store.transact(release(routes), 0), 'STALE_GENERATION');
  denies(() => store.transact(claim([routes[0]]), 1), 'DUPLICATE_ROUTE');
  denies(() => new RouteRegistry(root).transact(release(routes), 1), 'AUTHORIZATION_REQUIRED');
  denies(() => new RouteRegistry(root, { authorize: () => false }).transact(release(routes), 1), 'AUTHORIZATION_REQUIRED');
  assert.deepEqual(fs.readFileSync(join(root, 'registry.json')), before);
});

test('ordinary claims cannot implicitly retarget a route or transfer a released hostname', t => {
  const input = fixture(); input.zones[0].owners.push({ projectRef: 'bravo', environmentRef: 'review-42' });
  const { store, routes } = setup(t, () => true, input);
  const a = routes.filter(r => r.spec.hostname === 'one.alpha.test'); store.transact(claim(a), 0);
  const replacement = structuredClone(a[0]); replacement.metadata.projectRef = 'bravo'; replacement.metadata.name = 'moved';
  denies(() => store.transact(claim([replacement]), 1), 'HOSTNAME_OWNERSHIP');
  store.transact(release(a), 1);
  denies(() => store.transact(claim([replacement]), 2), 'HOSTNAME_OWNERSHIP');
  const request = { action: 'rebind', hostname: replacement.spec.hostname,
    from: { projectRef: 'alpha', environmentRef: 'review-42' }, to: { projectRef: 'bravo', environmentRef: 'review-42' }, routes: [replacement] };
  const local = new RouteRegistry(store.root, { authorize: context => context.action !== 'rebind' });
  denies(() => local.transact(request, 2), 'AUTHORIZATION_REQUIRED');
  assert.equal(store.transact(request, 2).generation, 3);
  assert.equal(store.snapshot().input.routes[0].metadata.projectRef, 'bravo');
});

test('rebind must name the prior owner and replace only the entire selected hostname', t => {
  const input = fixture(); input.zones[0].owners.push({ projectRef: 'bravo', environmentRef: 'review-42' });
  const { store, routes } = setup(t, () => true, input); store.transact(claim(routes), 0);
  const moved = structuredClone(routes[0]); moved.metadata.projectRef = 'bravo'; moved.metadata.name = 'moved';
  const req = { action: 'rebind', hostname: moved.spec.hostname, from: { projectRef: 'alpha', environmentRef: 'review-42' },
    to: { projectRef: 'bravo', environmentRef: 'review-42' }, routes: [moved] };
  denies(() => store.transact({ ...req, from: req.to }, 1), 'HOSTNAME_OWNERSHIP');
  denies(() => store.transact({ ...req, routes: [routes[3]] }, 1), 'REBIND_SCOPE');
  const result = store.transact(req, 1);
  assert.equal(result.input.routes.length, 8);
  assert.equal(result.input.routes.filter(r => r.metadata.projectRef === 'charlie').length, 3);
});

test('same-owner rebinding is an explicit authorized atomic transaction', t => {
  const { store, routes } = setup(t); store.transact(claim(routes), 0);
  const selected = routes.filter(r => r.spec.hostname === 'one.alpha.test').map(r => structuredClone(r));
  selected[0].spec.stripPrefix = true;
  const o = { projectRef: 'alpha', environmentRef: 'review-42' };
  const result = store.transact({ action: 'rebind', hostname: 'one.alpha.test', from: o, to: o, routes: selected }, 1);
  assert.equal(result.generation, 2); assert.equal(result.input.routes.length, 9);
  assert.equal(result.input.routes.find(r => r.metadata.name === selected[0].metadata.name && r.metadata.projectRef === 'alpha').spec.stripPrefix, true);
});

test('initialization accepts only an empty route set and never bypasses claim authorization', t => {
  const parent = fs.mkdtempSync(join(tmpdir(), 'bsk-edge-init-')); const root = join(parent, 'new');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  denies(() => RouteRegistry.initialize(root, fixture()), 'INITIAL_ROUTES');
  assert.equal(fs.existsSync(root), false);
});

test('lock write errors are redacted and remove only the owned lock', t => {
  const { root, store, routes } = setup(t);
  try {
    t.mock.method(fs, 'writeFileSync', () => { throw new Error('sensitive-lock-path'); }); syncBuiltinESMExports();
    denies(() => store.transact(claim(routes), 0), 'REGISTRY_WRITE');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.equal(fs.existsSync(join(root, '.lock')), false);
  assert.equal(store.snapshot().generation, 0);
});

test('exclusive locks are bounded and never stolen based on age or claimed PID', t => {
  const { root, store, routes } = setup(t);
  fs.writeFileSync(join(root, '.lock'), 'stale-or-live');
  denies(() => store.transact(claim(routes), 0), 'REGISTRY_BUSY');
  assert.equal(fs.readFileSync(join(root, '.lock'), 'utf8'), 'stale-or-live');
  assert.equal(store.snapshot().generation, 0);
});

test('corrupt, oversized, forged and foreign-scope persistent state rejects', t => {
  const { root, store } = setup(t); const file = join(root, 'registry.json'); const before = fs.readFileSync(file);
  for (const data of ['{', '{}', 'x'.repeat(1024 * 1024 + 1),
    JSON.stringify({ ...JSON.parse(before), checksum: 'a'.repeat(64) })]) {
    fs.writeFileSync(file, data); denies(() => store.snapshot(), 'CORRUPT_REGISTRY');
  }
  fs.writeFileSync(file, before);
  denies(() => new RouteRegistry(root, { installationRef: 'foreign' }).snapshot(), 'REGISTRY_SCOPE');
  denies(() => RouteRegistry.initialize(root, store.snapshot().input), 'ALREADY_INITIALIZED');
});

test('failed atomic rename preserves committed claims and releases only its own lock', t => {
  const { root, store, routes } = setup(t); store.transact(claim([routes[0]]), 0);
  const before = fs.readFileSync(join(root, 'registry.json'));
  try {
    t.mock.method(fs, 'renameSync', () => { throw new Error('sensitive-host-path'); }); syncBuiltinESMExports();
    denies(() => store.transact(claim([routes[1]]), 1), 'REGISTRY_WRITE');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  assert.deepEqual(fs.readFileSync(join(root, 'registry.json')), before);
  assert.ok(!fs.existsSync(join(root, '.lock')));
  assert.equal(store.snapshot().generation, 1);
});

test('state graph and reservation corruption rejects even with a recomputed checksum', t => {
  const { root, store, routes } = setup(t); store.transact(claim(routes), 0);
  const path = join(root, 'registry.json'); const baseline = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const mutate of [s => { s.snapshot.generation = -1; }, s => { s.hostnameOwners[0].projectRef = 'bravo'; },
    s => { s.hostnameOwners = []; }, s => { s.snapshot.input.routes[0].spec.serviceRef = 'unknown'; },
    s => { s.snapshot.extra = true; }]) {
    const s = structuredClone(baseline); mutate(s); const { checksum, ...body } = s;
    fs.writeFileSync(path, JSON.stringify({ ...body, checksum: hash(body) }));
    denies(() => store.snapshot(), 'CORRUPT_REGISTRY');
  }
});

test('root symlinks or junctions are not accepted as a registry directory', t => {
  const { root, store } = setup(t); const alias = join(root, 'alias');
  fs.symlinkSync(root, alias, 'junction');
  denies(() => new RouteRegistry(alias).snapshot(), 'CORRUPT_REGISTRY');
  assert.equal(store.snapshot().generation, 0);
});

test('real process interruption before/after rename leaves a complete readable generation and closed lock', t => {
  for (const after of [false, true]) {
    const { root, store, routes } = setup(t);
    const url = new URL('../lib/registry.mjs', import.meta.url).href;
    const code = `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {RouteRegistry} from ${JSON.stringify(url)};
      const rename=fs.renameSync;fs.renameSync=(...a)=>{if(${after})rename(...a);process.exit(23)};syncBuiltinESMExports();
      new RouteRegistry(${JSON.stringify(root)},{authorize:()=>true}).transact(${JSON.stringify(claim([routes[0]]))},0);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { timeout: 10000 });
    assert.equal(result.status, 23);
    assert.equal(store.snapshot().generation, after ? 1 : 0);
    assert.equal(store.snapshot().input.routes.length, after ? 1 : 0);
    assert.ok(fs.existsSync(join(root, '.lock')));
    denies(() => store.transact(claim([routes[1]]), after ? 1 : 0), 'REGISTRY_BUSY');
  }
});

test('real concurrent processes cannot lose unrelated routes through the same stale generation', async t => {
  const { root, store, routes } = setup(t); const url = new URL('../lib/registry.mjs', import.meta.url).href;
  const launch = route => new Promise((resolve, reject) => {
    const code = `import {RouteRegistry} from ${JSON.stringify(url)};try{new RouteRegistry(${JSON.stringify(root)},{authorize:()=>true}).transact(${JSON.stringify(claim([route]))},0)}catch(e){process.stdout.write(e.code);process.exitCode=1}`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { timeout: 10000 });
    let out = ''; child.stdout.on('data', b => { out += b; }); child.on('error', reject); child.on('close', status => resolve({ status, out }));
  });
  const results = await Promise.all([launch(routes[0]), launch(routes[3])]);
  assert.equal(results.filter(r => r.status === 0).length, 1);
  assert.match(results.find(r => r.status !== 0).out, /REGISTRY_BUSY|STALE_GENERATION/);
  assert.equal(store.snapshot().generation, 1); assert.equal(store.snapshot().input.routes.length, 1);
});

test('closed transactions reject unknown operations, references and reentrant mutation', t => {
  const { root, store, routes } = setup(t);
  denies(() => store.transact({ action: 'apply', command: 'shell' }, 0), 'TRANSACTION');
  denies(() => store.transact({ ...claim(routes), gatewayDirective: 'raw' }, 0), 'TRANSACTION');
  denies(() => store.transact(release([routes[0]]), 0), 'UNRESOLVED_REFERENCE');
  const recursive = new RouteRegistry(root, { authorize() { denies(() => store.transact(claim(routes), 0), 'REGISTRY_BUSY'); return true; } });
  assert.equal(recursive.transact(claim(routes), 0).generation, 1);
});
