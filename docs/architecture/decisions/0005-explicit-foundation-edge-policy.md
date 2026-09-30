# ADR 0005: Explicit Foundation dependency policy

## Status
Accepted for PR #1 review corrections (2026-09-28).

## Context
The original Foundation plan prescribed a small denylist. The Golden Path
documentation described a stronger dependency direction. The user accepted
strengthening the executable policy while preserving legitimate same-layer
composition and explicitly handling side roles.

## Decision
Use the [explicit allowed-edge policy](../../superpowers/specs/2026-09-28-foundation-review-corrections-design.md#dependency-policy),
independent public/private and required Freedom Class checks, and per-module
forbidden kinds. Validate resolved optional edges, while allowing absent ones.
Core telemetry consumers use contracts; observability distributions remain
replaceable outer implementations. Canonical JSON Schema drives validation.

## Alternatives
A numeric rank cannot accurately model adapters, extension contracts,
deployment and conformance. Keeping only the original denylist permits reverse
core edges and profile detours. Duplicating schema rules in JavaScript causes
the canonical contract and CI acceptance to diverge.

## Consequences
Kind-pair tests specify both positive and negative cases. Required F1 paths
remain F1; F2 required paths may use F1/F2; F3 may use all classes. Optional
cross-class integrations are permissible only when all other edge rules pass.
New module kinds require an explicit policy decision. This metadata checkpoint
does not inspect runtime imports, certify licenses or implement conformance.
