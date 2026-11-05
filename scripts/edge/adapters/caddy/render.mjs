import { canonical, hash } from '../../lib/model.mjs';
import { resolveComposeUpstreams, verifyCandidate, reject } from './resolve.mjs';

const removedHeaders = ['Forwarded', 'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto', 'X-Real-Ip', 'Cf-Connecting-Ip', 'True-Client-Ip'];

/** Offline, fixed-template Caddy JSON; never loads, starts or reloads a proxy.
 * @param {import('../../lib/ports.d.ts').IngressCandidate} value
 * @param {{snapshot: unknown, runtime: import('./ports.d.ts').TrustedComposeRuntime}} options
 * @returns {import('./ports.d.ts').CaddyRenderPlan}
 */
export function renderCaddy(value, options) {
  if (!options || Object.keys(options).sort().join(',') !== 'runtime,snapshot') reject('RUNTIME_INPUT');
  const { candidate } = verifyCandidate(value, options.snapshot);
  const resolved = resolveComposeUpstreams(candidate, options.snapshot, options.runtime);
  const routes = []; const routeBindings = []; const networks = new Map();
  for (const [i, r] of candidate.desired.routes.entries()) {
    const endpoints = resolved[i].endpoints;
    endpoints.forEach(e => networks.set(e.networkId, { id: e.networkId, name: e.networkName }));
    const proxy = { handler: 'reverse_proxy', upstreams: endpoints.map(e => ({ dial: `${e.ipv4}:${e.port}` })),
      headers: { request: { delete: [...removedHeaders] } } };
    const indexes = [];
    const emit = (pattern, rewrite) => {
      indexes.push(routes.length);
      routes.push({ match: [{ host: [r.hostname], path_regexp: { pattern } }],
        handle: [...(rewrite ? [rewrite] : []), structuredClone(proxy)], terminal: true });
    };
    // ES1 accepts only literal segment characters. No regex or placeholders enter here.
    // Generated RE2 patterns preserve case-sensitive ES3-A semantics unlike Caddy's path matcher.
    if (r.stripPrefix && r.pathPrefix !== '/') {
      emit(`^${r.pathPrefix}$`, { handler: 'rewrite', uri: '/' });
      emit(`^${r.pathPrefix}/.*$`, { handler: 'rewrite', strip_path_prefix: r.pathPrefix });
    } else emit(r.pathPrefix === '/' ? '^/.*$' : `^${r.pathPrefix}(?:/.*)?$`);
    routeBindings.push({ bindingRef: r.bindingRef, hostname: r.hostname, pathPrefix: r.pathPrefix,
      upstreamRef: r.upstream, caddyRouteIndexes: indexes, endpoints });
  }
  routes.push({ handle: [{ handler: 'static_response', status_code: 404 }], terminal: true });
  const config = { admin: { disabled: true, config: { persist: false } }, apps: { http: { servers: { bsk: {
    listen: [':80'], protocols: ['h1'], automatic_https: { disable: true }, routes
  } } } } };
  const body = canonical({ apiVersion: 'bsk.caddy/v0alpha1', kind: 'CaddyRenderPlan', mode: 'dry-run',
    candidatePlanId: candidate.planId, registryGeneration: candidate.registryGeneration, target: candidate.target,
    config, routeBindings, requiredNetworks: [...networks.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    engineRef: options.runtime.engineRef, applied: null, observed: null, runtimeValidation: 'not-performed' }, false);
  return { ...body, renderId: hash(body) };
}
