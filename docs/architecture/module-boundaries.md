# Module Boundaries

The starter kit must keep platform primitives separate from business-specific products.

## Platform Core

The platform core owns reusable capabilities:

- Identity primitives
- Tenant primitives
- Permission primitives
- Audit primitives
- Storage contracts
- Integration contracts
- Observability contracts
- Deployment profiles

## Product Modules

Product modules own business-specific workflows:

- Logistics workflows
- CRM workflows
- ERP workflows
- Billing workflows
- CMS-backed portals
- Vertical reporting

## Fundamental rule

Do not put customer-specific logic into the platform core.

```txt
Good: storage provider interface
Bad: customer invoice upload workflow inside the core
```

## Dependency direction

The long-term Golden Path dependency direction is:

```txt
Products → Profiles → Runtimes → Capabilities → Kernel → Contracts
```

Adapters, deployment targets and private extensions live at the edges. Core kinds (`contract`, `kernel`, `capability`, compliance kernel and public extension contracts) must not depend on runtimes, adapters, deployment modules, applications, reference clients or private extensions.

A public module must never depend on a private module.

These rules are enforced by `npm run architecture:check` from `bsk.module.json` metadata rather than being documentation-only conventions.

## Explicit edge policy

The checker uses an explicit allowed-target table, not numeric layer ranks.
The complete table and rationale are in the
[review correction policy](../superpowers/specs/2026-09-28-foundation-review-corrections-design.md#dependency-policy).
Forward shortcuts and legitimate same-layer composition are allowed; reverse
edges and self-dependencies are rejected. Adapters consume inward ports,
deployment/conformance stay at the edges, and private extensions consume public
contracts. Generic capabilities consume telemetry contracts, not observability
backends.

Every resolved optional dependency obeys the same direction, visibility and
`forbiddenKinds` restrictions as a required one. Missing optional dependencies
are permitted; missing required dependencies fail.

Required Freedom Class edges are F1 → F1, F2 → F1/F2, and F3 → F1/F2/F3.
Optional integrations may cross Freedom Classes, but can never bypass kind,
visibility or `forbiddenKinds` restrictions. Thus an F1 supported required path
cannot transitively require F2/F3. These policy checks do not determine a license
or inspect source-code imports.

## Current physical layout

The Foundation Guardrails checkpoint deliberately keeps the existing `apps/` and `packages/` directories in place. Module manifests classify the current code without pretending that the conceptual target layout has already been migrated.

The core must not depend on a specific product, and a future product such as OpenFiscal must be able to consume equivalent public contracts without becoming part of BSK itself.
