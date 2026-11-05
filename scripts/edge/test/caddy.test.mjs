import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import cp from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { renderCaddy } from '../adapters/caddy/render.mjs';
import { resolveComposeUpstreams } from '../adapters/caddy/resolve.mjs';
import { caddyFixture, recandidate, rebuild } from '../test-support/caddy.mjs';
import { reverse, denies } from '../test-support/fixtures.mjs';
import { hash } from '../lib/model.mjs';

const render = f => renderCaddy(f.candidate, { snapshot: f.snapshot, runtime: f.runtime });
const server = result => result.config.apps.http.servers.bsk;

test('renders three projects/six public .test hostnames with exact candidate identity and scoped route references', () => {
  const f = caddyFixture(); const before = JSON.stringify(f); const result = render(f);
  assert.equal(result.mode, 'dry-run'); assert.equal(result.candidatePlanId, f.candidate.planId);
  assert.equal(result.registryGeneration, 7); assert.deepEqual(result.target, f.candidate.target);
  assert.equal(result.applied, null); assert.equal(result.observed, null); assert.equal(result.runtimeValidation, 'not-performed');
  assert.deepEqual(result.config.admin, { disabled: true, config: { persist: false } });
  assert.deepEqual(server(result).listen, [':80']); assert.deepEqual(server(result).automatic_https, { disable: true });
  assert.equal(new Set(result.routeBindings.map(r => r.hostname)).size, 6);
  assert.deepEqual(result.routeBindings.map(r => r.bindingRef), f.candidate.desired.routes.map(r => r.bindingRef));
  assert.equal(result.requiredNetworks.length, 3); assert.equal(result.routeBindings.length, 10);
  assert.equal(JSON.stringify(f), before);
  const { renderId, ...body } = result; assert.equal(renderId, hash(body));
  assert.deepEqual(server(result).routes.at(-1), { handle: [{ handler: 'static_response', status_code: 404 }], terminal: true });
});

// This interprets only our emitted fixed JSON subset. It is not a live Caddy test.
function request(result, hostname, path) {
  const route = server(result).routes.find(r => !r.match || r.match.some(m => m.host.includes(hostname) && new RegExp(m.path_regexp.pattern).test(path)));
  let forwarded = path;
  for (const h of route.handle) {
    if (h.handler === 'rewrite') forwarded = h.uri ?? forwarded.slice(h.strip_path_prefix.length);
    if (h.handler === 'reverse_proxy') return { path: forwarded, upstreams: h.upstreams };
  }
  return { status: route.handle.at(-1).status_code };
}

test('Caddy JSON preserves adversarial longest-prefix, segment, exact strip and root fallback behavior', () => {
  const f = caddyFixture(); const result = render(f);
  const patterns = server(result).routes.filter(r => r.match?.[0].host.includes('one.alpha.test')).map(r => r.match[0].path_regexp.pattern);
  assert.deepEqual(patterns, ['^/api/v2$', '^/api/v2/.*$', '^/api$', '^/api/.*$', '^/.*$']);
  for (const [path, expected] of [['/api/v2/users', '/users'], ['/api/v2', '/'], ['/api/users', '/users'], ['/api', '/'],
    ['/api/v2x', '/v2x'], ['/apix', '/apix'], ['/API/users', '/API/users'], ['/else', '/else'], ['/', '/']]) {
    assert.equal(request(result, 'one.alpha.test', path).path, expected);
  }
  assert.equal(request(result, 'foreign.test', '/').status, 404);
  f.snapshot.input.routes.filter(r => r.metadata.projectRef === 'alpha').forEach(r => { r.spec.stripPrefix = false; }); recandidate(f);
  assert.equal(request(render(f), 'one.alpha.test', '/api/users').path, '/api/users');
});

