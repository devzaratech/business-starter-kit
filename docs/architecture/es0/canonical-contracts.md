# Minimal canonical contracts

Status: proposed ES0 design, `bsk/v0alpha1`. This is the reviewable semantic
contract, not an implemented parser, database or supported API. PR1 implements
only the declaration subset in JSON Schema 2020-12 and tests; later slices add
their own executable schemas/OpenAPI. Existing module schema `1.0` and platform
line `1.x` retain their independent versions and meanings.

## Envelope, identity and ownership

A resource is `{apiVersion, kind, metadata, spec}`. Server responses additionally
carry `status`; declaration input rejects `status` and server-owned fields.
Unknown fields, unsupported versions, wrong types and implicit coercion fail
closed. JSON is the initial serialization to avoid introducing a YAML dependency.

| Field | Proposed meaning |
|---|---|
| `apiVersion` | Exact `bsk/v0alpha1`; no guessing a newer/older contract |
| `kind` | One of the resource kinds below; each has a closed spec |
| `metadata.name` | 1–63 ASCII characters, `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`; no trimming/lowercasing fallback |
| `metadata.installationRef` | Same validated slug, required on every declaration |
| `metadata.projectRef` | Same slug; required except on Project and host-scoped resources |
| `metadata.environmentRef` | Same slug; required on Deployment and DomainBinding; not on reusable Service |
| `metadata.uid` | Server-assigned immutable UUID, response only; not a display slug or user permission |
| `metadata.generation` | Positive integer desired-state generation, server increments when spec changes |
| `metadata.resourceVersion` | Opaque compare-and-swap token, response only; stale mutation gets a conflict |
| `metadata.createdAt`, `updatedAt` | Server UTC RFC3339 timestamps; never included in deterministic plan identity |
| `status.observedGeneration` | Generation actually inspected; absence is unknown, not success |

Before persistence, a resource key is the tuple
`(installationRef, kind, projectRef?, environmentRef?, name)`. References in
declarations resolve by these keys; persisted references bind immutable UIDs to
prevent delete/recreate aliasing. Resource names and UIDs never grant access.
Project ownership is an identity/group reference verified against authenticated
context; a caller cannot grant itself membership by supplying `spec.ownerRef`.
ES1 is offline structural/scope validation only, not authentication enforcement.

Uniqueness: Project by installation/name; Environment and Service by
installation/project/name; Deployment by installation/project/environment/name;
EdgeGateway by installation/name. Server admission checks all foreign-key scope
components, not just resource names. Project ownership is distinct from a
business application's tenants; existing `platform.tenants` is not this registry.

## Smallest resource specs

All listed spec fields are required unless marked optional. Ref fields below
use the slug type above. These are field definitions, not claims of implemented
datastores or runtime enforcement.

| Kind | Spec | Invariants and first consumer |
|---|---|---|
| Project | `ownerRef` (slug identifying an authenticated group), optional `budgetRef` | Installation-scoped; project is metadata.name. ES1 validates syntax; PR3 validates membership. |
| Environment | `policyRef` (slug), optional `quotaRef` and `placementRef` (slugs) | Arbitrary name, no tier enum; policy is explicit and cannot be inferred from `prod` substring. Placement is independent of name. ES1 needs an explicit local policy catalog. |
| Service | `runtimeRef` (slug), `port` (integer 1–65535), optional `resources` and `secretRefs` (unique array of secret-ref slugs) | Logical project-scoped HTTP service for ES1; runtimeRef resolved against an explicit input catalog. Worker/other protocols require a later versioned profile, not invented HTTP ports. No shell, privileged mounts, raw env secrets or driver configuration. |
| Deployment | `serviceRef`, `hostRef`, `artifact` (`repository@sha256:` plus 64 lowercase hex), `serviceGeneration` (positive integer) | Environment/project scope must match service; immutable attempt binds artifact and generation. New rollout gets a new UID; existing spec never silently retargeted. ES2/ES4 own implementation. |
| EdgeGateway | `hostRef`, `driver` (`caddy`, `nginx` or `traefik`), `listenerPorts` (unique array, initially 80/443) | Installation-owned, one active public edge per host/listener; availability of an enum value does not mean a driver is supported. ES3 first supports Caddy only. |
| DomainBinding | `gatewayRef`, `zoneRef`, `hostname`, `pathPrefix`, `serviceRef`, `visibility` (`public` or `private`), `stripPrefix` (boolean) | Project/environment scope; upstream derived from admitted deployment, never an arbitrary URL/IP. Zone access and route exclusivity checked transactionally. |
| ResourcePolicy | `scope` (`host`, `project`, `environment`), `cpuMillis`, `memoryBytes`, `storageBytes`, `buildConcurrency` (nonnegative safe integers), `mode` (`advisory` or `enforce`) | Ref scope agrees with owner. Host policy also requires `reservedCpuMillis`, `reservedMemoryBytes`; values are limits, not billing. ES2 introduces runtime capabilities/admission. |
| Operation | Server-created request/execution record described below | PR3; CLI/API/CI/MCP share one evaluator and execution path. |

