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

/** Operator-pinned worker configuration. None of these identifiers authenticates a caller. */
export interface HostWorkerScope {
  installationRef: string;
  hostRef: string;
  gatewayRef: string;
  engineRef: string;
  sourceRef: string;
}

export interface PreflightScope extends HostWorkerScope {
  registryGeneration: number | null;
  candidatePlanId: string | null;
  inventoryRevision: number | null;
  renderId: string | null;
}

export interface RuntimeObservation {
  scope: PreflightScope;
  /** UTC epoch milliseconds at completion of this collection. */
  collectedAt: number;
  deployments: Array<{
    planId: string;
    objects: TrustedComposeRuntime['deployments'][number]['objects'];
    addresses: TrustedComposeRuntime['deployments'][number]['addresses'];
    /** Independently normalized from ingress network inspect and IPAM. */
    ingressPeers: Array<{ containerId: string; networkId: string; ipv4: string; subnet: string }>;
    containers: Array<{
      containerId: string;
      /** Actual container Image ID and independently inspected image object ID. */
      imageId: string;
      inspectedImageId: string;
      imageRef: string;
      repoDigests: string[];
      running: boolean;
      networks: Array<{ name: string; id: string }>;
    }>;
  }>;
}

type PortResult<T> = T | Promise<T>;
export interface CaddyPreflightOptions {
  scope: HostWorkerScope;
  /** Read the installed registry and validated ES2 inventory through authorized local capabilities. */
  readRegistry: (signal: AbortSignal) => PortResult<unknown>;
  readInventory: (signal: AbortSignal) => PortResult<unknown>;
  /** Verify the configured engine identity on each collection. Report actual source and engine identities. */
  readRuntime: (query: { scope: PreflightScope; plans: unknown[] }, signal: AbortSignal) => PortResult<RuntimeObservation>;
  /** Read-only operations on the same operator-pinned tool. No discovery, fallback or activation. */
  validator: {
    version: (signal: AbortSignal) => PortResult<string>;
    validate: (query: { scope: PreflightScope; configJson: string }, signal: AbortSignal) => PortResult<boolean>;
  };
  now?: () => number;
  timeoutMs?: number;
}

export interface CaddyPreflightResult {
  apiVersion: 'bsk.caddy.preflight/v0alpha1';
  kind: 'CaddyPreflight';
  state: 'passed' | 'rejected';
  scope: PreflightScope;
  validation: 'not-performed' | 'unavailable' | 'version-mismatch' | 'invalid' | 'valid';
  requiredCaddyVersion: 'v2.10.2';
  collection: { firstAt: number; lastAt: number; observationId: string } | null;
  diagnostics: string[];
  applied: null;
  observed: null;
  preflightId: string;
}
