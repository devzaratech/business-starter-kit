import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(
  new URL('../../../contracts/schemas/bsk-declaration-v0alpha1.schema.json', import.meta.url), 'utf8'
));
const validateShape = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Array tuples avoid ambiguity when names contain hyphens or share prefixes.
export function resourceKey(resource) {
  const m = resource.metadata;
  return [m.installationRef, resource.kind, m.projectRef ?? null, null, m.name];
}

function identity(installation, kind, project, name) {
  return JSON.stringify([installation, kind, project ?? null, null, name]);
}

function result(diagnostics) {
  const unique = new Map(diagnostics.map(d => [JSON.stringify(d), d]));
  const sorted = [...unique.values()].sort((a, b) =>
    compare(a.path, b.path) || compare(a.code, b.code) || compare(a.message, b.message));
  return { valid: sorted.length === 0, diagnostics: sorted };
}

export function validateBundle(value) {
  if (Array.isArray(value?.resources) && Array.isArray(value?.catalog?.routes) &&
      value.resources.length + value.catalog.routes.length > 1000) {
    return result([{ code: 'BUNDLE_LIMIT', path: '/', message: 'Bundle exceeds the resource and route count limit.' }]);
  }
  if (!validateShape(value)) {
    // Ajv params/messages may contain untrusted values or property names. Do not echo them.
    return result(validateShape.errors.map(error => ({
      code: 'SCHEMA', path: error.instancePath || '/', message: 'Value does not match the declaration schema.'
    })));
  }

  const diagnostics = [];
  const byKey = new Map();
  const add = (code, path, message) => diagnostics.push({ code, path, message });
  value.resources.forEach((r, i) => {
    const key = JSON.stringify(resourceKey(r));
    if (byKey.has(key)) add('DUPLICATE_RESOURCE', `/resources/${i}/metadata`, 'Resource identity is already declared in this scope.');
    byKey.set(key, r);
  });

  function requireRef(installation, kind, project, name, path) {
    if (!byKey.has(identity(installation, kind, project, name))) {
      add('UNRESOLVED_REFERENCE', path, 'Reference is not declared in the required scope.');
    }
  }

  const policies = new Set(value.catalog.policies);
  const runtimes = new Set(value.catalog.runtimes);
  const totals = new Map();
  value.resources.forEach((r, i) => {
    const { metadata: m, spec } = r;
    if (r.kind !== 'Project') requireRef(m.installationRef, 'Project', null, m.projectRef, `/resources/${i}/metadata/projectRef`);
    const catalogField = r.kind === 'Environment' ? 'policyRef' : r.kind === 'Service' ? 'runtimeRef' : null;
    const catalog = r.kind === 'Environment' ? policies : runtimes;
    if (catalogField && !catalog.has(spec[catalogField])) {
      add('UNRESOLVED_REFERENCE', `/resources/${i}/spec/${catalogField}`, 'Reference is not present in the explicit catalog.');
    }
    if (r.kind !== 'Service' || !spec.resources) return;
    const limits = spec.resources;
    for (const [request, limit] of [['cpuRequestMillis', 'cpuLimitMillis'], ['memoryRequestBytes', 'memoryLimitBytes']]) {
      if (limits[request] > limits[limit]) add('RESOURCE_BOUNDS', `/resources/${i}/spec/resources/${request}`, 'Resource request exceeds its limit.');
    }
    for (const field of Object.keys(limits).filter(field => field !== 'replicas')) {
      const amount = BigInt(limits[field]) * BigInt(limits.replicas);
      const key = JSON.stringify([m.installationRef, field]);
      const total = (totals.get(key) ?? 0n) + amount;
      totals.set(key, total);
      if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
        add('RESOURCE_OVERFLOW', `/resources/${i}/spec/resources/${field}`, 'Replicated or aggregate resource value exceeds safe integer bounds.');
      }
    }
  });

  const hosts = new Map();
  const routes = new Set();
  value.catalog.routes.forEach((r, i) => {
    const path = `/catalog/routes/${i}`;
    requireRef(r.installationRef, 'Project', null, r.projectRef, `${path}/projectRef`);
    requireRef(r.installationRef, 'Environment', r.projectRef, r.environmentRef, `${path}/environmentRef`);
    requireRef(r.installationRef, 'Service', r.projectRef, r.serviceRef, `${path}/serviceRef`);
    const hostKey = JSON.stringify([r.installationRef, r.hostname]);
    const owner = JSON.stringify([r.projectRef, r.environmentRef]);
    if (hosts.has(hostKey) && hosts.get(hostKey) !== owner) {
      add('HOSTNAME_OWNERSHIP', `${path}/hostname`, 'Hostname is claimed by another project or environment.');
    }
    hosts.set(hostKey, owner);
    const routeKey = JSON.stringify([r.installationRef, r.hostname, r.pathPrefix]);
    if (routes.has(routeKey)) add('DUPLICATE_ROUTE', path, 'Route is already claimed, independently of visibility.');
    routes.add(routeKey);
  });
  return result(diagnostics);
}
