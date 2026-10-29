# ES2 runtime harness preparation: actual verification

Date: 2026-10-29. Branch: `test/bsk-es2-runtime-conformance`.
GitHub confirms PR #9 merged as `5da56dea6b650ecd866224a393008a172e5dcb8d`,
also verified as an ancestor of remote `main`. Working tree was clean at start.

**Runtime status: not run, awaiting explicit owner authorization. ES2 is not
complete.** No local Docker daemon was inspected or modified. Docker client
config rendering in existing tests is non-destructive. Image metadata was
resolved through anonymous official registry HTTP reads; no images were pulled,
built or run locally. The manual workflow has not been dispatched.

See the [runbook and invocation](es2-runtime-conformance.md) and
[implementation plan](../superpowers/plans/2026-10-29-bsk-es2-runtime-conformance.md).
The [historical PR2a results](es2-verification.md) remain unchanged.

## Actual local checks

| Check | Actual result | Boundary |
|---|---|---|
| `npm run compose:test` | 84 passed, 0 failed/skipped, exit 0 after review fixes | Original 60 tests plus 24 harness safety/workflow tests; no runtime execution |
| WSL Ubuntu Node 20.20.2, `node --test` selecting four `runtime-*.test.mjs` files | 24 passed, 0 failed/skipped, exit 0 | Linux guard/session/workflow tests and transport doubles only |
| `npm run architecture:test` | 104 passed, 0 failed/skipped, exit 0 | Existing architecture guardrails |
| `npm run architecture:check` | 10 module manifests validated, exit 0 | Dependency/license direction unchanged |
| `npm run declarations:test` | 189 passed, 1 Linux-only FIFO skip, 0 failed, exit 0 | ES1 unchanged |
| `npm test` | 4 workspace tests passed, exit 0 | Node 1, web 2, worker 1 |
| Git Bash `BASH_PATH`, `npm run infrastructure:test` | 7 passed, exit 0 | Existing Compose config/safety checks, no daemon mutation |
| `npm run build --if-present` | Existing web build passed, 29 modules, exit 0 | No container build |
| `actionlint 1.7.12 .github/workflows/es2-runtime.yml` | Exit 0, no diagnostics | Official release archive SHA-256 verified: `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`; tool kept in ignored scratch, no repository dependency |
| Python AST parsing of fixture and six generated probe programs | Passed; probes not executed | No Python package installation; optional PyYAML was unavailable, workflow validation used actionlint |
| Python standard-library mocks executing generated connectivity probes | 3 semantic cases passed, no network access | Connected/stalled negative and positive probes fail; actual connection denial alone prints `DENIED`. These are not runtime connectivity results |
| `npm audit --json` | Exit 1, 11 entries: 4 moderate, 6 high, 1 critical | Existing vulnerabilities remain unresolved; lockfile unchanged |
| Maven Java tests | Locally blocked: Maven not on PATH | No Java source changes; hosted CI is separate evidence |
| Diff whitespace / protected-path comparison | Passed | Driver libraries, ES1, contracts, legacy Compose, CI workflow, package/lock files unchanged |

Initial TDD runs failed for missing guard/session/workflow modules, then passed
after implementation. Focused regressions failed before fresh-name rejection,
real-daemon outage assertions and pinned Compose routing were added. One full
Windows run had 81 passes and one existing inventory `INVENTORY_WRITE` failure
before that test's injected-failure section. The isolated inventory rerun passed
8/8 and the unchanged full rerun passed 82/82. Its transient environmental cause
was not confirmed; no timeout, test or driver guarantee was weakened.

Independent review reproduced a false-positive negative connectivity probe and
an early-failure cleanup error. Added regressions first failed (11 passed,
2 failed in the targeted run); the fixes make any successful TCP connection fail
the negative probe and skip workload-based outage evidence when no plan exists,
while still performing verified sandbox cleanup. The final suite passed 84/84.

## Evidence still required

| Required runtime evidence | Actual status |
|---|---|
| Fresh authorized hosted Linux DinD target and actual Engine/Compose/kernel/cgroup/image versions | Not run; manual owner authorization pending |
| Two real projects, full resource ownership and actual cgroup limits | Not run |
| CPU throttling, PID exhaustion and OOM counters under bounded load | Not run |
| Same-project availability and cross-project/public-bridge data denials | Not run |
| Foreign/missing-BSK-label destroy rejection against actual Docker volumes | Not run |
| A stop/down preserving B and both distinct volume checksums | Not run |
| Actual daemon outage rejection and verified fixture cleanup | Not run |
| Positive secret-ref behavior | Unsupported by merged driver; acceptance gap remains |

No synthetic inspect response or rendering result is runtime proof. The workflow
will export redacted per-check results, commands and partial progress on failures;
the owner and reviewer must inspect those artifacts before recording a runtime
claim. Even all implemented probes passing does not close the secret-ref gap.
Existing npm/security findings, shared-kernel trust, advisory storage and legacy
deployment risks remain open. No ES3 work or production authorization is included.

## Independent review and hosted CI

Independent review of `5da56de..b760ab9` independently passed the then-current
22 harness tests and found the two issues documented above. The findings were
corrected with regressions; focused re-review and new-PR hosted checks are pending.
They must remain separate from the not-run runtime table above.
Opening a PR can run ordinary non-destructive CI only; it cannot opt into the
manual DinD job. Do not dispatch runtime as part of publishing or reviewing code.
