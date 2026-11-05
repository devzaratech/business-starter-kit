# ES3-B1 Caddy renderer implementation plan

**Goal:** Produce deterministic offline Caddy JSON from a validated ES3-A candidate and trusted, admitted Compose/runtime observations. No activation or full ES3 conformance.

**Verified prerequisite:** PR #17 merged at `0b153d0ae7aebf649d0be2437c1bc82c4751c9e5`; main CI run `41984427592` succeeded. This feature starts at that merge.

**Design:** Keep the adapter in `scripts/edge/adapters/caddy/`. Recompute the exact candidate from a trusted ES3-A snapshot rather than trusting a caller's digest. A pure Compose resolver consumes explicit admission/observation bundles pinned to candidate identity/generation, rechecks the existing ES2 plan/ownership/limits and exact ingress attachment, and returns only private IPv4 endpoints for admitted HTTP services. Runtime bundles are a trusted embedding boundary, never project-supplied API input. No Docker reader, socket, command, remote fetch or resolver callback executes during rendering.

**Bounded capability:** Render only an explicitly declared HTTP `[80]` listener, with administration and automatic HTTPS disabled. Reject `[443]` and `[80,443]`; no implicit downgrade or invented TLS material. Endpoint IDs/network IDs must match owned observed resources. Reject worker/data roles, private admissions, non-ingress attachment, public/loopback/link-local/ambiguous addresses, arbitrary directives, unresolved or stale references. Caddy runtime validation remains ES3-B2.

**Steps (TDD):**

1. Add synthetic adapter fixtures for three projects and six `.test` hostnames on one host, with failing resolution/render tests including adversarial names, exact/nested stripping, candidate tampering, resource ownership drift, unsafe endpoints and side-effect guards.
2. Implement candidate verification and the pure trusted Compose resolution boundary using existing inward ES1/ES2/ES3-A contracts without modifying their schemas or security evaluators.
3. Render deterministic JSON with explicit segment path matchers, precedence ordering, fixed reverse-proxy handlers, scoped route metadata and a separate render identity. Preserve candidate plan/generation/target; no applied/observed success.
4. Run new tests via existing `edge:test` native discovery and Linux/Windows CI, add an architecture wiring guard, document trust limits/usage and exact ES3-B2 work. Run focused edge, ES2 non-Docker, declaration and architecture checks, obtain independent review, then publish one PR without merging or runtime dispatch.

**Review focus:** Candidate forgery/private leakage; cross-scope endpoint labels and exact ingress IDs; admitted artifact/service/port mismatch; duplicate/reused endpoint identity/address; ordered Caddy matching/rewriting; absence of activation or network effects.