`Service.resources`, when present: closed object with `cpuRequestMillis`,
`cpuLimitMillis`, `memoryRequestBytes`, `memoryLimitBytes`, `storageBudgetBytes`,
`pidsLimit`, `replicas` (positive safe integers). Requests must be <= limits.
ES1 validates shape/math only; applying requires resource policy and capabilities.
SecretRef is an opaque identifier scoped to project/environment and resolved only
by an authorized worker. No secret value appears in a plan or operation record.

Host inventory and policy catalogs are explicit trusted admission inputs, not
proof of a live machine. Future Host responses distinguish declared capacity,
reserved capacity, allocation ledger, measurement time and observed availability.
PR1 does not discover hosts or require a database, gateway or SecretRef backend.

## Declarative example (proposed wire form)

```json
{
  "apiVersion": "bsk/v0alpha1",
  "kind": "Environment",
  "metadata": {
    "name": "review-142",
    "installationRef": "fixture-install",
    "projectRef": "fixture-a"
  },
  "spec": { "policyRef": "disposable" }
}
```

ES1's bundle is `{apiVersion, resources, catalog}`. `resources` contains Project,
Environment and Service declarations only. `catalog` is a closed object with
unique slug arrays `policies` and `runtimes`, plus `routes` (array, may be empty).
Each route is a closed object of `installationRef`, `projectRef`,
`environmentRef`, `serviceRef`, `hostname`, `pathPrefix`, `visibility`,
`stripPrefix`, using the types above. This allows offline duplicate/scope tests
without pretending a gateway exists. No implicit global/default catalog is read.
Its route claim semantics are shared with future DomainBinding.

## Routes and resource admission

Initial hostname policy accepts lowercase ASCII DNS labels (1–63 characters,
letters/digits with interior hyphens) separated by dots, total <=253 characters.
Require a dot; deny wildcards, trailing dots, IP literals, userinfo, ports and
Unicode. International names require reviewed ASCII IDNA input later; do not
silently normalize competing representations. Fixture hostnames use `.test`.
Initial paths are `/` or slash-delimited `[A-Za-z0-9_-]+` segments; deny repeated
slashes, trailing slash except root, dot segments, percent encodings, query,
fragment and regex. Match segment boundaries: `/api` matches `/api/x`, not
`/apix`; longest matching prefix wins, with explicit strip behavior.

Route exclusivity key is `(installationRef, hostname, pathPrefix)`, independent
of visibility and gateway. Reserve a hostname for one project/environment to
prevent cross-owner catch-all or nested-path capture. Nested paths for that
same owner are allowed; duplicate exact claims fail, even from the same owner.
Rebind/move requires an explicit authorized transaction, not implicit overwrite.
Zone ownership, certificate permission, DNS mutation approval and private
reachability are distinct checks; a syntactically valid hostname proves none of
them. ES1 only verifies the input graph; ES3 verifies persistent claims/runtime.

