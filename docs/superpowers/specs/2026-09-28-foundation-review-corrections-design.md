# Foundation Guardrails review corrections

This is the corrective policy for PR #1, based on the accepted review and the
2026-09-28 implementation request. The complete approved
[2026-09-11 Golden Path design](2026-09-11-bsk-golden-path-design.md) is preserved
separately from this explicit corrective policy.

## Scope and intent

Make the existing metadata guardrails trustworthy without implementing future
BSK capabilities. The original Foundation Guardrails implementation followed a
narrower policy than the documented Golden Path direction. I2 strengthens that
policy explicitly; it is not a claim that the original implementation ignored
its original plan. Preserve Apache-2.0, Preview classifications, the physical
layout, and the existing PR branch. Do not merge.

## Dependency policy

The direction is Products → Profiles → Runtimes → Capabilities → Kernel →
Contracts. Direct downward shortcuts are allowed: a runtime need not introduce
an artificial capability merely to consume a contract. No numeric ranks apply.
Same-kind composition is permitted (between different modules). The following
sets define roles, not implicit ordering:

- C: `contract`, `extension-contract` (public integration interfaces).
- K: C plus `kernel`, `compliance-kernel`.
- B: K plus `capability`.
- R: B plus `runtime`, `adapter`, `observability` (runtime/provider composition).

| Source kind | Allowed target kinds |
| --- | --- |
| contract | contract |
| extension-contract | C |
| kernel | C, kernel |
| compliance-kernel | K |
| capability | B |
| observability | B, observability |
| adapter | B, adapter |
| runtime | R |
| compliance-pack | B, compliance-pack |
| profile | R, compliance-pack, profile |
| application | R, compliance-pack, profile, application |
| reference-client | C, runtime, reference-client |
| deployment | all kinds except private-extension |
| conformance | all kinds |
| private-extension | C, private-extension |

Adapters implement inward-facing contracts and can share adapter helpers;
runtimes bind those implementations. Deployment and conformance are outer
composition/verification roles, never core dependencies. Private extensions
consume public contracts or compose private extensions. A private extension
is not an implementation dependency of a public module. Self-dependencies are
invalid; general cycle analysis is outside this correction.

`observability` represents replaceable implementations/distributions (approved
design section 40). Generic capabilities consume telemetry `contract` modules,
never a Grafana/backend module through an observability shortcut.

Every resolved edge, required or optional, must satisfy the table, public →
private prohibition, and source `forbiddenKinds`. Unresolved required modules
fail; unresolved optional modules are allowed. Unknown kinds fail closed.

Freedom Class is independent of visibility and support level. Required edges:
F1 → F1 only; F2 → F1/F2; F3 → F1/F2/F3. This ensures that an F1 supported path
cannot acquire a required F2/F3 dependency transitively. Optional edges may
target any Freedom Class because they are outside the required supported path;
all other edge restrictions still apply. An F2 module cannot require F3 under
this conservative checkpoint policy. These are dependency acceptance rules,
not a legal determination of a module's license. Test all nine required and
nine optional class combinations independently of visibility.

## Metadata contract

Use the canonical draft-2020-12 JSON Schema as the executable source of truth
with Ajv 2020, strict mode, all errors, no type coercion or data mutation.
Diagnostics retain source filename and instance/property path. Do not maintain
parallel enums or regexes in the parser. SemVer 2.0 syntax lives in the schema;
test prerelease plus build metadata, leading zeroes and empty identifiers.

The four placeholder core packages provide and require no implemented
capabilities or modules. Empty required/optional/provides/requires arrays;
retain `forbiddenKinds`. Runtime manifests remain Preview and unchanged.

## Portability and CI

Run architecture tests by changing into `scripts/architecture` and invoking
`node --test` (native discovery, no shell wildcard). Resolve integration-test
paths from `import.meta.url`, not caller cwd. Adding Ajv requires `npm ci`
before architecture validation in both GitHub Actions and Jenkins. Include
Windows/Node 20 in the architecture job and require it through the quality
gate. Add `chore/multi-env-hardening` to PR target filters only.

## Verification and provenance

Every correction gets failing tests before production edits, then focused
green verification and refactoring as needed. Run the full architecture suite,
workspace tests/build, Maven tests, Compose validation, lockfile portability
checks and fresh PR CI. Do not represent missing tooling or skipped checks as
passes. Preserve a RED/GREEN execution record in the corrective plan.

The original complete approved design/plan were supplied as attachments. The
design is copied verbatim; the detailed plan is preserved in full beneath
live-repository reconciliation notes. Historical plan examples do not override
the accepted corrections or the implementation state of the repository.
