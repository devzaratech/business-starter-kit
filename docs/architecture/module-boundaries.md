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

## Current physical layout

The Foundation Guardrails checkpoint deliberately keeps the existing `apps/` and `packages/` directories in place. Module manifests classify the current code without pretending that the conceptual target layout has already been migrated.

The core must not depend on a specific product, and a future product such as OpenFiscal must be able to consume equivalent public contracts without becoming part of BSK itself.
