# ES2 expected-resource label drift

Prepared on base `4b43014646bd89d619d0ce6b1086b3d3a76262a5`.
[Authorized run 41546329044](https://github.com/devzaratech/business-starter-kit/actions/runs/41546329044)
passed all 11 implemented runtime checks, including verified daemon shutdown and
cleanup. Its `es2-runtime-41546329044-1` artifact still reports conformance
incomplete: positive secret refs and unchanged-cardinality label drift were gaps.
That evidence remains unchanged. This PR prepares coverage for the latter only;
**no new runtime run was dispatched and no runtime success is claimed**.

## Exact mechanism

After the existing two-project isolation, load and persistent-data lifecycle
checks, create a separate run/attempt-scoped installation with suffix `-drift`.
It has one bounded synthetic worker, no persistent volume, and the generated
internal data/ingress networks. The worker only joins data, leaving ingress empty.
Admit its limits against host reserves plus retained primary-project claims,
using a separate test-only local inventory and explicit budgets.

Apply its generated Compose topology with additional harness ownership tags.
Read actual resources through the unchanged DockerReader and require a passing
ownership/configuration baseline. Register actual IDs/full labels for cleanup.

Because labels cannot be edited in place, remove only the inspected, empty,
run-owned ingress network and recreate it under the **same expected name**,
internal bridge policy and Compose project label. Two cases set `dev.bsk.project`
to a synthetic wrong owner and omit it. Harness run/role tags remain present.
Replacement transiently removes one resource; every acceptance observation must
have exactly the original three expected resources and the identical name/kind
set, with distinct valid IDs. No primary-project network or data is changed.

For each case:

1. Actual DockerReader observations must fail `inspectLimits` with `OWNERSHIP`.
2. Repair only the selected label in an **in-memory copy** of those observations;
   validation must pass. This excludes count, duplicate ID, topology, limits or
   other-label errors as confounders. Repaired data never reaches Docker or the
   lifecycle evaluator.
3. Call real `planLifecycle` with exact destroy confirmation and a reader wrapper
   that rechecks cardinality and label-only repair on every fresh actual read.
   It must reject `OWNERSHIP` and emit no destructive intent. DockerReader
   normalizes objects; the ownership evaluator is the rejecting layer.
4. Inspect the exact replacement ID again to prove rejection did not remove it.

## Cleanup and evidence

Cleanup is the existing guarded auxiliary-resource path: exact recorded IDs and
full actual ownership labels, never label adoption or generic deletion of a
foreign resource. The wrong/missing BSK labels are deliberate faults on fixtures
created by this run, with independent run/role ownership retained. Networks are
registered before their container so reverse cleanup removes attached containers
first; the replaced ingress network is unattached. Unknown partial creation or
replacement leaves a pending flag that fails cleanup and prevents outer sandbox
disposal instead of guessing ownership. No force, prune, new context fallback,
production access or workflow authorization change is introduced.

`label-drift-plan.json` records the expected model;
`expected-label-drift.json` and the named check in `results.json` record both
cases, counts, changed key, repair proof, lifecycle rejection and retained object.
No secrets or raw daemon errors are added. The new check is required; failure or
missing execution remains failed/blocked. Only when **all implemented runtime
checks, including final cleanup, pass** does the run remove the label-drift gap
from its result. Positive secret-reference acceptance remains unimplemented and
keeps ES2 conformance incomplete. Historical artifacts are never rewritten.

## Local verification and review boundary

Focused Node tests exercise wrong/missing labels, confounding count/name/ID/other
label errors, the isolated replacement sequence and retained cleanup ownership.
They first failed for the missing module, then passed after implementation.
These are mocks, not runtime evidence. Existing reader/lifecycle tests and
architecture guardrails are run without Docker daemon access; the real Compose
client render test is excluded locally to honor the no-local-Docker boundary.
Actual local results: 112 ES2 tests passed (all test files except the Docker
client render test), 104 architecture tests passed and 10 manifests validated.
The nine new tests include partial-creation failure and suppression of outer
disposal. Independent focused security review found no blocking issue and
independently passed the then-current seven label-drift tests. No dependencies,
ownership evaluator changes or local Docker access were needed.
An owner must authorize a future
disposable workflow on the reviewed commit before runtime acceptance is recorded.

Rollback removes only this additive test/check and retains the existing gap
until runtime proof. ES1, ownership evaluators, legacy deployment, secret handling,
frontend and ES3 are unchanged. See [ADR 0007](../architecture/decisions/0007-compose-isolation-and-governance.md)
and the [ES2 matrix](../architecture/es0/engineering-slices.md).