test('candidate/input key order and observation set order do not alter rendered bytes', () => {
  const f = caddyFixture(); const before = JSON.stringify(render(f));
  f.snapshot = reverse(f.snapshot); recandidate(f);
  const reverseKeys = v => Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object' ?
    Object.fromEntries(Object.entries(v).reverse().map(([k, value]) => [k, reverseKeys(value)])) : v;
  f.runtime = reverseKeys(f.runtime); f.runtime.deployments.reverse();
  for (const d of f.runtime.deployments) { d.objects.reverse(); d.addresses.reverse(); }
  assert.equal(JSON.stringify(render(f)), before);
});

test('all admitted HTTP replicas are resolved and sorted without mutating observation order', () => {
  const f = caddyFixture(); const d = f.runtime.deployments[0]; d.entry.request.workloads[0].resources.replicas = 2; rebuild(d);
  const first = d.objects.find(o => o.kind === 'container' && o.labels['dev.bsk.service'] === 'http');
  const second = structuredClone(first); second.id = 'e'.repeat(64); second.name = first.name.replace(/-1$/, '-2'); d.objects.push(second);
  d.objects.filter(o => o.kind === 'network' && first.networks.includes(o.name)).forEach(o => o.attachments.push(second.id));
  d.addresses.push({ ...d.addresses[0], containerId: second.id, ipv4: '172.20.0.3' });
  const before = JSON.stringify(render(f)); d.objects.reverse(); d.addresses.reverse();
  const result = render(f); assert.equal(JSON.stringify(result), before);
  assert.deepEqual(request(result, 'one.alpha.test', '/').upstreams, [{ dial: '172.20.0.2:8080' }, { dial: '172.20.0.3:8080' }]);
});

test('private routes are absent and do not require runtime resolution', () => {
  const f = caddyFixture(); f.snapshot.input.routes.filter(r => r.metadata.projectRef === 'charlie').forEach(r => { r.spec.visibility = 'private'; });
  recandidate(f); f.runtime.deployments.pop();
  const result = render(f); assert.doesNotMatch(JSON.stringify(result), /charlie|172\.22\./);
  assert.equal(result.requiredNetworks.length, 2);
});

test('self-consistent forged candidate digests cannot substitute for the trusted registry', () => {
  const f = caddyFixture(); f.candidate.desired.routes[0].upstream.port = 22;
  const { planId, ...body } = f.candidate; f.candidate.planId = hash(body); f.runtime.candidatePlanId = f.candidate.planId;
  denies(() => render(f), 'CANDIDATE');
});

test('no public routes yields only a deny response and requires no runtime endpoints', () => {
  const f = caddyFixture(); f.snapshot.input.routes.forEach(r => { r.spec.visibility = 'private'; }); recandidate(f);
  f.runtime.deployments = [];
  const result = render(f); assert.equal(server(result).routes.length, 1);
  assert.deepEqual(result.routeBindings, []); assert.deepEqual(result.requiredNetworks, []);
  assert.doesNotMatch(JSON.stringify(result.config), /alpha|bravo|charlie|reverse_proxy|172\./);
});

test('unsafe registry ownership or private exposure cannot be laundered through a candidate', () => {
  const f = caddyFixture(); f.snapshot.input.deployments[0].visibility = 'private'; denies(() => render(f), 'CANDIDATE');
  const g = caddyFixture(); const duplicate = structuredClone(g.snapshot.input.gateways[0]); duplicate.metadata.name = 'other';
  g.snapshot.input.gateways.push(duplicate); denies(() => render(g), 'CANDIDATE');
});

test('diagnostics do not contain untrusted endpoint or directive material', () => {
  const f = caddyFixture(); f.runtime.deployments[0].addresses[0].ipv4 = 'synthetic-sensitive-endpoint';
  assert.throws(() => render(f), e => e.code === 'ENDPOINT_POLICY' && !e.message.includes('synthetic-sensitive-endpoint'));
});

