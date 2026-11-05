# ES3-A: offline route registry and gateway candidates

This preview implements the first bounded part of ES3 on main baseline
`738ca3f86e238e887080f088b77f382d26f7b5fc`. It does **not** establish full ES3
acceptance, serve HTTP, validate a live proxy, or change any ES2 runtime behavior.
The [canonical contracts](../architecture/es0/canonical-contracts.md),
[ADR 0008](../architecture/decisions/0008-shared-gateway-and-route-ownership.md)
and [engineering acceptance matrix](../architecture/es0/engineering-slices.md)
remain authoritative. Existing ES1 and ES2 schemas and evaluators are unchanged.

## Input and trust boundaries

`contracts/schemas/bsk-edge-v0alpha1.schema.json` defines a closed
`bsk.edge/v0alpha1` / `RouteRegistryInput` envelope:

| Field | Meaning |
|---|---|
| `installationRef` | One explicit installation for the entire input and registry |
| `declarations` | Unchanged ES1 Project/Environment/Service bundle and policy/runtime catalogs; its `catalog.routes` must be empty because `routes` below is the single source of claims |
| `hosts` | Explicit local admission records `{name, installationRef}`; no host discovery or connection |
| `gateways` | Installation-scoped canonical EdgeGateway envelopes: host, requested driver and 80/443 listener ports; one edge per host |
| `zones` | Trusted local admission records `{name, installationRef, hostname, visibility, owners:[{projectRef,environmentRef}]}`; explicit hostname/suffix delegation, no DNS verification or mutation |
| `deployments` | Trusted local admission wrappers `{resource: Deployment, visibility}`; canonical deployment fields and immutable OCI digest; visibility is an explicit policy input, not observed enforcement |
| `routes` | Canonical DomainBinding envelopes, with required `spec.deploymentRef` added by this new executable ES3 input to resolve an exact environment-scoped deployment |

All fields are closed. The new envelope does not widen the ES1 declaration
bundle or change an existing executable DomainBinding contract. Hostnames,
slugs and paths reference the existing ES1 schema definitions; graph validation
projects bindings through the existing ES1 validator. Explicit gateway, zone,
service and deployment references must resolve in the appropriate scope.
Deployment placement must equal the gateway host; multi-host forwarding is
outside ES3-A. No raw upstream URL/IP/socket, host path, proxy directive, secret
material or certificate settings are accepted.

Host/zone/exposure catalogs are supplied by a **trusted local embedding
application**. Their IDs are assertions, not authentication or ownership proof
from a live Docker daemon or DNS provider. A project cannot safely be allowed
to submit its own admission catalog through an API. PR3 must authenticate callers,
authorize catalog provisioning and enforce project-scoped RBAC. The local
snapshot contains private metadata and must not be exposed as a public API.
Catalogs are immutable within a registry lifetime, avoiding name reuse inside
this adapter; runtime UID binding and catalog migrations remain future work.

## Ownership, transactions and concurrency

`RouteRegistry.initialize(root, input, options)` accepts an empty route set and
creates generation 0. Provisioning the local catalogs is an operator action.
`new RouteRegistry(root, {installationRef, authorize})` opens an existing store;
an optional expected installation rejects scope mismatch. `snapshot()` returns
a validated defensive copy of the desired state.

`transact(request, expectedGeneration)` accepts exactly:

```js
{ action: 'claim', routes: [domainBinding] }
{ action: 'release', bindingRefs: [{ name, projectRef, environmentRef }] }
{ action: 'rebind', hostname, from: { projectRef, environmentRef },
  to: { projectRef, environmentRef }, routes: [replacementBinding] }
```

One authoritative registry directory covers **all gateways in an installation**;
never create separate per-project or per-gateway stores for one installation.
Independent directories and hosts do not coordinate; distributed mutation is
unsupported. Route exclusivity is `(installationRef, hostname, pathPrefix)`,
independent of gateway and visibility. Same-owner nested paths are allowed;
duplicate exact claims and cross-owner hostname or nested capture are rejected.
All bindings of a hostname must also reference exactly one gateway, including
same-owner root and nested paths. `HOST_GATEWAY` rejects fragmented routing
across gateways/hosts; multiple gateways remain valid for distinct hostnames.
Private and public claims cannot share a hostname in this first adapter. This
conservative restriction prevents a public `/` from capturing a private child
path without encoding private paths into public candidates.

A persistent hostname reservation remains after all its routes are released.
Only explicit `rebind` changes that reservation. Rebind specifies the current
owner and **replaces the entire selected hostname's claims atomically**, even
when only its service/gateway/path behavior changes for the same owner. Its
new bindings must satisfy zone grants and every normal graph/policy check.
Unrelated hostname claims and reservations are retained. No ordinary claim
silently updates an existing binding.

Every transaction requires the synchronous trusted `authorize(context)` hook
to return exactly `true`; missing, false, thrown or asynchronous results deny.
It receives defensive copies of action, installation, expected generation,
transaction and before/after routes. The host application must check all
affected owners and both owners of a rebind. **The hook is not implemented
authentication:** a boolean from untrusted request data is never sufficient.
There is no API, CLI mutation endpoint or production authorizer in this PR.

