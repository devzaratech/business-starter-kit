# BSK Golden Path design status

The Golden Path architecture design was approved before implementation. Its governing invariants for this branch are: polyglot, open-core, schema-first, provider-neutral; small kernel and explicit capabilities; public contracts as source of truth; conformance over framework coupling; Freedom Class independent from Support Level; OpenTelemetry as the observability contract; OSS core must never require private extensions; environment is separate from deployment target; and physical repository migration follows executable guardrails rather than preceding them.

This branch implements only the Foundation Guardrails checkpoint. Later checkpoints cover runtime conformance, canonical HTTP/event/telemetry contracts, resilience, compliance packs, deployment targets, CLI, supply chain, and physical monorepo migration.
