# ADR 0006: Canonical resources and shared operations

## Status

Proposed for PR0 / ES0 review, 2026-10-29. No supersession of ADRs 0001–0005.

## Context

Module metadata describes architecture, not projects or deployments. Current
environment helpers disagree on unknown names. There is no common control plane,
operation ledger or enforced authorization. Adding clients before shared
semantics would duplicate policy and report misleading state.

## Proposed decision

Adopt the [minimal `bsk/v0alpha1` semantic contracts](../es0/canonical-contracts.md).
Keep resource API versions independent of module schema/platform versions. PR1
adds only Project/Environment/Service declaration schemas, graph validation and
offline deterministic plans. Runtime operations and durable state arrive later.

Compose CLI/API/UI/CI/MCP around the same application service and policy ports.
The CLI initially calls a pure local evaluator; authenticated execution later
uses the same evaluator plus server authorization and fresh admission. Kernel
imports only public inward contracts; workers/adapters implement execution ports.
Browsers and public APIs have no shell, SSH or global Docker socket access.

PR3 must provide durable operation/idempotency records, optimistic concurrency,
environment leases, transactional route/capacity claims plus operation enqueue,
and an outbox/reconciliation boundary. PR2 first needs persistent local inventory,
route/capacity claims and atomic concurrency checks. Select a transactional state
adapter in that PR against the contract's uniqueness/foreign-key constraints,
then reuse or explicitly migrate it for PR3's operation ledger. PR0 does not
select a database. Do not make Supabase or a runtime framework the kernel.
Distinguish desired/planned/applied/observed.

## Alternatives

Extending module manifests with deployment state confuses independent version
and ownership concerns. Client-specific scripts duplicate authorization.
A mandatory new database/queue stack in ES0 creates dependencies without an
executable use case. Claims persistence belongs to PR2; queued operations extend
that boundary in PR3 rather than becoming a prerequisite for local driver tests.

## Consequences and acceptance

Positive: one ownership model and honest state, with no physical module rewrite.
Cost: schemas alone cannot prove referential integrity, actor permission or
runtime state. Test duplicate scoped keys, cross-project refs, stale plans,
idempotency conflicts, concurrent mutation and worker interruption in their
owning slices. [Acceptance matrix](../es0/engineering-slices.md) defines gates.

Compatibility: existing module schema `1.0`, env helpers and manifests stay
unchanged. Migration needs explicit mappings; no fallback from arbitrary names
to local/prod. Rollback of this proposal is documentation-only; once persisted,
resource versions and UIDs require a separately reviewed migration.
