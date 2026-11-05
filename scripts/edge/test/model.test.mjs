import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../lib/model.mjs';
import { fixture, denies } from '../test-support/fixtures.mjs';

test('accepts three projects, six .test hosts, root and same-owner nested routes', () => {
  const input = fixture(); assert.equal(new Set(input.routes.map(r => r.spec.hostname)).size, 6);
  assert.equal(validateInput(input).routes.length, 9);
});

for (const [name, mutate, code] of [
  ['unsupported version', b => { b.apiVersion = 'bsk.edge/v1'; }, 'SCHEMA'],
  ['unknown input', b => { b.upstream = 'http://localhost'; }, 'SCHEMA'],
  ['raw upstream URL', b => { b.routes[0].spec.upstream = 'http://169.254.169.254'; }, 'SCHEMA'],
  ['raw socket', b => { b.deployments[0].resource.spec.socket = '/docker.sock'; }, 'SCHEMA'],
  ['raw directive', b => { b.routes[0].spec.directive = 'reverse_proxy'; }, 'SCHEMA'],
  ['wildcard', b => { b.routes[0].spec.hostname = '*.alpha.test'; }, 'SCHEMA'],
  ['uppercase', b => { b.routes[0].spec.hostname = 'ONE.alpha.test'; }, 'SCHEMA'],
  ['IP hostname', b => { b.routes[0].spec.hostname = '127.0.0.1'; }, 'SCHEMA'],
  ['trailing newline', b => { b.routes[0].spec.hostname += '\n'; }, 'SCHEMA'],
  ['path traversal', b => { b.routes[0].spec.pathPrefix = '/../admin'; }, 'SCHEMA'],
  ['percent encoding', b => { b.routes[0].spec.pathPrefix = '/api%2fadmin'; }, 'SCHEMA'],
  ['regex', b => { b.routes[0].spec.pathPrefix = '/(.*)'; }, 'SCHEMA'],
  ['duplicate slash', b => { b.routes[0].spec.pathPrefix = '/api//admin'; }, 'SCHEMA'],
  ['trailing slash', b => { b.routes[0].spec.pathPrefix = '/api/'; }, 'SCHEMA'],
  ['duplicate claim', b => { const r = structuredClone(b.routes[0]); r.metadata.name = 'duplicate'; b.routes.push(r); }, 'DUPLICATE_ROUTE'],
  ['cross-owner hostname', b => { b.routes[3].spec.hostname = b.routes[0].spec.hostname; }, 'HOSTNAME_OWNERSHIP'],
  ['cross-owner nested capture', b => { b.routes[3].spec.hostname = b.routes[0].spec.hostname; b.routes[3].spec.pathPrefix = '/other'; }, 'HOSTNAME_OWNERSHIP'],
  ['installation owner', b => { b.gateways[0].metadata.installationRef = 'foreign'; }, 'INSTALLATION_SCOPE'],
  ['unknown host', b => { b.gateways[0].spec.hostRef = 'foreign'; }, 'UNRESOLVED_REFERENCE'],
  ['duplicate host', b => { b.hosts.push(structuredClone(b.hosts[0])); }, 'DUPLICATE_RESOURCE'],
  ['duplicate public edge', b => { const g = structuredClone(b.gateways[0]); g.metadata.name = 'second'; b.gateways.push(g); }, 'GATEWAY_HOST_CONFLICT'],
  ['unknown gateway', b => { b.routes[0].spec.gatewayRef = 'foreign'; }, 'UNRESOLVED_REFERENCE'],
  ['unknown zone', b => { b.routes[0].spec.zoneRef = 'foreign'; }, 'UNRESOLVED_REFERENCE'],
  ['foreign zone', b => { b.zones[0].owners = [{ projectRef: 'bravo', environmentRef: 'review-42' }]; }, 'ZONE_OWNERSHIP'],
  ['zone suffix confusion', b => { b.routes[0].spec.hostname = 'fakealpha.test'; }, 'ZONE_OWNERSHIP'],
  ['foreign environment', b => { b.routes[0].metadata.environmentRef = 'unknown'; }, 'UNRESOLVED_REFERENCE'],
  ['unresolved service', b => { b.routes[0].spec.serviceRef = 'unknown'; }, 'UNRESOLVED_REFERENCE'],
  ['unresolved deployment', b => { b.routes[0].spec.deploymentRef = 'unknown'; }, 'UNRESOLVED_REFERENCE'],
  ['deployment service mismatch', b => { b.deployments[0].resource.spec.serviceRef = 'unknown'; }, 'UNRESOLVED_REFERENCE'],
  ['mutable artifact', b => { b.deployments[0].resource.spec.artifact = 'fixture/http:latest'; }, 'SCHEMA'],
  ['private deployment exposure', b => { b.deployments[0].visibility = 'private'; }, 'PRIVATE_EXPOSURE'],
  ['private zone exposure', b => { b.zones[0].visibility = 'private'; }, 'PRIVATE_EXPOSURE'],
  ['private path under public catch-all', b => { b.routes[2].spec.visibility = 'private'; }, 'HOST_VISIBILITY'],
  ['ES1 embedded competing routes', b => { b.declarations.catalog.routes.push({}); }, 'SCHEMA'],
]) test(`rejects ${name}`, () => { const b = fixture(); mutate(b); denies(() => validateInput(b), code); });

