# ES1 implementation verification

Date: 2026-10-29. Base: merged PR0/ES0 commit `ea33b92`. Branch:
`feat/bsk-es1-declarations`. Scope: the three tasks in the
[PR1 proposal](../superpowers/plans/2026-10-29-bsk-pr1-es1-proposal.md), implemented
as an additive declaration schema, pure evaluator/planner and read-only CLI.

## Local results

Local environment: Windows PowerShell, Node `v24.22.1`, npm `11.19.1`, Docker
Compose `v5.5.1`. Existing locked dependencies were used; none was added or
updated. Linux/Windows Node 20 checks are wired into the existing GitHub Actions
architecture job. Local Node 24 evidence is not a substitute for those hosted
checks. Jenkins runs the same declaration command after its locked install.

| Check | Actual result | Scope / limit |
|---|---|---|
| `npm run declarations:test` | Exit 0; 183 passed, 0 failed/skipped | 141 validation, 16 planner and 26 CLI tests; helpers are outside test discovery |
| `npm run architecture:test` | Exit 0; 104 passed, 0 failed/skipped | Existing schema/dependency/CI governance suite unchanged |
| `npm run architecture:check` | Exit 0; 10 modules validated | No existing module metadata changes |
| `npm test` | Exit 0 on authorized retry; 4 passed, 0 failed/skipped | Node 1, web 2, worker 1; initial sandbox loopback `EACCES` blocked Node health test |
| `BASH_PATH` set to Git Bash, then `npm run infrastructure:test` | Exit 0 on authorized retry; 7 passed, 0 failed/skipped | Ten Compose configurations rendered; three Studio safeguards operate on temporary files. Initial sandbox run passed four render/port tests but blocked three Bash fixtures with MSYS access denial |
| `npm run build --if-present` | Exit 0; Vite transformed 29 modules | Existing web build; no OCI images built |
| `mvn --batch-mode test` in `apps/api-spring` | Blocked, exit 1: Maven command not found | No Java tests executed locally; no wrapper/toolchain installed by this change |
| `npm audit --json` | Exit 1; 11 affected entries: 4 moderate, 6 high, 1 critical | Advisory query succeeded; unresolved security debt, not a green security check; unchanged lockfile |

The existing [ES0 security/deployment findings](../architecture/es0/implementation-status.md)
and [dependency advisory evidence](../architecture/es0/test-results.md) remain
intact. This feature does not remediate them or establish runtime enforcement,
authentication or production safety. Optional SonarQube, Jenkins execution,
FastAPI/PHP runtime tests, Docker runtime/isolation and ES2+ conformance were not
run. No production or external infrastructure was accessed.

## Test-driven evidence and behavior checks

Each task's tests ran before its implementation: validation and planner tests
failed on their missing modules; CLI subprocess tests failed on the missing CLI
and its absent exit/result behavior. After implementation all corresponding tests
passed. The full declaration run above followed all three tasks and the helper
relocation out of Node's automatic test discovery.

Tests exercise two projects with 1, 5 and 10 arbitrary environments each; equal
names across scopes; unknown/foreign references; closed fields/types/versions;
host/path/route ownership; exact and aggregate safe-integer bounds; redacted
diagnostics; 1 MiB and 1,000-claim limits; unsupported commands/flags; UTF-8/read
errors; exact CLI exit codes and output streams.

Planner tests pin an independently computed SHA-256 value for canonical JSON,
assert byte-identical plans after object/resource/set reorder and changed identity
after meaningful spec/catalog changes, and verify no input/output aliasing.
Evaluation runs with filesystem, network, subprocess, environment, clock and cwd
access denied after schema/module loading. Fixture and CLI working-directory
snapshots remain identical before/after validation, planning and rejected commands.
CLI process tests also vary environment variables and run outside the repository.

The runnable two-project fixture validates with `{"valid":true,"diagnostics":[]}`
and plans six declaration actions with ID
`0e40b414178107c921082a8b99c2ddfea5b7b7d42ade65fef0af893dc3219051`.
Each action reports `runtimeChecks: "not-evaluated"`; invalid plans have a null ID
and empty actions. No apply/operation success or resource enforcement is implied.

## Review and remaining gates

The final review checks full scoped identities, canonical output, redaction,
compatibility, filesystem effects, CI integration and unintended changes against
the merged ES0 contracts. Baseline source/Compose/deploy/env helpers, module
contracts, lockfile and ES0 audit/security artifacts must remain unchanged.
Hosted Java 17 and Node 20 results must be checked on the resulting PR rather
than copied from the prior PR0 run. Any hosted results are separate evidence from
the local table above. ES1 acceptance does not pass EGPB or authorize ES2.

Rollback removes only the new declaration path and npm/CI wiring. There is no
persisted state, data migration or host rollback. Next engineering task, only
after review and a separate assignment: ES2/PR2a disposable-host Compose ownership
and resource admission. No ES2 implementation is included here.
