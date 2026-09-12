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
