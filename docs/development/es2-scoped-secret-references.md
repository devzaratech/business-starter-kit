# ES2 scoped synthetic SecretRefs

Base: `b9b0815893d425f9e55edfd92f659eca4cd6a74a`. This is a disposable-fixture
provider, **not a vault, production secret store or authenticated Control Plane**.
No runtime workflow has been dispatched for this change. ES2 conformance remains
unverified until separately owner-authorized evidence is reviewed, including the
merged label-drift check. Historical run `41546329044` predates both changes.

## Explicit boundary

ES1 Service `spec.secretRefs` remains an array of opaque slugs. ES1 is unchanged.
The closed ES2 Compose request optionally adds:

```json
{
  "secretProvider": {
    "kind": "disposable-synthetic",
    "bindings": [{
      "installationRef": "fixture-install",
      "projectRef": "fixture-a",
      "environmentRef": "review-alpha",
      "serviceRef": "http",
      "ref": "alpha-token"
    }]
  }
}
```

This fragment belongs inside the existing Compose request envelope. Every
consumed HTTP Service reference must have exactly one matching complete tuple;
unknown, unused, foreign, duplicate, malformed or missing bindings deny planning.
The catalog holds at most 16 bindings and accepts no values, file paths, raw env,
external provider configuration or secret commands. Nonempty refs **without**
this explicit opt-in still fail `SECRETS_UNSUPPORTED`. Existing no-secret plans
and inventory hashes retain their previous shape. This additive v0alpha1 driver
extension does not expand ES1 or accept new workload mount fields.

Offline catalog validation is not authentication or proof of project membership.
The only resolver creates new random synthetic values within the existing
owner-authorized disposable harness, never looks up existing credentials, and
cannot be used as a production retrieval API. Future real providers need the
shared authenticated worker/project-policy boundary from the canonical contracts.

## Plan, resolution and mounts

The planner emits sorted opaque refs and Compose secret descriptors with derived
scope/service/ref names. File sources are generated under
`/run/bsk-fixture-secrets/<scope>/<reference-hash>` on the **DinD host**, never a
caller-selected path. Approved destinations are exactly `/run/secrets/<ref>`.
Values are absent from declaration, plan and persisted inventory records.

After admission denials are exercised, before any deployment, the authorized
harness verifies its owned outer container and pinned engine. It exclusively
creates private root-owned directories (0700) and random 32-byte base64 files
(0400, noclobber). Value generation occurs inside DinD via `/dev/urandom`; no
value is returned to the runner, embedded in argv, or saved into artifacts.
Only the HTTP workload receives its granted refs; data/worker helpers receive none.

Compose file secrets are bind mounts on this Linux target. DockerReader permits
them only with a trusted resolver callback, exact source and destination, bind
type, and `RW: false`. The callback requires registration by this provider and
fresh checks of regular file, no symlink, root UID, 0400 mode, single link and
private root-owned parent directories. Lifecycle inspection independently
requires the exact approved secret mount set; extra, absent, writable or foreign
mounts reject. No general bind-mount allowance, socket, host-network or arbitrary
host-path support is added. Default readers without the callback reject secret
binds. Host root/daemon/operator remain trusted; this is not hostile-root security.

## Required runtime evidence

The new required `scoped-secret-references` check runs after real deployment.
Both projects get independent scope-bound sources. It asserts the intended HTTP
container can decode its own 32-byte synthetic value, cannot see the other
project's target/source paths, and does not expose its own value in its HTTP
response. Unassigned data containers cannot see either target or the host source.
Actual reader/lifecycle mount validation proves only granted bindings are mounted.
Existing network isolation, volume checksums, label drift, limits and shutdown
checks remain intact.

Before deployment, existing admission evidence now includes missing, foreign,
ambiguous, unauthorized-provider and malformed-ref denials. The required runtime
check compares value-free serialized plans/inventory/commands/checks against the
values **inside DinD**, and checks all fixture container logs there without
exporting their contents. This audit repeats before cleanup while logs still
exist. Only generic outcomes leave the sandbox; manifest stdin is not recorded
in command evidence. The manifest is bounded to 1 MiB. The audit is a targeted
full-value leak check, not a general DLP system or proof against malicious root;
final result records contain static statuses/codes and opaque metadata only.

Cleanup first removes verified containers, then verifies and removes only the
registered synthetic files and empty private directories, then performs the
existing verified daemon shutdown and sandbox disposal. Failed or partial
generation, failed audit, changed source ownership or unexpected files prevent
outer disposal; no force/prune/adoption is attempted. Private material remains
inside the ephemeral hosted VM on failure. There is no secure-erasure, rotation,
backup, recovery or production durability promise.

Only after **all implemented runtime checks and final cleanup pass** can results
remove the synthetic SecretRef and label-drift gaps. Preparing this code or passing
unit tests removes neither runtime acceptance requirement. No secrets provider
other than disposable synthetic generation is implemented.

## Actual non-destructive validation

TDD started with missing-module failures; the exclusive-creation regression then
failed before noclobber was added. Current local results: 124 ES2 tests passed
(all files except the real Docker client render test), 104 architecture tests
passed, and 10 module manifests validated. Twelve new tests cover positive and
default-negative planning, invalid catalogs, exact RO mounts, provider authority,
source registration, bounded audit/error behavior, stdin redaction and actual
DockerReader normalization with mocked inspect responses. These are not runtime
proof. No local Docker or production access occurred.

Independent focused review found no blocker, requested explicit noclobber and
noted the initial audit timing limit; both were addressed. No new dependencies,
frontend, legacy deployment, ES3, cloud credentials or real secret values are
introduced. Existing dependency advisories remain unresolved. Rollback removes
the opt-in fixture support; do not silently downgrade persisted secret-bearing
plans. Such plans must remain offline/rejected until a reviewed provider exists.
