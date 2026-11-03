/** Provider-neutral desired input. It proves neither authorization nor activation. */
export interface IngressCandidate {
  apiVersion: 'bsk.edge/v0alpha1';
  kind: 'IngressCandidate';
  mode: 'dry-run';
  boundary: 'IngressDriver';
  planId: string;
  registryGeneration: number;
  target: { installationRef: string; gatewayRef: string; hostRef: string; driver: 'caddy' | 'nginx' | 'traefik' };
  desired: { listenerPorts: number[]; routes: PublicRoute[] };
  applied: null;
  observed: null;
}
export interface PublicRoute {
  bindingRef: { installationRef: string; kind: 'DomainBinding'; projectRef: string; environmentRef: string; name: string };
  hostname: string;
  pathPrefix: string;
  stripPrefix: boolean;
  match: 'exact-or-segment-prefix';
  upstream: { installationRef: string; projectRef: string; environmentRef: string; serviceRef: string;
    deploymentRef: string; hostRef: string; port: number };
}
/** Future trusted adapter boundary only. ES3-A implements none of these methods. */
export interface IngressDriver {
  render(candidate: IngressCandidate): Promise<{ materialRef: string }>;
  validate(materialRef: string): Promise<{ valid: boolean }>;
  activate(materialRef: string, expectedGeneration: number): Promise<{ appliedGeneration: number }>;
  inspect(): Promise<{ observedGeneration: number | null }>;
  restore(materialRef: string, expectedGeneration: number): Promise<{ appliedGeneration: number }>;
}
