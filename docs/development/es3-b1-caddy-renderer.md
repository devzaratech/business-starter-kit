# ES3-B1: offline Caddy renderer and trusted Compose resolution

This additive adapter starts at `0b153d0ae7aebf649d0be2437c1bc82c4751c9e5`,
the merge of PR #17. [Main CI 41984427592](https://github.com/devzaratech/business-starter-kit/actions/runs/41984427592)
was successful before implementation. Read [ES3-A](es3-route-registry.md),
[ADR 0008](../architecture/decisions/0008-shared-gateway-and-route-ownership.md)
and the [ES3 matrix](../architecture/es0/engineering-slices.md) for the broader
contracts. This is a render-only preview, not full ES3 acceptance or a deployed
gateway. No existing ES1/ES2 schema, driver, ownership evaluator or legacy stack
is changed.

## API and supported capability

The outer adapter lives in `scripts/edge/adapters/caddy/`; provider-neutral
`scripts/edge/lib/` does not import it. It exports:

```js
renderCaddy(candidate, { snapshot, runtime }) // CaddyRenderPlan
resolveComposeUpstreams(candidate, snapshot, runtime) // ResolvedRoute[]
```

`candidate` is the existing ES3-A `IngressCandidate`. `snapshot` is the trusted
local registry snapshot from which it was planned. The adapter revalidates the
entire snapshot and recomputes the complete candidate, comparing every field,
array order and plan identity. A self-consistent hash on a forged candidate
does not authorize changed routes, ports, private bindings or proxy directives.
The registry's one gateway per host and one gateway per hostname checks remain
in force. The adapter supports only `driver: "caddy"`.

This first bounded renderer requires **explicit `listenerPorts: [80]`**.
`[443]` and `[80,443]` return `LISTENERS_UNSUPPORTED`; an ES3-A default containing
443 is never silently downgraded. No certificate material contract or TLS support
is invented. The generated single HTTP/1 server disables automatic HTTPS,
administration and automatic config persistence. These are generated settings,
not an assertion that a live proxy is configured securely. Caddy activation and
any protected administration mechanism must be implemented separately in ES3-B2.

The return value contains canonical Caddy JSON, `candidatePlanId`, registry
generation, complete scoped target, scoped binding references, generated route
indexes, resolved container/network IDs and required ingress networks. `renderId`
hashes the entire canonical result body before adding `renderId`. Equivalent
input/object-key/observation-set order gives identical bytes. `applied` and
`observed` remain `null`; `runtimeValidation` is `"not-performed"`.

## Trusted resolution boundary

`TrustedComposeRuntime` is a closed local adapter input, described in
`scripts/edge/adapters/caddy/ports.d.ts`:

```js
{
  apiVersion: 'bsk.caddy.runtime/v0alpha1',
  candidatePlanId, registryGeneration,
  target: { installationRef, gatewayRef, hostRef },
  engineRef,
  deployments: [{
    entry: { request, plan, admission }, // already-admitted ES2 inventory entry
    objects, // normalized existing DockerReader resources
    addresses: [{ containerId, networkId, ipv4, subnet, running, imageRef }]
  }]
}
```

Only a **trusted local host worker** may assemble this bundle. Inventory entries
must originate from the admitted ES2 ledger; `objects` and supplemental address,
IPAM, running-state and image observations must come from the same authorized,
pinned engine inspection. `engineRef` identifies that observation authority;
it is not a connection address. No default Docker context, discovery, DNS
resolution, socket, subprocess or live inspection is invoked by these functions.
Module initialization reads existing repository schemas; rendering has no I/O.

**Do not accept this bundle or the trusted registry snapshot from a project API
request.** Labels, claimed IDs, `running: true`, admission records and engine names
are not authentication. The renderer checks consistency against the supplied
trusted evidence; it cannot prove the provenance of a fabricated bundle from a
compromised privileged caller. PR3 must authenticate/authorize callers. ES3-B2
must implement actual pinned collection, freshness and reinspection before
activation; this PR does not claim those live observations were performed.

For each public logical upstream, resolution:

1. Requires an exact installation/project/environment/deployment key and host;
   rejects absent, duplicate and unused deployment packages. It reconstructs the
   existing ES2 plan from its closed request, checks exact plan identity/content
   and admitted/requested totals. This checks the supplied admission record;
   it does not perform new capacity admission or replace the trusted ledger.
2. Requires an admitted HTTP workload mapping to that logical service/port,
   a public ES3 deployment admission and the exact declared immutable image.
   Its supplemental observed image reference must also match. Database/data and
   worker roles cannot be resolved as public upstreams. These are trusted role
   declarations, not application protocol inspection.
3. Calls unchanged ES2 `inspectLimits` on the complete deployment resource set.
   Expected resource cardinality, names, ownership labels, scoped networks,
   mounts, published ports and configured CPU/memory/PID values must pass. Actual
   opaque container/network IDs must be 64 lowercase hex characters and unique.
4. Resolves only the exact expected ingress network ID/name, with its ownership
   labels and internal bridge topology validated by ES2 checks. Every selected
   HTTP replica must be present in both container and network attachment views,
   and its Compose service label must match the admitted workload. A service may
   also have admitted data access; its **data-network address is never an ingress
   endpoint**. The gateway receives only the required ingress-network intent.
5. Requires one running address observation per selected HTTP replica. Only
   canonical RFC 1918 IPv4 host addresses inside canonical private bridge CIDRs
   (`/8` through `/30`, entirely private) are supported. Network/broadcast,
   out-of-subnet, duplicate, public, loopback, link-local, IPv6, numeric aliases,
   hostnames, URLs, sockets and placeholders reject. Required networks cannot
   have overlapping subnets. Replica endpoints are deterministically sorted.

