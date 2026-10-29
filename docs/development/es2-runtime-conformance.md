# ES2 disposable runtime conformance harness

Status: **prepared, not executed; ES2 runtime conformance remains unproven**.
PR #9 is merged as `5da56dea6b650ecd866224a393008a172e5dcb8d`. This follow-up
adds tests and an opt-in harness around that driver; it does not add a deployment
API or change ES1, legacy Compose, gateways/TLS, production or cloud resources.
See [historical driver evidence](es2-verification.md), [ADR 0007](../architecture/decisions/0007-compose-isolation-and-governance.md)
and the [acceptance matrix](../architecture/es0/engineering-slices.md).

## Authorization and target boundary

`.github/workflows/es2-runtime.yml` has only `workflow_dispatch`. Pull requests,
pushes, schedules, reusable workflows and ordinary CI cannot invoke its runtime
entrypoint. The job and Node guard require the repository owner `devzaratech`,
including the actor performing a rerun, exact confirmation
`AUTHORIZE_DISPOSABLE_ES2`, the reviewed full commit SHA, the expected repository,
a GitHub-hosted Linux runner and a unique run/attempt identity. Do not export fake
GitHub environment variables locally to bypass the guard. These are operator
mistake guards within a trusted runner, not protection against malicious root.

The only bootstrap target is the ephemeral hosted runner's explicit
`--host unix:///var/run/docker.sock`. It creates a fresh digest-pinned DinD
container with a separate labeled data volume and a private temporary socket
directory. No runner Docker socket is mounted inside DinD or a workload. No
default/Desktop context is selected or aliased. The inner daemon uses only a
dedicated Unix listener; no Docker TCP listener is requested or published.
After verifying the sandbox's recorded ID/labels, the harness assigns its socket
to the runner UID/GID. Socket access remains inside a mode-0700 directory.

Bootstrap and inner engine IDs are pinned independently. Before each inner
operation, the exact context endpoint, engine ID, Linux type and run label must
match. A fresh inner daemon must contain no containers/volumes or custom
networks. Existing sandbox names are rejected. Ambient Docker/Compose/build,
proxy and credential environment variables are not forwarded to Docker.
The Docker client uses a fresh configuration directory with no registry login.

DinD requires privilege and shares the disposable runner kernel. The bounded
sandbox has 2 CPUs, 2 GiB memory and 512 PIDs; workload probes have stricter
limits. This is unsuitable for hostile workloads, self-hosted runners or an
existing daemon. No production access is authorized by this document.

## Prepared first matrix and synthetic image

The first target is GitHub-hosted `ubuntu-24.04`, `linux/amd64`, cgroup v2,
overlay2 and the pinned Docker `28.5.2-dind` index in
`scripts/compose/runtime/images.json`. Both the inner Engine and Compose binary
come from that immutable DinD image. Other cgroup modes are blocked. The hosted
kernel and bootstrap Docker client can change; actual versions must accompany
each run, not be inferred from the runner label. This is one target, not a
portability matrix.

Python and registry OCI indexes are also digest-pinned. The harness builds the
small standard-library Python HTTP/data fixture with no dependency installation,
pushes it to a run-owned registry on **DinD loopback only**, and supplies its
actual `repository@sha256:...` digest to the unchanged driver. Generated Compose
files are applied without topology/resource overrides. The loopback HTTP
registry is test plumbing, not an ES3 ingress or TLS implementation. Its storage
has explicit run ownership. Fixture markers contain fresh synthetic UUIDs so
accidental cross-volume reuse cannot pass with identical checksums.

## Exact owner invocation after separate approval

**Do not execute these commands until the project owner explicitly authorizes
the runtime run for the reviewed commit.** Preparing or opening this PR does not
grant that authorization.

GitHub requires a manual workflow to exist on the default branch before its
first dispatch. If this new workflow is not registered on `main`, runtime
execution is blocked until the owner reviews and merges the harness PR through
the normal process. Do not add a temporary push/PR trigger or modify `main` to
work around that requirement. Merging harness code does not establish ES2
conformance.

After that review and explicit run approval, select an existing reviewed ref and
its exact SHA (the following shell variables are filled by the owner):

```bash
REVIEWED_REF=main
REVIEWED_SHA='REPLACE_WITH_REVIEWED_40_CHARACTER_SHA'
gh workflow run es2-runtime.yml --repo devzaratech/business-starter-kit \
  --ref "$REVIEWED_REF" \
  -f confirm=AUTHORIZE_DISPOSABLE_ES2 \
  -f expected_sha="$REVIEWED_SHA"
gh run list --repo devzaratech/business-starter-kit --workflow es2-runtime.yml
RUN_ID='REPLACE_WITH_RUN_ID'
RUN_ATTEMPT=1
gh run watch "$RUN_ID" --repo devzaratech/business-starter-kit --exit-status
gh run download "$RUN_ID" --repo devzaratech/business-starter-kit \
  --name "es2-runtime-$RUN_ID-$RUN_ATTEMPT" --dir "evidence/es2-$RUN_ID-$RUN_ATTEMPT"
```

