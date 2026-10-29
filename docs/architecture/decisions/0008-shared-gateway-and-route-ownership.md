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
gateway certificate/config state have independent ownership. Separate two inward
contracts, implemented by outer adapters:

| Contract | Responsibility | Boundary |
|---|---|---|
| `IngressDriver` | Render routes/listeners and certificate references; validate, activate/reload, inspect and restore ingress configuration | Owns safe proxy activation and observed served-certificate identity; does not own CA accounts, DNS credentials or issuance policy |
| `CertificateProvider` | Obtain/renew certificates, inspect validity and lifecycle failures, and perform explicitly authorized revocation | Owns challenge execution and protected certificate/account state; returns opaque material references, never private keys in API/plan output; cannot rewrite routes or reload the proxy directly |

`IngressDriver` refines the earlier proposed `GatewayDriver` name; no implemented
API is renamed. Caddy is the first ingress implementation targeted for support
in ES3 because it is already present; conformance is still required. Nginx is an
optional adapter; Traefik is a future optional adapter. No dynamic Docker
discovery or socket access is required. Do not accept raw gateway directives
from projects.

The kernel depends only on these contracts, never on Certbot, Caddy, Nginx,
Traefik, Let's Encrypt or Cloudflare. A CA directory/account and DNS challenge
adapter are explicit provider configuration, not kernel defaults. Caddy's built-in
certificate automation may implement the certificate boundary within its outer
adapter; it does not require Certbot. Report actual provider capabilities rather
than assuming every ingress/provider pairing supports every challenge method.

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
| Caddy (first ingress target) | Existing stack; config API and built-in certificate automation | Isolate admin endpoint, retain config generations and prove routing/TLS behavior; no Certbot requirement |
| Nginx (optional adapter) | Explicit generated config and graceful reload | CertificateProvider supplies material; Certbot is one optional ACME provider; current example is not conformance-ready |
| Traefik (future optional adapter) | Dynamic config/provider ecosystem | Prefer file/provider boundary under BSK control; no general Docker socket or project-supplied privileged labels; separate adapter review/conformance |

Per-project public proxies would compete for host ports and duplicate certificate
ownership. A global application/data bridge simplifies discovery but expands
lateral access. Neither is the proposed multi-project baseline.

## Minimum certificate lifecycle contract (ES3 proposal only)

Use a scoped certificate request containing owner/DomainBinding references,
validated DNS names, `providerRef`, `challengePolicyRef` and operation/generation
identity. Provider-specific CA/account settings and challenge credentials remain
behind opaque configuration/SecretRef references. Existing hostname policy still
rejects wildcard DomainBindings; DNS-01 capability does not broaden that policy.

The minimum operations are idempotent `ensure`, `renew` and `inspect`, plus
separately authorized `revoke` when supported. A response contains certificate
identity/generation, opaque material reference, fingerprint, covered names,
validity timestamps, renewal due time and timestamped lifecycle outcome/error.
Distinguish pending, ready, failed, expired, revoked and unknown observations.
Ready means issued and valid; only ingress inspection proves that generation is
served. No secrets, ACME account keys, host paths or arbitrary hooks enter public
contracts. Unsupported capability is explicit; it is not a successful renewal.

Coordinate issuance/renewal under certificate ownership/leases and route updates
under the existing gateway lease. Validate names, key/certificate pairing, chain
and validity before activation. Renewal failure retains the last valid material
and routes, reports failure and warns before expiry; never claim an expired or
revoked certificate is safe fallback. Route teardown does not implicitly revoke
or delete shared certificate/account state. Retirement requires explicit ownership
and reference checks; revocation and local deletion are distinct operations.

## Optional Certbot provider for Nginx

Certbot may obtain material using `certonly`; BSK retains control of Nginx config
activation rather than allowing an installer plugin to edit managed routes.
Support these separately selected challenge policies:

- **HTTP-01:** use a scoped webroot challenge path through the existing shared
  port-80 edge. Do not start a competing standalone listener or stop the shared
  proxy. Challenge access must reach the correct hostname without exposing admin
  routes; this challenge does not support wildcard issuance.
- **DNS-01:** use an optional DNS adapter to publish the required TXT proof, wait
  for propagation and remove only that operation's records. Keep zone-limited
  credentials in secret storage; no mandatory Cloudflare dependency. DNS updates
  and public CA requests require their own explicit authorization.

Schedule unattended renewals with bounded retry/backoff and expiry monitoring.
Certbot's renewal exit zero can mean no renewal was needed; a successful renewal
deploy hook should enqueue a typed activation request, not run project-supplied
shell or reload directly. Verify new material before a safe proxy reload.

Persist certificate material, account keys and renewal configuration in protected
owned storage outside repositories, images and logs. Only the provider writes;
Nginx receives read-only access to the needed material, not DNS/account secrets.
Preserve the lineage/symlink targets needed by Certbot, restrict key permissions,
and encrypt backups with access and restore controls. Do not make secrets world
readable to accommodate container mounts.

Stage the new certificate generation and candidate config, run Nginx config
validation (`nginx -t`), then request graceful reload through `IngressDriver`.
Probe the served fingerprint and routes before recording success. On validation,
reload or probe failure, restore the last-known-good config and still-valid
certificate generation, reconcile actual state and leave unrelated routes up.
Certbot hooks are trusted adapter code, never arbitrary declaration input.

These are ES3 contract and acceptance requirements, not implementations. ES3
must test challenge ownership/cleanup, renewal success/no-op/failure, expiry,
denied secret access and bad-certificate/reload rollback with a local ACME fixture
or disposable certificates. Tests must not contact public ACME/DNS. Certbot
`--dry-run` may contact a CA and run hooks; it is not BSK's pure offline plan and
must not be run against real infrastructure as documentation validation.
An optional Nginx/Certbot adapter needs its own ES3 conformance evidence before
support is claimed. PR1 remains declaration validation and offline planning only;
no certificate schema, provider, scheduler or command is added to PR1.

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

Certificate references checked 2026-10-29: [Certbot user guide](https://eff-certbot.readthedocs.io/en/stable/using.html)
documents acquisition, renewals, hooks and storage; [ACME challenge explanations](https://letsencrypt.org/docs/challenge-types/)
describe HTTP-01 and DNS-01. These are adapter references, not a required CA or
DNS vendor. Storage, authorization and activation boundaries above are BSK's
proposed requirements.
