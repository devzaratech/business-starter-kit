# PR2a / ES2 verification evidence

Date: 2026-10-29. Base: `c9ba057` (merged PR #8 / ES1). Assigned feature branch:
`feat/bsk-es2-compose-isolation`; clean at start. This is non-destructive driver
evidence, **not ES2 runtime conformance**. See [usage and limitations](compose-isolation.md)
and the [bounded implementation plan](../superpowers/plans/2026-10-29-bsk-es2-compose-isolation.md).

## Actual local results

Windows: Node `v24.22.1`, npm `11.19.1`, Compose client `v5.5.1`.
Ubuntu/WSL uses the existing isolated Node `v20.20.2` test executable in ignored
scratch space; it is not a new repository dependency or a Docker environment.

| Command/check | Actual result | Limits |
|---|---|---|
| `npm run compose:test` | Exit 0; 60 passed, 0 failed/skipped | Includes schema/topology/admission, real-process races, disk failure, guard/observation/lifecycle doubles, CLI and real Compose config parsing |
| Linux Node 20 `--test` with plan/inventory/lifecycle/docker/cli test files | Exit 0; 59 passed, 0 failed/skipped | Exercises POSIX fsync/rename/locking and process races. The single Compose client render test was not selected in this Linux run; it passed using the Windows client above |
| `npm run declarations:test` | Exit 0; 189 passed, 1 Linux-only FIFO skip, 0 failed | ES1 tests and contract unchanged |
| `npm run architecture:test` | Exit 0; 104 passed, 0 failed/skipped | Existing dependency/schema guardrails unchanged |
| `npm run architecture:check` | Exit 0; 10 module manifests validated | No existing metadata changes |
| `npm test` | Exit 0; 4 workspace tests passed | Node 1, web 2, worker 1; no business/runtime additions |
| `BASH_PATH` set to Git Bash, `npm run infrastructure:test` | Exit 0; 7 passed | Existing ten Compose configurations render and Studio safeguards pass; no daemon mutation |
| `npm run build --if-present` | Exit 0; existing Vite web build passed, 29 modules | No images built or pulled |
| `mvn --batch-mode test -f apps/api-spring/pom.xml` | Blocked: Maven not installed/on PATH, exit 1 | No local Java test success claim |
| `npm audit --json` | Exit 1; 11 entries: 4 moderate, 6 high, 1 critical | Unchanged dependency/security debt; no automatic fixes or lockfile changes |

TDD runs first failed because the new plan, inventory, lifecycle/reader modules
or CLI did not yet exist, then passed after implementation. An additional context
guard regression failed for `/run/docker.sock`/path traversal before the guard was
fixed. Initial strict Ajv compilation exposed a conditional `strictRequired`
definition error; the schema was corrected without disabling strict mode. The
first client-render assertion assumed numeric memory output; Compose returned an
equivalent decimal string, so the new assertion now compares its byte value.
These initial failures are not represented as passing runs.

Independent review reproduced an integer CPU comparison error at 1,001 millis
and an inspection-order-dependent lifecycle ID. Both new regressions failed
(20 passed, 2 failed in the targeted run) before correction, then passed in the
final Windows/Linux runs above. An intermediate Windows run had 59 passed and
1 CLI child-process `ETIMEDOUT`; the unchanged rerun passed all 60. The timeout
was not reproduced, and its environmental cause remains unconfirmed.

## Ownership, concurrency and failure evidence

- Two synthetic projects produce distinct scope/network/volume names, complete
  ownership labels, separate internal ingress/data bridges and no published data
  ports. Unknown raw Compose/privilege/mount/network fields fail closed.
- Effective limits and replica arithmetic reserve host/project/environment budgets;
  reserves, existing claims, unsupported/unknown enforcement and integer overflow
  are tested. Requested/admitted values are separate from unknown enforcement.
- Two real child processes race on one real temporary registry; only one commits.
  Stale revisions, conflicting identities, existing locks and forged/corrupt state
  fail closed. An injected pre-rename disk failure preserves the existing bytes.
  Failed Project A admission leaves Project B's record unchanged.
- Lifecycle tests reject foreign/unlabeled/missing/extra resources, duplicate IDs,
  foreign mounts/networks, host networking, public ports and observed privileges.
  Stop/down emit no volume actions and never change registry/data. An actual
  registry commit during inspection invalidates the returned intention.
- Docker-reader doubles use actual inspect response shapes and pin context,
  endpoint and Linux engine identity. Their synthetic Engine/kernel/cgroup/version
  strings are **not real runtime evidence**. Docker reads are bounded and use
  fixed argument arrays with no shell; no mutation/execution method exists.

## Blocked runtime conformance

Read-only `docker context ls` found `default` and `desktop-linux` only. Neither
is an explicitly authorized disposable environment. No alias/context was created,
no daemon/container was inspected, and no user images, networks, volumes or data
were modified. Runtime integration was not run on either context.

The following remain **blocked/unverified**, not passed or silently skipped:

1. Actual Docker Engine, kernel and cgroup versions/capabilities of an authorized
   disposable host (only the local Compose client version is known).
2. Running two projects, database/public/lateral connectivity denials and actual
   CPU/memory/PID cgroup limits under controlled load/OOM conditions.
3. Actual Project A stop/down preserving Project B availability and both projects'
   volume checksums, plus safe Docker ownership rejection against real objects.
4. Runtime fixture image availability, immutable image trust, secrets integration,
   backup/restore and recovery after actual daemon interruption.

No executable teardown or deployment harness was added to disguise these gaps.
The permitted fallback is complete non-destructive implementation with blocked
runtime checks. A separately authorized disposable daemon/context and explicit
runtime evidence are required before claiming ES2 conformance. ES3 is not begun.

## Review, security and compatibility

Independent review of `c9ba057..d50ef65` checked full-tuple ownership, atomic
claims, failure isolation, context pinning, resource/status claims and accidental
destructive behavior, and independently passed the then-current 58 tests. The
CPU comparison and lifecycle ordering findings were corrected with regressions.
No further blocking issue was found within the documented trust boundary.
Observation verifies CPU/memory/PID configuration and the explicit ownership/
network/mount/privilege gates; it does not verify all generated hardening settings
or kernel enforcement. The local store assumes a trusted operator and private local filesystem;
root/daemon compromise, multiple independent registries, network filesystems and
distributed writers are outside its guarantee. Retained claims are not released
by printed lifecycle intentions; manual state deletion is unsafe capacity recovery.

ES1 schemas/validator/planner/CLI and all legacy Compose, runtime/env/deploy files
are unchanged. The separate wrapper adds stricter driver limits without changing
ES1 acceptance. AGENTS only updates the merged ES0/ES1 milestones. Existing npm
advisories and legacy deployment findings remain unresolved. There are no new
dependencies, business modules, gateways/TLS, tailnet/cloud actions or migrations.

Rollback removes this opt-in code/test wiring only. Preserve any registry, claims
and volumes until separately verified. No live resource adoption or deletion is
part of rollback. Hosted CI results, when available, must identify the tested
revision and remain distinct from the blocked runtime checks above.
