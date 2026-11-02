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
npm --workspace @business-starter-kit/web run dev -- --host 127.0.0.1
npm --workspace @business-starter-kit/web run typecheck
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

## Component and integration boundaries

`src/main.tsx` only mounts React. `App.tsx` owns presentation navigation and
focus; `components.tsx` owns the overview and reusable operational empty state;
`content.tsx` holds stable section IDs, English labels and the manually maintained
engineering snapshot (2026-11-02). These are presentation models, not service
declarations or API responses. Do not use this snapshot to infer runtime health,
permissions or the latest PR #11 state. ES2 acceptance remains incomplete.

Future API integration must distinguish loading, empty, unauthorized, failed and
stale observed state. Use the shared authenticated Control Plane API and the
same project-scoped server authorization/policy path as CLI. Hidden or disabled
controls are not authorization. Do not add direct Docker/SSH clients or store
credentials in browser storage. Provider adapters remain optional behind that
API, not imports into the UI's navigation. Stable IDs are separate from display
labels so future locale catalogs can replace English copy without changing
resource identifiers; no provider, locale engine or client-side RBAC is added.

## Navigation and verification

Mobile navigation is an in-flow, non-modal disclosure: Enter/Space opens it and
focuses the current section; Escape closes it and restores the toggle. Selection
closes it and focuses the new page heading. Tab follows native document order;
there is no modal overlay or focus trap. Closed navigation is hidden from layout,
tab order and the accessibility tree. Breakpoint changes relocate focus if its
previous target becomes hidden. The page also has a skip link, current-page
semantics, visible focus rings and native disabled operation buttons with visible
prerequisites. Reduced-motion styles remove transitions/animations.

The build now includes `tsc --noEmit`. React 18 declaration packages are the only
new direct development dependencies; runtime dependencies are unchanged. The
lockfile preserves all pre-existing package records. No broad dependency fixes
are bundled; npm still reports 11 advisories (4 moderate, 6 high, 1 critical).

Actual local verification on 2026-11-02:

- Existing two environment tests and three new real-component SSR regression tests
  passed. The new tests failed for missing extracted components before refactoring.
  A description-list semantics regression failed before moving supporting copy
  inside its definition. Independent review found no blocker; its semantic and
  trailing-whitespace findings were corrected. Workspace tests passed 7/7,
  architecture tests 104/104, and all 10 module manifests validated.
- Strict TypeScript and Vite build passed (33 modules). The original draft failed
  strict checking because React declarations were missing; no permissive shims
  or relaxed compiler flags were introduced.
- Optional Playwright smoke checks ran in an isolated headless Microsoft Edge
  session against loopback Vite, with non-loopback browser requests blocked.
  All seven views passed at widths 1440, 768, 390 and 320: no horizontal overflow,
  Enter/Space, Escape, toggle closing, selection and breakpoint focus, disabled
  controls, reduced-motion style and no page exceptions. Screenshots at those
  widths were captured; desktop and mobile renderings were visually inspected.
- 65 sampled rendered text/background pairs passed a 4.5:1 contrast check;
  the minimum sampled ratio was 4.91:1. This is not a complete accessibility audit.
- Initial Chrome-channel launch was unavailable; the installed Edge channel was
  used successfully. No browser, UI library or accessibility package was added
  to the repository dependencies.

Reproduce optional browser smoke checks after starting loopback Vite, with an
already-installed Playwright module and browser (not part of ordinary CI):

```powershell
$env:BSK_PLAYWRIGHT_MODULE = 'C:/absolute/path/to/playwright/index.mjs'
$env:BSK_BROWSER_CHANNEL = 'msedge'
node apps/web/qa/control-plane.mjs
```

The smoke script writes screenshots under ignored `.cache/ui-preview/`. Leave
`BSK_BROWSER_CHANNEL` unset to use Playwright's installed Chromium. It uses a
fresh browser profile; do not point it at personal browser sessions. A full axe
audit, screen-reader review, Firefox/WebKit, forced-colors, zoom and localization
testing remain pending. Do not claim WCAG conformance or live API functionality.
Rollback reverts these frontend changes only; no infrastructure or data migration
is involved. PR #12 must remain a draft pending final design/accessibility review.
