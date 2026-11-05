import type { IngressCandidate, PublicRoute } from '../../lib/ports.d.ts';

/** Collected by a trusted embedding application; not project declaration input. */
export interface TrustedComposeRuntime {
  apiVersion: 'bsk.caddy.runtime/v0alpha1';
  candidatePlanId: string;
  registryGeneration: number;
  target: { installationRef: string; gatewayRef: string; hostRef: string };
  engineRef: string;
  deployments: Array<{
    /** Existing ES2 inventory entry and normalized DockerReader objects. */
    entry: { request: unknown; plan: unknown; admission: unknown };
    objects: unknown[];
    /** Same pinned observation: container/image/state and its ingress IPAM attachment. */
    addresses: Array<{ containerId: string; networkId: string; ipv4: string; subnet: string; running: boolean; imageRef: string }>;
  }>;
}
export interface ResolvedRoute {
  bindingRef: PublicRoute['bindingRef'];
  endpoints: Array<{ containerId: string; networkId: string; networkName: string; ipv4: string; port: number }>;
}
export interface CaddyRenderPlan {
  apiVersion: 'bsk.caddy/v0alpha1';
  kind: 'CaddyRenderPlan';
  mode: 'dry-run';
  candidatePlanId: string;
  registryGeneration: number;
  target: IngressCandidate['target'];
  engineRef: string;
  config: Record<string, unknown>;
  routeBindings: Array<ResolvedRoute & { hostname: string; pathPrefix: string; upstreamRef: PublicRoute['upstream']; caddyRouteIndexes: number[] }>;
  requiredNetworks: Array<{ id: string; name: string }>;
  renderId: string;
  applied: null;
  observed: null;
  runtimeValidation: 'not-performed';
}
