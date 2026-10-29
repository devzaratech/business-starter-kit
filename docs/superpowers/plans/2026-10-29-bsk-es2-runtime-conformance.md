# ES2 disposable runtime conformance implementation plan

**Goal:** Prepare real Docker acceptance checks for merged PR #9 (`5da56de`)
without executing runtime mutations until the project owner explicitly authorizes
a separate run. The assignment supplies the scope and preferred hosted DinD
approach. The master plan remains the sole long-term roadmap.

**Architecture:** A manual-only GitHub-hosted Ubuntu workflow creates one fresh
digest-pinned DinD container and a dedicated Unix-socket context. A Node harness
pins both bootstrap and inner engine identities, applies unchanged driver plans,
records bounded probes and deletes only verified run-owned fixtures. No default
context, existing daemon, deployment API, ES3 code or new npm dependency.

**Alternatives:** Reusing Docker Desktop or an existing remote daemon violates
the assignment. Direct use of the runner daemon weakens the target boundary.
Hosted DinD is the selected implementation; nested cgroup support remains a
runtime gate, never an assumed passing result.

## Task 1: Pure safety and evidence contracts

- [ ] Write/run failing tests for owner/manual-event/SHA/hosted-Linux authorization,
  context/engine pinning, full ownership before cleanup, bounded cgroup evidence,
  immutable images, unique two-project fixtures and fail/blocked aggregation.
- [ ] Implement `scripts/compose/runtime/{guard,fixtures,probes}.mjs`, the pinned
  image catalog, synthetic fixture Dockerfile/Python source and unit tests.
- [ ] Run non-destructive tests and commit the tested contract.

## Task 2: Bounded runtime orchestrator

- [ ] Write/run failing tests for command target enforcement, environment filtering,
  timeout/error recording and partial-failure cleanup protections.
- [ ] Implement `runtime/harness.mjs` and `runtime/run.mjs`: fresh DinD bootstrap,
  local-only registry for a digest-addressed synthetic image, actual driver
  inventory/plans, runtime inspection, cgroup/load probes, lateral/public denials,
  foreign/missing-BSK-label rejection, scoped stop/down/data preservation and
  verified cleanup. Test doubles prove orchestration only, not conformance.
- [ ] Every command is fixed argv, context/engine checked and timeout bounded;
  each result has passed/failed/blocked status. Failure never implies success.
- [ ] Run non-destructive tests and commit.

## Task 3: Opt-in workflow and reviewable handoff

- [ ] Write/run failing workflow contract tests, then add a `workflow_dispatch`-only
  workflow with exact owner confirmation/SHA, hosted runner guard, timeout,
  artifact upload and no PR/push/schedule trigger. Ordinary CI runs unit tests only.
- [ ] Document exact invocation, first-dispatch default-branch constraint, evidence,
  remaining secret/storage gaps, cleanup/rollback and authorization boundary.
- [ ] Run existing applicable suites; independent review; commit/push and open PR.
  Do not dispatch the runtime workflow. Record actual local/hosted results apart
  from not-run runtime checks. ES2 remains unproven pending reviewed evidence.

## Acceptance and review focus

The artifact must include commit/run/actor identity, exact commands and exit codes,
Engine/Compose/kernel/cgroup/image versions, generated config and inventory,
ownership/network/volume inspection, CPU throttling, PID exhaustion and OOM
counters, denied connectivity, B availability and both volume checksums after A
stop/down. Bound fork count, memory allocation, wall time and cleanup. Reject
foreign/unlabeled targets, daemon identity changes and hidden Docker environment
overrides. No automatic adoption or global prune. Preserve all historical security
findings. Secret refs remain unsupported in the merged driver and must be reported
as an acceptance gap, not implemented incidentally in this test-only PR.