Unknown runtime/options fields reject rather than becoming Caddy directives.
Errors contain fixed codes and no untrusted values. Runtime input is limited
to 32 MiB, 1,000 deployment packages, 2,200 normalized objects per package and
1,000 address observations per package. This is a local privileged tool boundary,
not a public resource-exhaustion or hostile-host isolation guarantee.

## Generated route semantics

The JSON template accepts no caller-supplied handlers, URLs, headers, upstream
hostnames or Caddy configuration fragments. It contains the candidate's public
routes in hostname/longest-prefix order, each terminal, plus a final 404. Private
bindings and their hostnames/addresses are omitted entirely; zero public routes
produce only the deny response and require no endpoint packages.

Generated anchored `path_regexp` matchers implement literal, case-sensitive
segment matching. Project regex input remains forbidden by ES1. Caddy's ordinary
path matcher is case-insensitive, so using it would disagree with ES3-A. For a
stripped `/api` prefix, the adapter emits an exact `/api` rule with a rewrite to
`/`, then a `/api/…` rule stripping only `/api`. `/api/v2` rules precede `/api`
regardless of binding names; `/apix` falls through to a root rule if one exists.
Without stripping, the original path is retained. Root stripping does not remove
the leading slash. Generated reverse proxies dial only verified private IPv4
and declared service ports; they delete forwarded/client-identity headers and
configure no trusted proxies. Live header behavior remains a B2 acceptance test.

JSON field/order/rewriting design was checked against upstream Caddy **v2.10.2**
source: [routes](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/routes.go),
[matchers](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/matchers.go),
[rewrite](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/rewrite/rewrite.go),
[server](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/server.go),
[reverse proxy](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/reverseproxy/reverseproxy.go)
and [administration](https://github.com/caddyserver/caddy/blob/v2.10.2/admin.go).
This is a design reference, not an executed Caddy-version support claim. No
Caddy binary validation, proxy requests, certificate provisioning or reload was
performed. The test-only JSON interpreter checks the emitted subset; it does
not establish equivalence with a running proxy for URL normalization, queries,
encoded paths or header handling.
In particular, upstream `MatchPathRE` cleans the decoded path before matching;
live repeated-slash/dot/encoding behavior must be demonstrated in ES3-B2.

## Usage and verification

Synthetic-only example, executed from the repository root (prints JSON only):

```sh
node --input-type=module -e 'import {caddyFixture} from "./scripts/edge/test-support/caddy.mjs"; import {renderCaddy} from "./scripts/edge/adapters/caddy/render.mjs"; const f=caddyFixture(); console.log(JSON.stringify(renderCaddy(f.candidate,{snapshot:f.snapshot,runtime:f.runtime}),null,2));'
```

Production-facing callers must replace the synthetic fixture with the trusted
collection boundary described above; that collection is not implemented here.
Run `node --test scripts/edge/test/caddy.test.mjs` for the focused adapter suite,
or `npm run edge:test` for all edge tests. Existing ordinary architecture CI
runs native discovery on Linux and Windows, so the adapter tests are included
without an additional workflow or runtime opt-in. A separate architecture test
guards the inward dependency direction.

Local results on Windows / Node.js 24.22.1:

| Check | Actual result |
|---|---|
| Focused adapter tests | 59 passed, zero failed/skipped |
| `npm run edge:test` | 124 passed, zero failed/skipped |
| `npm run architecture:test` | 106 passed, zero failed/skipped |
| `npm run declarations:test` | 189 passed, zero failed, one existing Windows skip for the POSIX FIFO case |
| ES2 test files except `render.test.mjs` | 132 passed, zero failed/skipped |
| `npm run architecture:check` | 10 module manifests passed |
| Diff whitespace validation | Passed |

The Docker-client render test was excluded locally to honor the no-local-Docker
boundary; unchanged ordinary CI retains it. Independent scoped security review
found no actionable blockers and passed the 59 adapter tests plus the new
architecture boundary test (60 total). The tests use synthetic trusted bundles
and a limited JSON interpreter, not a Docker daemon or Caddy server. Hosted
Node 20 Linux/Windows results are recorded separately in the PR; they cannot
establish disposable-runtime acceptance or replace ES3-B2.

## Remaining ES3-B2 work and rollback

ES3-B2 must implement guarded activation as a separate reviewed task: collect
fresh observations from the explicitly authorized isolated engine; pin host,
engine, gateway and candidate/generation; verify actual gateway ownership and
ingress-only attachments; run pinned Caddy configuration validation; stage a
candidate under the gateway lease/CAS; activate via a protected local boundary;
probe served routes; persist separate applied/observed generations; retain and
restore last-known-good configuration on failure, including crash reconciliation.
Never activate this dry-run result solely because it has a digest.

Independent owner-authorized disposable-runtime acceptance must prove six hosts,
root/nested/strip/query/encoded-path behavior, private denial, header spoofing
rejection, bad-render/reload rollback, concurrency and unaffected-project
availability. B1 unit tests and ordinary CI do not prove runtime enforcement.
TLS/certificates and optional ingress providers remain separate bounded work;
no ACME, DNS, Certbot, Cloudflare or authenticated RBAC is implemented.

Rollback reverts these additive adapter/test/doc files. No existing persistent
format, route registry, ES1/ES2 inventory or production configuration is migrated
or deleted, and no dependency is introduced. Existing ES2 runtime evidence is
preserved; no runtime workflow is dispatched by this PR.
