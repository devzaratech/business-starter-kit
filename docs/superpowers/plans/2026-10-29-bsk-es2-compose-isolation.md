# PR2a / ES2 implementation plan

**Scope:** additive opt-in Compose planning, local admission/inventory and
read-only Docker observation/lifecycle protection. Base `c9ba057`; branch
`feat/bsk-es2-compose-isolation`. Existing ES1 and legacy Compose are preserved.
The master plan remains the sole long-term roadmap.

**Architecture:** `bsk.compose/v0alpha1` wraps unchanged ES1 declarations and a
closed deployment-side workload list (HTTP services plus private synthetic data/
worker components). No raw Compose fragments, host mounts, public ports or shell
commands are accepted. Stable scope derives from installation/project/environment
plus a SHA-256 suffix; the local registry checks the full identity for collisions.
Generated Compose JSON is valid YAML and has explicit network/volume ownership.

**Storage:** one authoritative local inventory per host, exclusive filesystem
lock, validated whole-state transactions and atomic rename. Capacity sums effective
CPU/memory/PID limits including replicas and host reserves; project/environment
budgets also apply. Reservations are retained through down; no automatic reclaim,
stale-lock breaking, adoption or upgrade replaces an existing claim.

**Lifecycle:** only typed plans, never Docker mutation. `stop`/`down` preserve
volumes. Destructive intentions require inventory plus fresh actual ownership
inspection via an explicitly authorized disposable Docker context, and reject
missing, foreign or unexpected objects. Plans do not authorize later execution.
Read-only inspection reports requested/admitted versus inspected runtime limits,
unknown/mismatched enforcement and stale/missing observations honestly.

## Tasks and verification

1. TDD: `scripts/compose/lib/plan.mjs`, schema and synthetic fixtures/tests for
   scopes, topology, labels, strict input and resource/capability admission.
2. TDD: local `inventory.mjs`; atomic host/project/environment claims, duplicate
   rejection/idempotency, persisted collision checks, cross-process races,
   corrupted state and failure isolation. No future PR3 dependency.
3. TDD: read-only Docker adapter, observed limits and guarded lifecycle planning;
   negative context/endpoint/labels/foreign resources and preservation tests.
4. Thin opt-in CLI, npm/CI tests, English usage/evidence docs; minimal AGENTS
   milestone correction. Run all applicable baseline checks and independent review.

Each task has a failing test before implementation and an incremental commit.
Use existing Node/Ajv only. Local inventory permissions and ownership assume a
trusted OS operator; this is not a multi-user authorization service. Storage is
advisory only; enforce-mode unsupported/unknown capabilities deny admission.
Secrets have no implemented backend and are rejected rather than silently exposed.

## Runtime gate and limitations

Only default/Desktop contexts were found during read-only context inventory.
Neither is an authorized disposable host. Do not mutate either or create an alias
to the same daemon. Runtime tests are blocked unless an operator separately
designates a disposable Linux daemon/context, pins its endpoint/engine identity
and authorizes the conformance run. Future evidence must include Engine/Compose,
kernel/cgroup versions, cgroup values/load effects, connectivity denials and data
checksums before/after Project A lifecycle. Config rendering and test doubles do
not prove these results. No ES2 conformance claim or ES3 implementation in PR2a.

Rollback removes only this additive path and test wiring. Retain any local
inventory/claims until actual resources are independently verified; deleting a
registry is not a teardown or a safe release of resource reservations.