for (const [name, mutate, code] of [
  ['candidate forged digest', f => { f.candidate.planId = 'a'.repeat(64); }, 'CANDIDATE'],
  ['candidate arbitrary URL', f => { f.candidate.desired.routes[0].upstream.url = 'http://169.254.169.254'; }, 'CANDIDATE'],
  ['project Caddy directive', f => { f.candidate.desired.caddy = { admin: ':2019' }; }, 'CANDIDATE'],
  ['candidate path directive', f => { f.candidate.desired.routes[0].pathPrefix = '/{http.request.host}'; }, 'CANDIDATE'],
  ['missing deployment', f => { f.runtime.deployments.shift(); }, 'DEPLOYMENT_MISSING'],
  ['ambiguous deployment', f => { f.runtime.deployments.push(structuredClone(f.runtime.deployments[0])); }, 'DEPLOYMENT_AMBIGUOUS'],
  ['stale generation', f => { f.runtime.registryGeneration--; }, 'RUNTIME_SCOPE'],
  ['wrong candidate binding', f => { f.runtime.candidatePlanId = 'a'.repeat(64); }, 'RUNTIME_SCOPE'],
  ['foreign host', f => { f.runtime.target.hostRef = 'foreign'; }, 'RUNTIME_SCOPE'],
  ['foreign gateway', f => { f.runtime.target.gatewayRef = 'foreign'; }, 'RUNTIME_SCOPE'],
  ['foreign installation', f => { f.runtime.target.installationRef = 'foreign'; }, 'RUNTIME_SCOPE'],
  ['tampered admitted Compose plan', f => { f.runtime.deployments[0].entry.plan.compose.services.http.networks.reverse(); }, 'ADMISSION'],
  ['forged admission totals', f => { f.runtime.deployments[0].entry.admission.admitted.cpuMillis = 1; }, 'ADMISSION'],
  ['foreign runtime deployment label', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'container').labels['dev.bsk.deployment'] = 'foreign'; }, 'OWNERSHIP'],
  ['foreign project label', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'container').labels['dev.bsk.project'] = 'bravo'; }, 'OWNERSHIP'],
  ['missing environment label', f => { delete f.runtime.deployments[0].objects.find(o => o.kind === 'container').labels['dev.bsk.environment']; }, 'OWNERSHIP'],
  ['foreign network owner', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'network').labels['dev.bsk.installation'] = 'foreign'; }, 'OWNERSHIP'],
  ['missing ingress attachment', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'network' && o.name.endsWith('-ingress')).attachments = []; }, 'INGRESS_ATTACHMENT'],
  ['data-network endpoint', f => { const d = f.runtime.deployments[0]; d.addresses[0].networkId = d.objects.find(o => o.kind === 'network' && o.name.endsWith('-data')).id; }, 'INGRESS_ATTACHMENT'],
  ['foreign container ID', f => { f.runtime.deployments[0].addresses[0].containerId = 'f'.repeat(64); }, 'INGRESS_ATTACHMENT'],
  ['extra runtime URL', f => { f.runtime.deployments[0].addresses[0].url = 'http://localhost'; }, 'RUNTIME_INPUT'],
  ['Docker socket', f => { f.runtime.socket = '/var/run/docker.sock'; }, 'RUNTIME_INPUT'],
  ['host bind mount', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'container').mounts.push('unmanaged:bind'); }, 'RUNTIME_POLICY'],
  ['public database port', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'container').ports.push({ HostPort: '5432' }); }, 'RUNTIME_POLICY'],
  ['changed runtime limits', f => { f.runtime.deployments[0].objects.find(o => o.kind === 'container').limits.cpuMillis = 1; }, 'RUNTIME_POLICY'],
  ['foreign observed image', f => { f.runtime.deployments[0].addresses[0].imageRef = `fixture/foreign@sha256:${'b'.repeat(64)}`; }, 'ARTIFACT_MISMATCH'],
  ['stopped endpoint', f => { f.runtime.deployments[0].addresses[0].running = false; }, 'ENDPOINT_POLICY'],
  ['duplicate address record', f => { const d = f.runtime.deployments[0]; d.addresses.push(structuredClone(d.addresses[0])); }, 'ENDPOINT_AMBIGUOUS'],
  ['overlapping ingress subnets', f => { const d = f.runtime.deployments[1]; d.addresses[0].ipv4 = '172.20.0.3'; d.addresses[0].subnet = '172.20.0.0/24'; }, 'ENDPOINT_OVERLAP'],
  ['network address', f => { f.runtime.deployments[0].addresses[0].ipv4 = '172.20.0.0'; }, 'ENDPOINT_POLICY'],
  ['out-of-subnet address', f => { f.runtime.deployments[0].addresses[0].ipv4 = '172.21.0.2'; }, 'ENDPOINT_POLICY'],
  ['broadcast address', f => { f.runtime.deployments[0].addresses[0].ipv4 = '172.20.0.255'; }, 'ENDPOINT_POLICY'],
  ['missing endpoint address', f => { f.runtime.deployments[0].addresses = []; }, 'INGRESS_ATTACHMENT'],
]) test(`Caddy rejects ${name}`, () => { const f = caddyFixture(); mutate(f); denies(() => render(f), code); });

