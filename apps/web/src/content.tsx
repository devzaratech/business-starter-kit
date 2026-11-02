export type Section = 'overview' | 'projects' | 'environments' | 'services' | 'domains' | 'releases' | 'observability';
export type Status = 'merged' | 'incomplete' | 'planned';

export const navigation: { id: Section; title: string; symbol: string }[] = [
  { id: 'overview', title: 'Overview', symbol: '▦' },
  { id: 'projects', title: 'Projects', symbol: '◈' },
  { id: 'environments', title: 'Environments', symbol: '▤' },
  { id: 'services', title: 'Services', symbol: '⬡' },
  { id: 'domains', title: 'Domains & routes', symbol: '◎' },
  { id: 'releases', title: 'Releases', symbol: '↗' },
  { id: 'observability', title: 'Observability', symbol: '◉' },
];

export const slices: { id: string; name: string; description: string; status: Status; next: string }[] = [
  { id: 'ES0', name: 'Architecture & contracts', description: 'Architecture review and versioned governance', status: 'merged', next: 'Maintain contracts and accepted ADRs' },
  { id: 'ES1', name: 'Projects & environments', description: 'Offline validation and deterministic dry-run planning', status: 'merged', next: 'Preserve independent project ownership' },
  { id: 'ES2', name: 'Compose & resource isolation', description: 'Driver and disposable test harness merged', status: 'incomplete', next: 'Runtime evidence, secret refs and label-drift coverage' },
  { id: 'ES3', name: 'Shared gateway & domains', description: 'Owned routes, conflict checks and safe reload', status: 'planned', next: 'Caddy adapter and disposable six-domain fixture' },
  { id: 'ES4', name: 'CI/CD & immutable releases', description: 'Per-project artifact lineage and promotion', status: 'planned', next: 'Digest-pinned release and approval evidence' },
  { id: 'ES5', name: 'Observability & recovery', description: 'Correlated events, rollback and restore', status: 'planned', next: 'Failure injection and disposable data recovery' },
  { id: 'ES6', name: 'Reproducible Golden Path', description: 'Two clean independent installation runs', status: 'planned', next: 'End-to-end conformance after ES3–ES5' },
];

export const emptyStates: Record<Exclude<Section, 'overview'>, { description: string; requirements: string[] }> = {
  projects: {
    description: 'Projects will come from the authenticated Control Plane API. No project inventory is connected to this preview.',
    requirements: ['Scoped project listing', 'Owner-aware permissions', 'Desired and observed state'],
  },
  environments: {
    description: 'Environment names are arbitrary validated slugs, not a fixed dev/qa/prod dropdown. Nothing here is connected to a host.',
    requirements: ['Project-scoped environment listing', 'Policy and resource budgets', 'Verified placement'],
  },
  services: {
    description: 'Service status must be derived from an authorized driver and observed runtime, never from a static UI fixture.',
    requirements: ['Scoped service inventory', 'Health and resource observation', 'Guarded lifecycle operations'],
  },
  domains: {
    description: 'ES3 will supply owned hostnames and paths through a single installation-owned edge gateway.',
    requirements: ['Route registry and uniqueness', 'Candidate validation and safe reload', 'No private data-network exposure'],
  },
  releases: {
    description: 'Release and promotion actions will be enabled only after project-scoped operations and immutable OCI digests exist.',
    requirements: ['Build provenance and digest', 'Approvals and audit trail', 'Observed rollout and rollback'],
  },
  observability: {
    description: 'This preview does not invent uptime, CPU utilization, errors, or deployment history.',
    requirements: ['Real telemetry and correlation', 'Redacted operational audit', 'Recovery evidence'],
  },
};
