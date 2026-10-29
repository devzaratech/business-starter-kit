# Opt-in Compose isolation and local resource admission (PR2a / ES2)

This additive driver can render owned Compose models, reserve local capacity,
inspect an authorized disposable Docker target and prepare guarded lifecycle
intentions. **It does not execute Docker mutations. ES2 runtime conformance is
not established.** The VPS Compose files remain the legacy compatibility path;
no resource is migrated or adopted automatically. ES3 gateways/TLS are absent.

## Local workflow

Use the existing Node >=20 and locked Ajv dependencies. From the repository root:

```bash
node scripts/compose/cli.mjs plan scripts/compose/fixtures/request-a.json
node scripts/compose/cli.mjs init .data/es2-inventory scripts/compose/fixtures/host.json
node scripts/compose/cli.mjs claim .data/es2-inventory scripts/compose/fixtures/request-a.json 0
node scripts/compose/cli.mjs claim .data/es2-inventory scripts/compose/fixtures/request-b.json 1
node scripts/compose/cli.mjs inventory .data/es2-inventory
npm run compose:test
```

Only `init` and `claim` write local inventory, at the explicitly supplied path.
`plan` writes JSON to stdout and does not create configuration/state files.
The checked-in fixtures are synthetic: their example.test image digests and host
capability/budget declarations are test inputs, not a runnable deployment or real
capability evidence. No credentials or secret values are accepted.

Success exits 0 with JSON on stdout. Rejection exits 2 with a static error code
and redacted JSON on stderr. Input files are bounded to 1 MiB of UTF-8 JSON and
must be regular local files. Unknown commands, raw shell/Compose fragments,
URLs/UNC paths and implicit defaults are unsupported. There is no apply, exec,
prune or teardown-execution command. Do not treat generated actions as shell.

## Contract and ownership

[bsk-compose-v0alpha1.schema.json](../../contracts/schemas/bsk-compose-v0alpha1.schema.json)
is a closed draft-2020-12 wrapper around the unchanged ES1 declaration schema.
`target` requires installation/project/environment/host/deployment references.
The project/environment must exist in the ES1 input. HTTP workload `serviceRef`
must resolve within that project, and any declared ES1 Service resources must
match the deployment resources. Nonempty ES1 secret refs deny planning because
no secret backend has been implemented.

`workloads` holds at most 100 deployment-side components with unique names,
roles `http`, `data` or `worker`, pinned OCI digest references and explicit
resource fields. Data/worker components are private deployment auxiliaries;
this does not change ES1's HTTP Service contract. Each HTTP Service may be bound
once. Optional `dataRefs` must name data components within the same plan;
`persistent: true` creates one owned named volume mounted at fixed `/data`.
There are no configurable host bind mounts, public ports, commands, privileges,
devices, host networking, Docker sockets or arbitrary environment injection.

Compose scope is `bsk-<project-prefix>-<environment-prefix>-<24 SHA-256 hex>` over
the full installation/project/environment tuple. Deployment identity does not
rename persistent resources. Prefixes alone never identify ownership: inventory
stores the full tuple and rejects a conflicting scope claim. Names are bounded
and stable under input/workload reorder. The plan ID hashes canonical target,
topology, workloads and resource totals. No mutable container_name is emitted.

All containers, networks and volumes carry `dev.bsk.installation`, `.project`,
`.environment`, `.deployment`, `.service`, `.scope` and `.managed-by` labels.
Shared networks use service `_shared`. Deployment labels are immutable for the
initial claim; in-place upgrades/adoption need a later reviewed migration.

Each scope has separate internal ingress and data bridges. Only HTTP components
join ingress; data/worker components never do. HTTP joins data only with explicit
data references. Within a project's data bridge, permitted participants can reach
other data services: this is project/environment isolation, not per-table or
hostile-tenant security. No default bridge, external network or host port is used.

## Admission, persistence and limits

The host policy is operator-supplied and immutable through the CLI. It declares
capacities, reserves, supported/unsupported/unknown capabilities, and explicit
project/environment budgets. The sample policy is not measured host inventory.
Use exactly one authoritative inventory directory for each physical host; separate
registries cannot coordinate each other's claims. The store is local-filesystem
only, not a distributed/shared-network-filesystem database or multi-user API.

Admission sums effective CPU/memory/PID limits times replicas across all claims,
after reserving OS/edge/build/control-plane headroom. Project and environment
budgets also apply. Requests cannot exceed limits; exact arithmetic rejects
overflow. Docker's 6 MiB memory-limit floor and a maximum of 1,000 total replicas
are driver bounds, not changes to ES1. New claims cannot silently replace old
deployments, so rollout overlap cannot erase a prior reservation.