for (const address of ['8.8.8.8', '127.0.0.1', '169.254.169.254', '0.0.0.0', '172.020.0.2', '0xac140002', '::1', 'http://172.20.0.2', '/run/docker.sock', '172.20.0.2:8080', '{http.request.host}']) {
  test(`Caddy rejects unsafe address ${address}`, () => { const f = caddyFixture(); f.runtime.deployments[0].addresses[0].ipv4 = address; denies(() => render(f), 'ENDPOINT_POLICY'); });
}
for (const driver of ['nginx', 'traefik']) test(`Caddy rejects unsupported ${driver}`, () => {
  const f = caddyFixture(); f.snapshot.input.gateways[0].spec.driver = driver; recandidate(f); denies(() => render(f), 'DRIVER_UNSUPPORTED');
});
for (const ports of [[443], [80, 443]]) test(`Caddy rejects unimplemented TLS listeners ${ports}`, () => {
  const f = caddyFixture(); f.snapshot.input.gateways[0].spec.listenerPorts = ports; recandidate(f); denies(() => render(f), 'LISTENERS_UNSUPPORTED');
});

test('resolution rejects admitted image mismatch and non-HTTP roles', () => {
  for (const role of ['worker', 'data']) {
    const f = caddyFixture(); const d = f.runtime.deployments[0]; const w = d.entry.request.workloads[0]; w.role = role; delete w.serviceRef; rebuild(d);
    denies(() => render(f), 'ROLE_UNSUPPORTED');
  }
  const f = caddyFixture(); const d = f.runtime.deployments[0]; d.entry.request.workloads[0].image = `fixture/foreign@sha256:${'b'.repeat(64)}`; rebuild(d);
  denies(() => render(f), 'ARTIFACT_MISMATCH');
});

test('renderer and resolver perform no filesystem mutations, process execution or network/listener creation', t => {
  const f = caddyFixture();
  for (const [object, names] of [[fs, ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync', 'openSync']],
    [fsp, ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'rm', 'open']], [cp, ['spawn', 'spawnSync', 'exec', 'execFile', 'execFileSync', 'execSync']],
    [net, ['connect', 'createConnection', 'createServer']], [http, ['request', 'get', 'createServer']], [https, ['request', 'get', 'createServer']]]) {
    for (const name of names) t.mock.method(object, name, () => { throw new Error(`Forbidden side effect: ${name}`); });
  }
  syncBuiltinESMExports();
  try { assert.equal(render(f).requiredNetworks.length, 3); assert.equal(resolveComposeUpstreams(f.candidate, f.snapshot, f.runtime).length, 10); }
  finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});