An exclusive `wx` file lock serializes the entire read/CAS/validate/authorize/
persist transaction. Contention fails immediately with `REGISTRY_BUSY`; there
is no unbounded retry or automatic lock theft. A stale generation returns
`STALE_GENERATION` before committing. Every successful transaction increments
the generation once. Empty mutations, unsupported actions and unknown fields
reject. Limits: 1 MiB input, at most 2,000 combined resources/admission records/
routes, at most 1,000 routes and lifetime hostname reservations, and 2 MiB state.

## Persistence and interrupted writes

Use an operator-controlled **local filesystem** directory. Linux files/directories
are created with 0600/0700 modes; Windows requires a restricted operator ACL.
Do not use a shared network filesystem or a directory writable by projects.
The root and committed state must not be symlinks. The state file contains
versioned snapshot, retained hostname owners and a SHA-256 integrity checksum.
Every read revalidates its shape, checksum, graph, scopes and reservations.
The checksum detects accidental corruption; it is not a MAC and does not defend
against an administrator rewriting or rolling back the whole trusted directory.

Writes use an exclusive, uniquely named temporary file, file fsync, atomic
same-directory rename, and directory fsync on Linux. Windows uses file fsync and
rename but does not claim power-loss directory durability. Reads see the old or
new complete snapshot, never an in-progress temporary file. A failure after
rename may have committed the new generation despite an error: reread before
deciding the outcome and never blindly retry with a new generation.

Temporary files are never promoted automatically. A process crash retains the
exclusive lock and blocks further mutations while allowing validated committed
reads. Recovery is deliberately operator-controlled:

1. Stop every embedding process that can use this installation directory and
   verify quiescence. Lock age or PID alone is insufficient proof.
2. Preserve the directory as diagnostic evidence. Read and validate only the
   committed `registry.json`; do not select a newer-looking temporary file.
3. If the committed state is valid, confirm its installation/generation and
   remove only the verified stale `.lock` in that exact directory while all
   writers remain stopped. Uncommitted `.state-*.tmp` files may be retained.
4. Reopen and reread the committed generation before retrying an authorized
   transaction. Corrupt/missing committed state requires reviewed backup recovery
   and reconciliation; never silently initialize an empty replacement.

Cleanup of a live lock checks its recorded filesystem identity before unlinking;
replacement or missing locks fail closed. This does not authorize concurrent
manual filesystem changes while writers run.

## Pure candidate and reference matching

`planCandidate(snapshot, gatewayRef)` validates the entire snapshot and returns
`IngressCandidate` with the complete public routing set for the selected gateway.
Private bindings, hostnames and catalogs are omitted. Public routes contain
logical installation/project/environment/service/deployment/host references and
the declared HTTP service port, never caller-supplied endpoints. `ports.d.ts`
defines each `bindingRef` as `{installationRef, kind: "DomainBinding",
projectRef, environmentRef, name}`, identifying bindings unambiguously across
projects/environments without granting privileges. `ports.d.ts` also
defines the typed candidate and future `IngressDriver` methods; no adapter is
implemented. Caddy remains the first future ingress target; Nginx and Traefik
enum values do not imply supported adapters.

Candidates have `mode: "dry-run"`, desired routes, registry generation,
`applied: null` and `observed: null`. Canonical object keys and set ordering,
hostname ordering and decreasing path-prefix length produce stable bytes.
Candidate canonicalization explicitly preserves array order while sorting object
keys; it must not apply set sorting to the precedence-ordered route array.
`planId` is SHA-256 of the UTF-8 JSON candidate body before adding `planId`;
no clock, randomness or filesystem path enters the identity. A changed registry
generation changes identity, including changes that do not affect public routes.
Neither this digest nor a snapshot is execution authorization.

`matchRoute(candidate, hostname, path)` is a reference matcher for generated
candidates. It uses exact-or-segment-prefix matching (`/api` does not match
`/apix`), selects the longest matching prefix independently of array order, and
uses explicit stripping; stripping an exact prefix
produces `/`. Host/path inputs use the canonical restricted syntax. Parsing
HTTP URLs, query preservation, forwarded-header policy and live proxy semantics
must be implemented and tested in ES3-B.

Run the offline synthetic suite:

```sh
npm run edge:test
npm run declarations:test
npm run architecture:test
npm run architecture:check
```

Example library use (trusted local fixture only, no infrastructure access):

```js
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from '../../scripts/edge/test-support/fixtures.mjs';
import { RouteRegistry } from '../../scripts/edge/lib/registry.mjs';
import { planCandidate } from '../../scripts/edge/lib/plan.mjs';

const input = fixture();
const routes = input.routes;
input.routes = [];
const root = mkdtempSync(join(tmpdir(), 'bsk-edge-example-'));
const registry = RouteRegistry.initialize(root, input, {
  // Synthetic-only policy; real authenticated authorization belongs to PR3.
  authorize: ctx => ctx.installationRef === 'fixture-install' && ctx.action === 'claim'
});
const desired = registry.transact({ action: 'claim', routes }, 0);
console.log(JSON.stringify(planCandidate(desired, 'edge'), null, 2));
```

