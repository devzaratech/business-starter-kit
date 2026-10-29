# ADR 0008: One shared edge with transactional route ownership

## Status

Proposed for PR0 / ES0 review, 2026-10-29. Existing static Caddy configurations
remain unchanged; this is not evidence of a managed gateway implementation.

## Context

The existing separate edge stack already centralizes public ports, but its
domains/upstreams are static and its network is shared across environments.
There is no route registry or demonstrated rollback. IP forwarding headers
assume a trusted Cloudflare path that source configuration does not establish.

## Proposed decision

Use one installation-owned public HTTP edge per host (80/443). Project data and
gateway certificate/config state have independent ownership. Implement a small
GatewayDriver port for render, validate, activate, inspect and restore. Caddy is
the first adapter because it is already present; no dynamic Docker discovery or
socket access is required. Do not accept raw gateway directives from projects.

Persist route claims with uniqueness and same-owner hostname rules in the
[canonical contract](../es0/canonical-contracts.md). Gateway mutation uses a
lease plus a compare-and-swap gateway generation. Render a complete candidate,
validate it, activate it, probe routes and persist the observed generation.
Retain the last-known-good configuration. Invalid render/reload or postcondition
failure restores it and records a failed operation. Reconcile crashes between
activation and status persistence. Concurrent project updates must not lose
unrelated routes.

Use explicit segment/path precedence and strip behavior. Derive upstreams only
from owned service/deployment records to prevent SSRF. Private routes get no
public listener exposure; DNS labels or an HTTP header do not confer privacy.
Zone ownership, DNS mutation and certificate issuance are separately authorized.
Tests use fake `.test` domains, local resolution and disposable certificates;
never invoke public ACME/DNS as part of conformance. Protect Caddy administration
with a permissioned socket or equivalent local boundary, never a public port.

Trust forwarded identity only from explicitly configured proxy networks and a
verified ingress path. Strip untrusted forwarded headers at the boundary; direct
origin access must not impersonate Cloudflare. This is not application auth.

## Adapter evaluation

| Option | Fit | Cost / restriction |
|---|---|---|
| Caddy (first) | Existing stack; config API and reload model | Isolate admin endpoint, retain config generations and prove routing/TLS behavior |
| Nginx (optional) | Explicit generated config and graceful reload | Separate certificate workflow and adapter needed; current example is not conformance-ready |
| Traefik (optional) | Dynamic config/provider ecosystem | Prefer file/provider boundary under BSK control; no general Docker socket or project-supplied privileged labels; extra adapter/test cost |

Per-project public proxies would compete for host ports and duplicate certificate
ownership. A global application/data bridge simplifies discovery but expands
lateral access. Neither is the proposed multi-project baseline.

## Consequences and migration

The edge is shared failure scope; configuration transactions and unaffected-route
tests are mandatory. ES3 proves six routes across three projects, duplicate and
cross-owner nested claim denial, spoofed header denial, private route invisibility,
bad-config rollback and concurrent update preservation. Migrate static routes by
explicit claim import and cutover; keep a restorable static configuration. Do not
delete certificates or DNS records when rolling back a service.

References checked 2026-10-29: [Caddy administration API](https://caddyserver.com/docs/api)
documents its local admin endpoint and config persistence; [Nginx control](https://nginx.org/en/docs/control.html)
describes reload validation and fallback. These mechanisms inform adapter design;
they do not replace BSK's route transaction and runtime tests. Traefik remains an
unevaluated implementation until a dedicated adapter review/conformance run.