CPU units are integer millicores, memory/storage units integer bytes. Admit
sum(request × replicas) against environment and project budgets and host capacity
minus reserves. Reserve effective CPU/memory limits rather than requests by
default on Compose, unless a reviewed overcommit policy explicitly allows more.
Include old/new rollout overlap and build/edge/control-plane overhead. Allocation
and route reservations must commit with operation enqueue to prevent races.
Reject negative, non-finite, unsafe integers, request > limit and overflow.

Driver capability reports are per host/version: `supported`, `unsupported` or
`unknown`, with evidence and timestamp. Report declared, admitted, enforced and
observed resources independently. Unsupported/unknown enforce-mode controls
deny admission; advisory storage reports budget/usage without claiming a hard
quota. Compose CPU reservation is not a guaranteed scheduler reservation.

## Plan, operation and observed state

Proposed pure interfaces:
`validate(bundle) -> {valid, diagnostics[]}` and
`plan(bundle) -> {apiVersion, mode:"dry-run", planId, actions[], diagnostics[]}`.
Diagnostics contain `code`, JSON pointer `path`, `message` and resource key;
no secret values. Invalid input yields no actions and a nonzero CLI exit.
Plan actions are `declare` with resource keys, specs and unmet runtime checks;
they are not applied changes. Sort by tuple, sort object keys recursively,
preserve semantically ordered arrays, and sort set-valued arrays by their
contract identity. Hash UTF-8 canonical JSON of validated version, catalog and
resources with SHA-256 for `planId`; include no clock, random UID or local path.

ES1's offline plan is **not executable authorization**. PR3 adds a server-side
plan token bound to actor, target UIDs/generations, policy version, capability
snapshot, reservations, expiry and approval. Admission rechecks these before
execution. A changed spec, policy or reservation invalidates the token.

Operation request: `{action, targetRef, planRef, idempotencyKey}`. Server assigns
`uid`, authenticated `actorRef`, `correlationId`, timestamps and redacted audit
records. Scoped key uniqueness is `(actor, installation, project, environment,
action, idempotencyKey)`; same key/different payload is a conflict. Supported
actions are enumerated by the service; never accept arbitrary shell commands.
Approval binds action, target, plan and expiry; a supplied boolean is not proof.

State machine: `queued → running → succeeded | failed | cancelled`, with
`queued → cancelled` allowed. Bounded attempt retries occur within running;
terminal records are immutable and a new attempt/operation explicitly links
the prior failure. Cancellation after mutation reconciles actual side effects
before reporting cancelled; it does not imply rollback. Durable leases serialize
environment mutation; a separate gateway lease protects shared config. Lock
ordering must be fixed (host admission, environment, gateway) and restart-safe.

`desired` is accepted intent; `planned` is evaluated change; `applied` is the
last driver-acknowledged generation/artifact; `observed` is a timestamped runtime
inspection. Driver exit zero is insufficient for `succeeded`: check the expected
artifact/generation, readiness and route postconditions. Timeouts or unreachable
workers produce unknown/stale observation and recoverable failure, never success.
Use reconciliation and idempotent steps, not an exactly-once delivery claim.

`down` stops only owned runtime and preserves persistent data. `destroy` requires
separate authorization, verified ownership for every resource and backup policy;
never prune globally or delete unlabeled/foreign resources. Artifact rollback
cannot reverse an incompatible database migration. Audit includes actor, target,
operation, policy decision and outcome; application tenants and raw secrets stay
out of control-plane logs.

## Compatibility

`v0alpha1` is proposed, not deployed. Once used, reject unsupported versions;
breaking field or policy changes require an explicit version/migration decision.
Do not repurpose module `schemaVersion`, `EnvironmentName` or existing env files.
Legacy configuration continues unchanged until separately reviewed adapters map
it explicitly. Resource/operation schemas do not certify enforcement, licenses,
production approval, or business tenant isolation.