test('closed diagnostics never echo untrusted values', () => {
  const b = fixture(); b.routes[0].spec.upstream = 'synthetic-sensitive-value';
  assert.throws(() => validateInput(b), e => e.code === 'SCHEMA' && !JSON.stringify(e).includes('synthetic-sensitive-value') && !e.message.includes('synthetic-sensitive-value'));
});

test('an empty installation still requires an explicit host and gateway', () => {
  const b = fixture(); b.routes = []; b.gateways = [];
  denies(() => validateInput(b), 'SCHEMA');
});

test('hostname exclusivity is installation-wide across distinct gateway hosts', () => {
  const b = fixture(); b.hosts.push({ name: 'host-b', installationRef: b.installationRef });
  const g = structuredClone(b.gateways[0]); g.metadata.name = 'edge-b'; g.spec.hostRef = 'host-b'; b.gateways.push(g);
  b.deployments.find(d => d.resource.metadata.projectRef === 'bravo').resource.spec.hostRef = 'host-b';
  b.routes.filter(r => r.metadata.projectRef === 'bravo').forEach(r => { r.spec.gatewayRef = 'edge-b'; });
  assert.equal(validateInput(b).gateways.length, 2);
  const duplicate = structuredClone(b.routes[0]); duplicate.metadata.name = 'other-gateway'; duplicate.spec.gatewayRef = 'edge-b';
  denies(() => validateInput({ ...b, routes: [...b.routes, duplicate] }), 'DUPLICATE_ROUTE');
  b.routes[3].spec.hostname = b.routes[0].spec.hostname; b.routes[3].spec.pathPrefix = '/nested';
  denies(() => validateInput(b), 'HOSTNAME_OWNERSHIP');
});

for (const moveRoot of [false, true]) test(`rejects same-owner hostname fragmented across gateways (move root=${moveRoot})`, () => {
  const b = fixture(); b.hosts.push({ name: 'host-b', installationRef: b.installationRef });
  const gateway = structuredClone(b.gateways[0]); gateway.metadata.name = 'edge-b'; gateway.spec.hostRef = 'host-b'; b.gateways.push(gateway);
  const deployment = structuredClone(b.deployments[0]); deployment.resource.metadata.name = 'release-2'; deployment.resource.spec.hostRef = 'host-b'; b.deployments.push(deployment);
  const moved = b.routes[moveRoot ? 0 : 2]; moved.spec.gatewayRef = 'edge-b'; moved.spec.deploymentRef = 'release-2';
  denies(() => validateInput(b), 'HOST_GATEWAY');
  // Moving every binding of the hostname coherently remains valid.
  b.routes.filter(r => r.spec.hostname === moved.spec.hostname).forEach(r => { r.spec.gatewayRef = 'edge-b'; r.spec.deploymentRef = 'release-2'; });
  assert.equal(validateInput(b).gateways.length, 2);
});
