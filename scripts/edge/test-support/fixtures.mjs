export function fixture() {
  const installationRef = 'fixture-install';
  const resource = (kind, name, spec, projectRef, environmentRef) => ({ apiVersion: 'bsk/v0alpha1', kind,
    metadata: { name, installationRef, ...(projectRef ? { projectRef } : {}), ...(environmentRef ? { environmentRef } : {}) }, spec });
  const input = { apiVersion: 'bsk.edge/v0alpha1', kind: 'RouteRegistryInput', installationRef,
    declarations: { apiVersion: 'bsk/v0alpha1', resources: [], catalog: { policies: ['disposable'], runtimes: ['node'], routes: [] } },
    hosts: [{ name: 'host-a', installationRef }],
    gateways: [resource('EdgeGateway', 'edge', { hostRef: 'host-a', driver: 'caddy', listenerPorts: [80, 443] })],
    zones: [], deployments: [], routes: [] };
  for (const project of ['alpha', 'bravo', 'charlie']) {
    input.declarations.resources.push(resource('Project', project, { ownerRef: `team-${project}` }),
      resource('Environment', 'review-42', { policyRef: 'disposable' }, project),
      resource('Service', 'http', { runtimeRef: 'node', port: 8080 }, project));
    input.zones.push({ name: `zone-${project}`, installationRef, hostname: `${project}.test`, visibility: 'public',
      owners: [{ projectRef: project, environmentRef: 'review-42' }] });
    input.deployments.push({ resource: resource('Deployment', 'release-1', { serviceRef: 'http', hostRef: 'host-a',
      artifact: `fixture/http@sha256:${'a'.repeat(64)}`, serviceGeneration: 1 }, project, 'review-42'), visibility: 'public' });
    for (const prefix of ['one', 'two']) input.routes.push(resource('DomainBinding', `${prefix}-root`, {
      gatewayRef: 'edge', zoneRef: `zone-${project}`, hostname: `${prefix}.${project}.test`, pathPrefix: '/',
      serviceRef: 'http', deploymentRef: 'release-1', visibility: 'public', stripPrefix: false }, project, 'review-42'));
    const nested = structuredClone(input.routes.at(-2)); nested.metadata.name = 'one-api';
    nested.spec.pathPrefix = '/api'; nested.spec.stripPrefix = true; input.routes.push(nested);
  }
  return input;
}

export function reverse(value) {
  if (Array.isArray(value)) return value.map(reverse).reverse();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)]));
  return value;
}

export const denies = (fn, code) => {
  try { fn(); } catch (e) { if (e.code === code) return; throw e; }
  throw new Error(`Expected rejection: ${code}`);
};
