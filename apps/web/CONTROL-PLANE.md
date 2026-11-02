# Control Plane UI — development shell

Status: **preview shell only, not an operational dashboard**.

This React 18/Vite UI introduces responsive navigation for Overview, Projects, Environments,
Services, Domains & routes, Releases and Observability. The Overview displays the
documented engineering-slice status from the reviewed ES0–ES2 baseline. Its
statuses are a snapshot, **not** a live GitHub sync or runtime proof.

All operational sections explicitly display **no connected data**. There is
no fabricated project list, uptime, telemetry, deploy button, backend call,
authentication, Docker socket access or credential storage.

## Local usage

From the repository root:

```sh
npm ci
npm --workspace @business-starter-kit/web run dev
npm --workspace @business-starter-kit/web run build
npm --workspace @business-starter-kit/web run test
```

The Vite development server is not an authenticated administration surface.
Do not expose it publicly or deploy it as an admin panel without PR3 authorization,
RBAC, API policy enforcement and observed-state integration.

## Next implementation PRs

1. Resolve ES2 owner-reviewed disposable runtime evidence, positive secret refs,
   and unchanged-cardinality label-drift runtime coverage. Do not report ES2
   conformance until all mandatory checks pass.
2. ES3: Caddy shared edge registry and atomic candidate validation/reload on
   disposable fixtures. No production DNS, ACME or proxy changes.
3. PR3: authenticated, durable Control Plane API with project scoping, RBAC,
   idempotent operations, observed state and audited typed actions. Introduce
   API client types, authenticated sessions and error handling before any
   operational UI controls.
4. Connect this interface using the **same policy/authorization path** as CLI,
   not direct Docker or arbitrary SSH. Never display synthetic runtime state
   as real.

Keep ES0–ES6 engineering conformance before business verticals, and do not
silently modify the canonical master plan, ADRs or existing adapters.