Compose receives `cpus`, `mem_limit`, matching `memswap_limit`, `pids_limit`,
replicas and memory soft reservation, plus dropped capabilities, no-new-privileges
and bounded logs. CPU requests are accounting inputs, not a guaranteed scheduler
reservation. Storage bytes are advisory budgets only; enforce mode is rejected
even if a host file asserts storage support. Unknown/unsupported mandatory CPU,
memory or PID capabilities deny admission.

Admission reports `requested` and `admitted`; `enforced` stays `unknown` and
`observed` is initially null. Read-only Docker inspection reports actual configured
limits and mismatches, but keeps kernel enforcement/conformance unproven. Cgroup
inspection and controlled load/OOM tests are still required for ES2 acceptance.

Inventory uses an exclusive `.lock`, schema/derived-plan validation on every read,
expected revisions, a temporary fsynced file and atomic rename for a whole-state
commit. POSIX also fsyncs the directory; Windows durability/ACL semantics differ.
A process crash may leave a lock/temp file: no time-based lock stealing occurs.
The trusted local operator must inspect/recover it with no live writer. After an
I/O error around commit, inspect the persisted revision before retrying; do not
assume the commit was absent. Same-plan replay at the current revision is
idempotent; conflicting identities, stale revisions, corruption and capacity
overcommit fail closed. A failed transaction does not rewrite another claim.

## Read-only Docker boundary and lifecycle

No safe target is configured by default. An operator must separately authorize
a disposable **Linux daemon**, provision an isolated context and pin a JSON
authorization descriptor with exactly:

`context`, `endpoint`, `engineId`, `hostRef`, `disposable: true`, `authorizationRef`.

Context must be named `bsk-es2-*`; endpoint must be a canonical dedicated Unix
socket, not default `/var/run/docker.sock`, `/run/docker.sock`, Desktop or an alias
of an existing daemon. The adapter checks the endpoint and actual Linux engine ID
before resource reads, and strips ambient DOCKER_/COMPOSE_ overrides. The human
authorization must establish disposability: a name or boolean alone proves none.
Do not invent an authorization descriptor or alias the developer's daemon.

With that separately authorized descriptor and a registered plan ID:

```bash
node scripts/compose/cli.mjs versions .data/es2-inventory PLAN_ID authorization.json
node scripts/compose/cli.mjs observe .data/es2-inventory PLAN_ID authorization.json
node scripts/compose/cli.mjs lifecycle .data/es2-inventory PLAN_ID down authorization.json
```

The adapter only issues context/info/list/inspect/Compose-version reads, with
fixed argv, no shell, bounded output and timeouts. It inspects both expected
names and all resources with the Compose-project label. Inventory plus actual
Docker labels must match for every object. Missing/unlabeled/foreign/extra
resources, duplicate IDs, foreign network attachments, public ports or unmanaged
mounts deny lifecycle plans. Engine failure is an error, never inferred success.

`stop` emits only owned container stop intentions. `down` also emits owned
container/network removal intentions and preserves volumes. `destroy` intent
additionally requires a confirmation JSON file containing the exact `confirmPlanId`
and `confirmDataLoss: true`, and verified volume ownership. All plans say
`mode: "intent-only"` and `executionAuthorized: false`; there is no destructive
executor. Ownership must be checked again by any future executor at use time.
Inventory claims are retained after lifecycle planning; no capacity is released
because a plan was printed. No global prune or image deletion exists.

## Verification, security and rollback

See [ES2 evidence](es2-verification.md) for actual passed/failed/blocked checks.
Unit tests and Docker inspect test doubles do not prove runtime isolation. Real
Compose config parsing does not start containers or verify cgroups/connectivity.

Labels and local registry validation protect against mistakes by cooperating
operators, not hostile host root or a compromised Docker daemon. Protect registry
permissions/Windows ACLs and never share write access with workloads. No project
RBAC, remote agent, production authorization or durable operation queue is added.
Existing npm advisories and deployment risks remain unresolved.

Rollback removes only the opt-in driver/schema and test wiring. Preserve any
inventory, reservations and persistent volumes until separately verified; deleting
state is not teardown. Legacy Compose, ES1 schemas/CLI, env helpers and existing
deployments remain unchanged. ES2 conformance and ES3 require separate work.
