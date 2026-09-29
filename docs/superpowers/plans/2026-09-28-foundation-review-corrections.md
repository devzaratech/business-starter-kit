# Foundation Review Corrections Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and strict TDD.

**Goal:** Correct accepted PR #1 review findings without future BSK features.
**Architecture:** Explicit allowed-edge policy, independent class/visibility
constraints, and canonical JSON Schema validation.
**Tech Stack:** Node >=20, node:test, Ajv 2020, npm, GitHub Actions, Jenkins.
**Spec:** ../specs/2026-09-28-foundation-review-corrections-design.md

## Global constraints

- Do not merge. Continue `feat/bsk-golden-path-foundation` from `8d66293`.
- No business capability implementation or physical migration.
- Preserve filenames in errors, absent optional dependencies, and Preview.
- Commit original complete approved documents only from verified source text.

## Review focus

- Optional restrictions: test absent optional and resolved forbidden targets.
- Matrix exceptions: exhaustive kind pairs plus named forward/reverse examples.
- Independent classifications: required/optional 3x3 Freedom Class cases.
- Schema drift: schema mutation probe and every declared structural constraint.
- Platform differences: native test discovery on Windows and Node 20 CI.

## Tasks and RED → GREEN record

### 1. I1 optional edge restrictions
- [x] Add three rejecting optional-edge tests and absent/valid optional cases
  to `scripts/architecture/test/dependency-rules.test.mjs`; run to observe RED.
- [x] Traverse both edge sets in `lib/dependency-rules.mjs`, tolerating only
  absent optional edges; rerun focused tests GREEN; inspect for duplication.

### 2. I2 explicit kind policy
- [x] Add the spec's complete kind-pair expectations, named reverse paths,
  same-layer edges and self/unknown-kind failures; observe RED.
- [x] Implement explicit table in `lib/dependency-rules.mjs`; rerun GREEN.

### 3. I3 Freedom Class
- [x] Add required and optional class matrices, independently public targets,
  transitive required path and optional-to-private tests; observe RED.
- [x] Implement required-edge class allowlist independently; rerun GREEN.

### 4. I4 executable JSON Schema
- [x] Add wrong primitives, unknown fields at every object, duplicate and
  invalid array items, empty platform, and source diagnostic tests; observe RED.
- [x] Add locked Ajv dev dependency, compile canonical schema in
  `lib/module-manifest.mjs`, remove duplicate validators; focused suite GREEN.
- [x] Add tests for dependency installation before guardrails in both CI
  engines; observe RED then add `npm ci` and verify GREEN.

### 5. M1 SemVer
- [x] Test valid combined prerelease/build and invalid leading-zero/empty
  identifiers in both schema and parser; observe RED.
- [x] Correct only canonical schema regex; verify GREEN.

### 6. I5 truthful seeds
- [x] Require empty dependency/capability declarations and retained core
  prohibitions in `seed-manifests.test.mjs`; observe RED.
- [x] Empty four arrays in each core manifest; verify GREEN.

### 7. I6 and PR CI trigger
- [x] Test portable package command, cwd-independent CLI integration, PR base
  inclusion and Windows/Node20 matrix; observe RED.
- [x] Update package script, test path resolution and CI; verify GREEN.

### 8. Documents, complete verification, independent review
- [x] Retrieve complete approved original design and detailed plan for commit.
- [x] Update boundary/metadata docs to match explicit corrective policy.
- [x] Run full architecture, npm workspace tests/build, Maven, Compose,
  normalization and diff checks. Record commands and results below.
- [x] Obtain fresh independent review; address any verified regressions by TDD.
- [ ] Commit/push corrections to PR #1 and inspect fresh CI. Do not merge.

## Execution evidence

Initial checkout clean at `8d66293`. Review-turn baseline: 16 architecture tests
pass; repository validation finds 10 modules. During correction preflight,
`node --test scripts/architecture/test` failed on Node 24, so the portable
command will use cwd-based discovery instead of a positional directory.

Ruling: execute inline on the clean existing PR branch; no parallel writers or
new worktree needed. User has authorized these corrections and their tests.

### Recorded TDD cycles

| Correction | RED observed before implementation | GREEN observed |
| --- | --- | --- |
| I1 | Three optional boundary tests failed | 9 dependency tests passed |
| I2 | Matrix, reverse-profile, self and unknown-kind tests failed | 13 dependency tests passed |
| I3 | Required class matrix and transitive F1 tests failed | 17 dependency tests passed |
| I4 | Wrong-type/additional-property/array/platform/source-diagnostic cases failed | 49 manifest tests passed |
| M1 | Combined prerelease/build and six malformed versions failed | 22 SemVer cases passed |
| I5 | Placeholder audit manifest falsely required modules | Both seed tests passed |
| I6 / CI | Four CI/portability tests failed; integration test failed from architecture cwd | Six CI/integration tests passed |
| Design reconciliation | Capability-to-observability matrix and backend test failed | 19 dependency tests passed |

The dependency matrix exercises 450 required/optional kind pairs and the
Freedom Class tests exercise all 18 required/optional combinations. A final
isolated-schema mutation regression demonstrates that changing only the schema
changes executable acceptance. It adds coverage without altering production
behavior. Refactoring kept schema rules out of the parser, shared edge checks
between required/optional paths, and used native Node discovery.