The workflow has a 20-minute deadline. Individual Docker commands have 15-second
timeouts, with explicit bounded exceptions up to 180 seconds for pulls/builds.
Readiness attempts are bounded. No successful runtime result exists at the time
this harness is prepared. Owner-only reruns require fresh explicit confirmation
already bound to the workflow event and create a new attempt namespace.

## Checks and expected evidence

| Check | Positive and negative evidence required |
|---|---|
| Bootstrap/versions | Distinct actual bootstrap/inner IDs; run label; Engine, pinned Compose, kernel, cgroup mode/driver, Python and actual image IDs/digests; source/run/actor identity |
| Plans and inventory | Two independent projects with different environment names; driver-generated configs and separate full-tuple claims; host headroom; capacity/rollout overlap/raw privilege/storage enforce rejected without changing the live ledger |
| Ownership and topology | Actual container/network/volume labels and names; ingress/data bridge separation; no published data ports or unmanaged mounts; exact inspect CPU/memory/PID values |
| Cgroups/load | `cpu.max`, `memory.max`, `pids.max`, CPU/memory/PID event counters for each workload; bounded 4-second CPU load increases throttling and usage; at most 64 attempted forks hit PID denial; at most 96 MiB allocation in a 64 MiB cgroup exits 137 and increases OOM kills |
| Connectivity | Positive same-project HTTP/data probes first; A cannot connect to B's known-live data IP:8080; a run-owned default-bridge probe outside both private networks cannot connect either. Any successful TCP connection fails a negative probe immediately; an HTTP stall cannot count as denial |
| Ownership rejection | Actual extra volumes in A's Compose scope, one with foreign BSK ownership and one missing BSK labels, cause `OWNERSHIP` before a destroy intent; both still exist afterward. They retain separate harness-run labels for safe cleanup |
| Lifecycle/data | Guarded stop and down intentions for A are executed by the test-only harness; no volume actions; B's HTTP and data endpoints remain available; A recreated from the same model sees the same marker; both distinct volume checksums and inventory are unchanged |
| Daemon failure/cleanup | After fixture cleanup, the verified DinD container is stopped; the actual driver reader must reject the unavailable daemon with `DOCKER_READ`. Outer sandbox/data removal then checks recorded IDs and labels again |

Evidence artifacts are retained for seven days. `commands.json` records exact
argv, exit codes, transport errors and output hashes; raw transport stderr and
full Docker info/environment output are withheld. Selected observations and
probe counters/results are stored in `results.json`, `observations.json`,
`versions.json`, `images.json`, checksums, lifecycle intentions, generated configs
and inventory. `checks-progress.json` and command snapshots preserve partial
progress. No customer data, registry credentials, secret values or Docker client
credentials are uploaded. Do not attach private sockets/client config directories.

Every result is passed, failed or blocked. Missing prerequisite checks are
blocked, never skipped as pass. A zero job exit means implemented runtime checks
passed; inspect `remainingAcceptanceGaps` and `conformance` before interpreting
that result. A reviewer must compare all artifacts with the acceptance matrix.

## Cleanup, limitations and rollback

Every removal inspects the actual resource, verifies the recorded immutable ID
(or named volume identity) and full expected ownership labels, then rechecks the
daemon target. Containers are stopped with a bounded grace period and removed
before their networks/volumes. Cleanup uses no force removal, Compose down,
global prune, wildcard resource deletion or image deletion. Test-only data
destruction is confined to verified run fixtures. It does not release production
inventory claims or change the driver's intent-only lifecycle API.

If ownership/inspection fails, cleanup records failure and refuses to bypass it
or dispose of the outer sandbox. The GitHub-hosted VM is then discarded by the
platform. Cancellation, process death or the job deadline can prevent the final
cleanup/evidence snapshot; incomplete artifacts are not conformance. Do not
manually reuse such a daemon or run global cleanup to compensate.

Remaining acceptance gaps include positive **secret refs**, which the merged
driver rejects because no backend exists, advisory storage budgets, actual
runtime execution/review and any failed/blocked probes. This harness does not
implement a secret backend, hard volume quotas, backup/restore, hostile-tenant
security, distributed inventory, production migrations, ES3 or ES4. A default
bridge probe demonstrates network isolation from ordinary containers; host
root/daemon access remains trusted and can route into private bridges.
Existing npm advisories and legacy deployment risks remain unresolved.

Rollback removes this workflow, fixture and test harness. It makes no changes to
existing deployments, legacy configs or driver contracts. Preserve/download run
artifacts before their retention expires. ES2 must not be marked complete until
its required runtime criteria, including remaining gaps, are demonstrated and
reviewed.

References: [GitHub manual-workflow requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/),
[dockerd configuration](https://docs.docker.com/reference/cli/dockerd/) and the
[official DinD entrypoint](https://github.com/docker-library/docker/blob/master/dockerd-entrypoint.sh).
