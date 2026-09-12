# ADR 0004: Machine-readable BSK module metadata

## Status
Accepted

## Context
BSK is a modular polyglot monorepo. Architecture rules cannot remain prose-only as runtimes, adapters, compliance packs and private extensions grow.

## Decision
Every BSK module brought under Golden Path governance uses `bsk.module.json` conforming to `contracts/schemas/bsk-module.schema.json`. Freedom Class and Support Level are separate fields. Dependency direction is checked in CI.

## Consequences
Architecture rules become executable and modules can evolve/version independently. Adoption is incremental: existing modules receive manifests without requiring an immediate directory migration.
