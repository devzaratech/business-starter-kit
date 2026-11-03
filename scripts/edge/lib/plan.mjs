import { createHash } from 'node:crypto';
import { validateSnapshot, validateMatch, compare, owner, canonical, fail, version } from './model.mjs';

/** @typedef {import('./ports.d.ts').IngressCandidate} IngressCandidate */

/** Pure offline planning. Logical upstream references are not executable endpoints.
 * @returns {IngressCandidate}
 */
export function planCandidate(snapshot, gatewayRef) {
  const { input, generation } = validateSnapshot(snapshot);
  const gateway = input.gateways.find(g => g.metadata.name === gatewayRef);
  if (!gateway) fail('UNRESOLVED_REFERENCE');
  const routes = input.routes.filter(r => r.spec.gatewayRef === gatewayRef && r.spec.visibility === 'public').map(r => {
    const { metadata: m, spec: s } = r;
    const service = input.declarations.resources.find(d => d.kind === 'Service' && d.metadata.projectRef === m.projectRef && d.metadata.name === s.serviceRef);
    const deployment = input.deployments.find(d => d.resource.metadata.name === s.deploymentRef && owner(d.resource.metadata) === owner(m)).resource;
    return { bindingRef: { installationRef: m.installationRef, kind: 'DomainBinding', projectRef: m.projectRef,
      environmentRef: m.environmentRef, name: m.name }, hostname: s.hostname, pathPrefix: s.pathPrefix, stripPrefix: s.stripPrefix,
      match: 'exact-or-segment-prefix', upstream: { installationRef: input.installationRef, projectRef: m.projectRef,
        environmentRef: m.environmentRef, serviceRef: s.serviceRef, deploymentRef: s.deploymentRef,
        hostRef: deployment.spec.hostRef, port: service.spec.port } };
  }).sort((a, b) => compare(a.hostname, b.hostname) || b.pathPrefix.length - a.pathPrefix.length || compare(a.pathPrefix, b.pathPrefix));
  // Canonicalize object keys without sorting the precedence-ordered route array.
  const body = canonical({ apiVersion: version, kind: 'IngressCandidate', mode: 'dry-run', boundary: 'IngressDriver',
    target: { installationRef: input.installationRef, gatewayRef, hostRef: gateway.spec.hostRef, driver: gateway.spec.driver },
    registryGeneration: generation, desired: { listenerPorts: [...gateway.spec.listenerPorts].sort((a, b) => a - b), routes },
    applied: null, observed: null }, false);
  return { ...body, planId: createHash('sha256').update(JSON.stringify(body), 'utf8').digest('hex') };
}

// Reference semantics for adapters; incoming URLs must be parsed separately.
export function matchRoute(candidate, hostname, path) {
  validateMatch(hostname, path);
  let route = null;
  for (const r of candidate.desired.routes) {
    if (r.hostname === hostname && (r.pathPrefix === '/' || path === r.pathPrefix || path.startsWith(`${r.pathPrefix}/`)) &&
      (!route || r.pathPrefix.length > route.pathPrefix.length)) route = r;
  }
  if (!route) return null;
  return { route, forwardPath: route.stripPrefix && route.pathPrefix !== '/' ? (path.slice(route.pathPrefix.length) || '/') : path };
}