The example imports are relative to this document's directory; adapt them for
your script location. It creates only local temporary registry state, retains
that directory for inspection, and never applies the candidate.

## Evidence, limitations and next task

Focused tests cover three projects/six `.test` hosts, root/nested matching,
strip behavior, reference/ownership/input denials, private exclusion, reordered
input, CAS/concurrent processes, unrelated routes, corruption, interrupted
rename and stale locks. A side-effect guard rejects filesystem mutation,
network/listener creation and subprocess execution during candidate planning.
The ordinary architecture CI matrix runs `edge:test` on Linux and Windows;
local and hosted results must be reported separately.

Initial local verification on Windows / Node.js 24.22.1:

| Check | Observed result |
|---|---|
| `npm run edge:test` | 58 passed, zero failed/skipped; includes real Node process contention and crash interruption |
| `npm run declarations:test` | 189 passed, zero failed, one existing Windows skip for the POSIX FIFO test |
| ES2 test files excluding `render.test.mjs` | 132 passed, zero failed/skipped; no Docker client or daemon accessed |
| `npm run architecture:test` | 105 passed, zero failed/skipped, including new Linux/Windows CI wiring guard |
| `npm run architecture:check` | 10 module manifests passed |
| `git diff --check` | Passed |
| Optional declaration compiler check | Blocked: local `node_modules/typescript/bin/tsc` is unavailable; no dependency installed to work around this |

Independent scoped security review passed the then-current 54 edge tests and
reported no blockers. Four subsequent tests add an explicit nonempty gateway
requirement, cross-gateway exclusivity, checksum-independent graph corruption
rejection and root symlink/junction rejection. Hosted Node 20 Linux/Windows
execution remains a separate ordinary CI result. Docker render/runtime tests
and live proxy validation were not executed locally; no ES3 runtime evidence
is inferred from these tests.

First hosted [ordinary CI run 41558939116](https://github.com/devzaratech/business-starter-kit/actions/runs/41558939116)
at `5236c0b` passed Ubuntu architecture/declaration/Compose/edge/manifests,
workspace/build, Spring and infrastructure jobs. Windows architecture and
declarations passed, but the unchanged ES2 `render.test.mjs` test failed with
`spawnSync docker ETIMEDOUT` at its 20-second timeout (132 other ES2 tests passed).
The later Windows edge/manifests and aggregate quality gate were skipped.
SonarQube's optional scan was configuration-skipped. The run remains failed.
The new edge step is now placed before Compose, with an ordering regression,
so its Windows evidence is independent of this Docker-client render failure;
the existing render test, timeout and failure gate remain unchanged.

### Targeted correctness review corrections

On reviewed head `b446821`, candidate canonicalization already used its default
`sets=false`: the exact `a-root: /`, `z-api: /api`, `/api/users` reproduction
selected `/api`. New tests preserve that observed fact rather than attributing
an unobserved array resort to that commit. Canonicalization now passes `false`
explicitly, and the matcher independently selects the longest prefix instead
of relying on the first match. A reordered candidate array reproduced the
previous matcher weakness. Adversarial names cover root, `/api`, `/api/v2`,
segment boundaries, both strip settings and stable bytes/hash under input and
object-key reordering. Serialized candidate routes must retain precedence order.

Additional negative tests reproduced same-owner root/nested bindings split
across gateways with valid host/deployment references. Validation now rejects
them; a registry regression confirms unchanged committed bytes and generation
on rejection, and successful authorized whole-hostname migration with unrelated
routes retained. Scoped binding references replace the ambiguous bare name in
the draft output and its type declaration; this intentionally changes candidate
body hashes. Equivalent reordered input still produces identical bytes/planId.
Previously saved split-gateway snapshots now fail validation; they require
explicit operator reconciliation, with no automatic state rewrite. Registry
locking, CAS, atomic persistence and authorization code are unchanged.

Correction verification: 65 edge tests passed with zero failures/skips, including
the existing interruption/concurrency/authorization tests; 105 architecture tests
and 10 module manifest checks also passed, as did diff whitespace validation.
Independent targeted review passed all 65 edge tests and found no blockers.
Hosted ordinary CI results are reported separately in PR #17. No ES1/ES2 contracts or drivers,
dependencies, frontend, infrastructure or runtime workflow were changed.

No ES3 runtime acceptance is claimed. ES3-B's exact next task is a separately
reviewed Caddy adapter with trusted ownership-checked resolution of logical
upstreams to admitted ingress attachments, candidate rendering/config validation,
generation-pinned activation, last-known-good restoration and independent
disposable-runtime tests of six hostnames, private denial, forwarded-header
spoofing, bad reload rollback and unaffected-project availability. Runtime
execution requires separate owner authorization. Certificates/ACME/DNS and
optional adapters require their own later bounded acceptance work.

Rollback reverts this additive library/schema and CI step. No existing route,
ES1/ES2 data, legacy stack or production configuration is migrated. Preserve any
local registry directories for reviewed recovery; rollback never deletes them.
Future format changes require explicit versioning/migration rather than silent
catalog replacement or automatic import of legacy routes.
