import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateBundle } from '../../declarations/lib/validate.mjs';

const declaration = JSON.parse(readFileSync(new URL('../../../contracts/schemas/bsk-declaration-v0alpha1.schema.json', import.meta.url)));
const schema = JSON.parse(readFileSync(new URL('../../../contracts/schemas/bsk-edge-v0alpha1.schema.json', import.meta.url)));
const ajv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
ajv.addSchema(declaration);
const shape = ajv.compile(schema);
const hostShape = ajv.compile({ $ref: `${declaration.$id}#/$defs/hostname` });
const pathShape = ajv.compile({ $ref: `${declaration.$id}#/$defs/route/properties/pathPrefix` });
const closed = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const slug = { $ref: `${declaration.$id}#/$defs/slug` };
const bindings = { type: 'array', minItems: 1, maxItems: 1000, items: { $ref: `${schema.$id}#/$defs/binding` } };
const ownerShape = closed({ projectRef: slug, environmentRef: slug });
const transactionShape = ajv.compile({ oneOf: [
  closed({ action: { const: 'claim' }, routes: bindings }),
  closed({ action: { const: 'release' }, bindingRefs: { type: 'array', minItems: 1, maxItems: 1000, uniqueItems: true,
    items: closed({ name: slug, projectRef: slug, environmentRef: slug }) } }),
  closed({ action: { const: 'rebind' }, hostname: { $ref: `${declaration.$id}#/$defs/hostname` }, from: ownerShape, to: ownerShape, routes: bindings })
] });
export const version = 'bsk.edge/v0alpha1';
export const maxBytes = 1024 * 1024;
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const key = (...parts) => JSON.stringify(parts);
export const owner = m => key(m.projectRef, m.environmentRef);
export const claimKey = r => key(r.metadata.installationRef, r.spec.hostname, r.spec.pathPrefix);
export const bindingKey = r => key(r.metadata.projectRef, r.metadata.environmentRef, r.metadata.name);
export function fail(code) { throw Object.assign(new Error(`Route registry rejected input: ${code}.`), { code }); }
export function canonical(value, sets = false) {
  if (Array.isArray(value)) {
    const items = value.map(v => canonical(v, sets));
    return sets ? items.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))) : items;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k], sets)]));
  return value;
}
export const hash = value => createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
export function bounded(value) {
  try { if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) fail('INPUT_LIMIT'); }
  catch (e) { if (e.code === 'INPUT_LIMIT') throw e; fail('SCHEMA'); }
}
function unique(items, identify) {
  if (new Set(items.map(identify)).size !== items.length) fail('DUPLICATE_RESOURCE');
}
function requireRef(value) { if (!value) fail('UNRESOLVED_REFERENCE'); return value; }

export function validateInput(input) {
  bounded(input);
  if (!shape(input)) fail('SCHEMA');
  const { installationRef, declarations, hosts, gateways, zones, deployments, routes } = input;
  if (declarations.resources.length + hosts.length + gateways.length + zones.length + deployments.length + routes.length > 2000) fail('INPUT_LIMIT');
  const allMetadata = [...declarations.resources.map(r => r.metadata), ...hosts, ...gateways.map(r => r.metadata),
    ...zones, ...deployments.map(d => d.resource.metadata), ...routes.map(r => r.metadata)];
  if (allMetadata.some(m => m.installationRef !== installationRef)) fail('INSTALLATION_SCOPE');
  const projected = routes.map(({ metadata: m, spec: s }) => ({ installationRef, projectRef: m.projectRef, environmentRef: m.environmentRef,
    serviceRef: s.serviceRef, hostname: s.hostname, pathPrefix: s.pathPrefix, visibility: s.visibility, stripPrefix: s.stripPrefix }));
  const checked = validateBundle({ ...declarations, catalog: { ...declarations.catalog, routes: projected } });
  if (!checked.valid) {
    for (const code of ['UNRESOLVED_REFERENCE', 'HOSTNAME_OWNERSHIP', 'DUPLICATE_ROUTE']) if (checked.diagnostics.some(d => d.code === code)) fail(code);
    fail('DECLARATIONS');
  }
  unique(hosts, h => h.name); unique(gateways, g => g.metadata.name); unique(zones, z => z.name);
  unique(deployments, d => bindingKey(d.resource)); unique(routes, bindingKey);
  const occupied = new Set();
  for (const g of gateways) {
    requireRef(hosts.find(h => h.name === g.spec.hostRef));
    // One installation-owned edge per host, independent of the chosen adapter.
    if (occupied.has(g.spec.hostRef)) fail('GATEWAY_HOST_CONFLICT');
    occupied.add(g.spec.hostRef);
  }
  const resource = (kind, m, name) => declarations.resources.find(r => r.kind === kind && r.metadata.name === name &&
    (kind === 'Project' || r.metadata.projectRef === m.projectRef));
  const scopeRefs = m => { requireRef(resource('Project', m, m.projectRef)); requireRef(resource('Environment', m, m.environmentRef)); };
  for (const z of zones) for (const m of z.owners) scopeRefs(m);
  for (const { resource: d } of deployments) {
    scopeRefs(d.metadata); requireRef(resource('Service', d.metadata, d.spec.serviceRef));
    requireRef(hosts.find(h => h.name === d.spec.hostRef));
  }
  const visibilities = new Map();
  for (const r of routes) {
    const { metadata: m, spec: s } = r;
    const g = requireRef(gateways.find(g => g.metadata.name === s.gatewayRef));
    const z = requireRef(zones.find(z => z.name === s.zoneRef));
    const d = requireRef(deployments.find(d => d.resource.metadata.name === s.deploymentRef && owner(d.resource.metadata) === owner(m)));
    if (d.resource.spec.serviceRef !== s.serviceRef) fail('UNRESOLVED_REFERENCE');
    if (d.resource.spec.hostRef !== g.spec.hostRef) fail('HOST_PLACEMENT');
    if (!z.owners.some(o => owner(o) === owner(m)) || !(s.hostname === z.hostname || s.hostname.endsWith(`.${z.hostname}`))) fail('ZONE_OWNERSHIP');
    if (s.visibility === 'public' && (z.visibility !== 'public' || d.visibility !== 'public')) fail('PRIVATE_EXPOSURE');
    if (visibilities.has(s.hostname) && visibilities.get(s.hostname) !== s.visibility) fail('HOST_VISIBILITY');
    visibilities.set(s.hostname, s.visibility);
  }
  return canonical(input, true);
}

export function validateMatch(hostname, path) {
  if (!hostShape(hostname) || !pathShape(path)) fail('SCHEMA');
}

export function validateTransaction(value) {
  bounded(value);
  if (!transactionShape(value)) fail('TRANSACTION');
  return structuredClone(value);
}

export function validateSnapshot(s) {
  if (!s || Object.keys(s).sort().join(',') !== 'apiVersion,generation,input,kind' || s.apiVersion !== version ||
    s.kind !== 'RouteRegistrySnapshot' || !Number.isSafeInteger(s.generation) || s.generation < 0) fail('CORRUPT_REGISTRY');
  return { apiVersion: version, kind: s.kind, generation: s.generation, input: validateInput(s.input) };
}