Ruling: after reading approved design section 40, treat observability
distributions as outer implementations, not generic capabilities. Otherwise a
core capability could depend directly on Grafana. Telemetry contracts remain
consumable through `contract`. The consequence is that provider implementations
must be composed by runtime/profile/deployment modules.

### Verification before the usage-limit pause

- Clean Node 20.20.2/npm 10.8.2 install: passed.
- Architecture suite: 102/102 passed (before adding schema-mutation regression).
- Architecture check: 10 manifests passed.
- Workspace tests: API 1, web 2, worker 1 passed; Vite production build passed.
- Docker Compose: all 10 configuration files validated.
- npm install reported 9 audit advisories; dependency review remains required.
- New dependencies are Ajv and four transitive packages. No existing package
  entry, version or integrity hash changed.
- Full original design SHA-256:
  `1e378f8557ed0acd3afba6e7dfeb3441e1346c56394285cfd10c0d82e8f746f2`.

On 2026-09-29, all 21 modified and 5 untracked correction files were confirmed
present at the original head. Fresh verification and independent review resume
from that state, rather than repeating implementation.
Ruling: original full design/plan provenance was initially unresolved. The user supplied both authoritative attachments; the design hash matches and the entire original detailed plan is retained beneath reconciliation notes.

### Fresh final local verification — 2026-09-29

Executed on Windows 11 with Node 20.20.2/npm 10.8.2, Maven 3.9.11 and
Microsoft JDK 17.0.20.1. Downloaded Node and Maven distributions were verified
against their official SHA-256/SHA-512 checksums before use.

| Command | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Exit 0; 145 installed packages |
| `npm run architecture:test` | Exit 0; 103 passed, 0 failed/skipped |
| `npm run architecture:check` | Exit 0; 10 modules validated |
| `npm ci` | Exit 0; 145 installed packages |
| `npm test` | Exit 0; API 1, web 2, worker 1 passed |
| `npm run build --if-present` | Exit 0; Vite 5.4.21, 29 modules transformed |
| `mvn --batch-mode test` in `apps/api-spring` | BUILD SUCCESS; 2 tests, 0 failures/errors/skips |
| `docker compose -f <file> config --quiet` for every environment file | Exit 0 for all 10 files |
| `node scripts/quality/normalize-npm-lockfile.mjs --check` | Exit 0; registry URLs portable |

The independent Superpowers review found no Critical, Important or Minor
defects. Its separate Node 24.19.0 run passed all 103 architecture tests,
validated 10 modules, and passed `git diff --check`.

The later staged whitespace check also examined newly added files and found
only the authoritative design's five Markdown hard line breaks and final blank
line. Those bytes are preserved from the attachment. Strict whitespace checks
pass for all other files; the source design passes with only end-of-line and
end-of-file whitespace exemptions. This is a documented source-preservation
exception, not a claim that the unconfigured staged check passed.

The suite grew from 16 to 103 tests. Added coverage includes resolved optional
restrictions, 450 explicit kind edges, all 18 class/optionality combinations,
required transitive paths, schema structural constraints and a mutation probe,
22 SemVer cases, truthful placeholder seeds, cwd-independent discovery, and CI
installation/base-branch/Windows checks.

`npm audit --json` exits 1 with 9 advisories (5 moderate, 4 high):
baseline-browser-mapping, body-parser, browserslist, esbuild, express, nanoid,
postcss, qs and vite. All affected packages already existed at the PR head;
their lockfile entries are unchanged. Only Ajv, fast-deep-equal, fast-uri,
json-schema-traverse and require-from-string were added; none is named in the
audit. Existing dependency remediation is outside these accepted corrections.

Jenkins was inspected and its architecture stage is tested for command parity;
a live Jenkins controller was not run. Optional SonarQube is not configured
locally. Manifest validation does not claim source-import enforcement, general
cycle detection, runtime conformance or implemented business capabilities.
Remote CI evidence will be reported against the pushed commit; no merge is
authorized.

### Changed files

- `.github/workflows/ci.yml`, `Jenkinsfile`
- `package.json`, `package-lock.json`
- `contracts/schemas/bsk-module.schema.json`
- `scripts/architecture/lib/dependency-rules.mjs`
- `scripts/architecture/lib/module-manifest.mjs`
- `scripts/architecture/test/architecture-check.test.mjs`
- `scripts/architecture/test/ci-wiring.test.mjs`
- `scripts/architecture/test/dependency-rules.test.mjs`
- `scripts/architecture/test/module-manifest.test.mjs`
- `scripts/architecture/test/seed-manifests.test.mjs`
- `scripts/architecture/test/semver.test.mjs`
- `packages/audit/bsk.module.json`, `packages/auth-rbac/bsk.module.json`
- `packages/core-domain/bsk.module.json`, `packages/tenancy/bsk.module.json`
- `docs/architecture/architecture-overview.md`
- `docs/architecture/module-boundaries.md`, `docs/architecture/module-metadata.md`
- `docs/architecture/decisions/0005-explicit-foundation-edge-policy.md`
- `docs/ci-cd/ci-cd-strategy.md`
- `docs/superpowers/specs/2026-09-11-bsk-golden-path-design.md`
- `docs/superpowers/plans/2026-09-11-bsk-foundation-guardrails.md`
- `docs/superpowers/specs/2026-09-28-foundation-review-corrections-design.md`
- `docs/superpowers/plans/2026-09-28-foundation-review-corrections.md`
