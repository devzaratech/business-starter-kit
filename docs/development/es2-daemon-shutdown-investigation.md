# ES2 daemon shutdown verification investigation

Date: 2026-11-01. Reviewed base: `3a314eb78e31be99920a734850335e2ee4e50c51`.
Branch: `fix/bsk-es2-daemon-shutdown-probe`. No runtime workflow was dispatched
and no local Docker daemon was accessed during this investigation.

## Historical evidence, preserved as failed

[Owner-authorized run 40836112237](https://github.com/devzaratech/business-starter-kit/actions/runs/40836112237)
passed its 84 preliminary tests and the first ten runtime checks. Artifact
`12880871459` and the full job log were downloaded read-only using:

```bash
gh run view 40836112237 --repo devzaratech/business-starter-kit --log
gh run download 40836112237 --repo devzaratech/business-starter-kit --dir .cache/es2-shutdown-evidence
```

The [redacted historical summary](evidence/es2-runtime-40836112237.json) retains
all check statuses, tool versions, both projects' before/after checksums, the
exact final three commands and their exit/output hashes, and source-file hashes.
The original artifact is unchanged. Its uploaded ZIP SHA-256 recorded in the log
is `fc3104c8a8454b06061a70ee0404d16e683ef2d76b22a32afd516021f9dade91`.

Observed Engine: 28.5.2; Compose: 2.40.3; Linux: 7.0.0-1017-azure; cgroup: v2;
Python: 3.13.18. Real CPU throttling increased from 47 to 90 events, PID denial
from 0 to 1, and OOM kills from 0 to 1 with exit 137. Both distinct volume
checksums matched after A stop/down/recreation; B remained available. Network
denials and scoped-extra-resource ownership rejection passed. These are real
positive results, not mocks. They do not override the final `verified-cleanup`
failure (`DAEMON_NEGATIVE`), and **historical conformance remains failed**.

## Call sequence and limits of the diagnosis

Cleanup removed inner fixtures, verified outer ownership, and called
`DockerSession.outer(container stop --time 5 ID)`, which first pins the outer
engine. Stop exited 0. It then called `DockerReader.resources(plan)`, whose
`authorize` inspected the context successfully and ran formatted inner `info`
successfully. No subsequent resource-list or outer-removal command was recorded.

The confirmed design defect is reliance on the reader's generic `DOCKER_READ`
code as the only acceptable shutdown evidence. The reader parses zero-exit JSON
and checks `ID` and `OSType`: missing or mismatching fields produce
`CONTEXT_MISMATCH`, which cleanup masks with `DAEMON_NEGATIVE`. A synthetic
zero-exit error-shaped response reproduces that exact branch. Under the valid
stored plan, the recorded command boundary localizes the rejection to this
authorization phase; it does not establish that the original daemon was alive.

**The response bytes and intermediate exception were not retained.** The artifact
contains only an output hash. It cannot establish whether the fields were absent,
an unexpected identity was present, or why the response had that shape. Neither
asynchronous shutdown nor an actual replacement daemon can be asserted as the
historical root cause. No mismatch is redefined as shutdown proof. Docker CLI
[info source](https://github.com/docker/cli/blob/v28.5.2/cli/command/system/info.go)
also distinguishes formatting, server errors and connection failures; CLI exit
status alone is insufficient evidence of an authenticated live server.

## Targeted fix

The existing authorized stop remains unchanged. A separate **read-only** verifier
then requires ownership-verified outer inspect to show `Running: false`,
`Restarting: false`, `Status: exited`, and rechecks the exact context endpoint
against the original authorization/session identity on every attempt.

It reads HTTP `/info` directly over that exact Unix socket, without Docker CLI
formatting, environment routing, TCP or context fallback. Each request has a
one-second total timeout and a 1 MiB response bound. There are at most three
attempts with 250 ms gaps. Only `ENOENT` or `ECONNREFUSED`, after those guards,
prove unavailability. A reachable original ID is recorded and retried, then
fails `DAEMON_REACHABLE` if persistent. Changed IDs/context, invalid responses,
permissions, timeout and ownership failures fail immediately. HTTP success is
never proof of shutdown.

`cleanup.json` is saved in `finally`, including each attempt's stopped-state and
endpoint-match booleans and actual redacted intermediate code. Raw messages,
response bodies and secrets are withheld. Successful cleanup records the actual
transport errno instead of inventing a legacy `DOCKER_READ`. Outer container and
volume deletion still require their original strict ownership/engine checks;
verification failure prevents deletion. No force removal, prune or new workflow
authorization is introduced.

## Verification and outstanding limits

TDD began with a missing-module failure. Eleven focused shutdown cases then
passed, including reproduction of the legacy semantic-mismatch branch, bounded
reachability, refusal/missing socket and fail-closed negative cases. Existing
cleanup tests were adapted to await async verification and still require refusal
of reachable daemons and preservation of ownership gates. `npm run compose:test`
passed 104/104 after independent-review coverage additions; architecture 104/104;
ES1 189 passed and one platform skip; 10 manifests validated. Workspace tests
passed 4/4, infrastructure tests 7/7, and the web build passed (29 modules).
Independent review found no blocking defect and requested additional direct
mocked HTTP transport coverage, finally-persistence and later-retry drift checks;
all were added. HTTP tests cover exact Unix GET, refused/missing socket, timeout,
non-200, malformed/oversized bodies and reset responses. None of these mocked checks proves the new
shutdown path on Docker: a separately authorized run on the reviewed commit is
still required. Do not rerun the mutating workflow as part of this fix.

Secret-ref support, runtime expected-resource label-drift coverage, advisory
storage, existing npm vulnerabilities and legacy deployment risks remain open.
ES1, driver declaration contracts, legacy deployment files and ES3 are unchanged.
Rollback reverts this harness-only verifier; it never changes persistent data or
retroactively marks the historical run successful.
