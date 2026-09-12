# BSK module metadata

Every module brought under Golden Path governance is described by a `bsk.module.json` manifest conforming to `contracts/schemas/bsk-module.schema.json`.

## Fields

- `schemaVersion`: version of the manifest contract. The initial contract is `1.0`.
- `module.name`: stable lowercase module identity used by internal dependency references.
- `module.version`: independent semantic version of the module.
- `module.kind`: architectural role (`contract`, `kernel`, `capability`, `runtime`, `adapter`, `profile`, compliance roles, observability, conformance, deployment, extension roles, application or reference client).
- `module.visibility`: whether the module is part of the public surface or a private implementation.
- `module.freedomClass`: licensing/dependency classification: `F1`, `F2`, or `F3`.
- `module.supportLevel`: maturity classification: `GA`, `Preview`, or `Lab`.
- `module.license`: exact license identifier or legal license name that actually applies to the module.
- `compatibility.bskPlatform`: compatible BSK platform line, initially `1.x`.
- `dependencies.required`: governed modules required by this module.
- `dependencies.optional`: governed modules supported but not required.
- `dependencies.forbiddenKinds`: architectural kinds this module must never depend on.
- `capabilities.provides`: capability identifiers implemented by the module.
- `capabilities.requires`: capability identifiers expected by the module.

## Classification invariant

Freedom Class and Support Level are independent axes. `F1` does not imply `GA`, and `F3` does not imply `Lab`. A component may be open and experimental or proprietary and production-supported.

Manifest metadata must describe the repository's actual legal and technical state. It must not claim an OSS license, maturity level, dependency, or capability merely because that state is planned for a later Golden Path checkpoint.

## Open-core invariant

The BSK core is licensed under Apache-2.0 and its governed public core modules are classified as `F1`. Future private extensions must carry their own legal license metadata and may depend on documented public extension contracts. Public modules must never depend on private modules.

The repository may remain private while the project is being developed; repository visibility and source-code license are separate concerns.

## Executable guardrail

Run the architecture tests and repository-wide manifest validation with:

```bash
npm run architecture:test
npm run architecture:check
# or
make architecture-check
```

The repository-wide check intentionally ignores `scripts/architecture/test/fixtures` so negative and duplicate fixtures cannot contaminate production module discovery.

## Current migration rule

The first Foundation Guardrails checkpoint adds metadata and executable rules to the existing repository layout. It does **not** physically move the current `apps/` or `packages/` directories into the long-term conceptual Golden Path layout. Physical restructuring is a separate migration and must be justified by a later plan.
