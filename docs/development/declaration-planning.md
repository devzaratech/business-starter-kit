# Offline declaration validation and planning (ES1)

BSK can validate Project, Environment and HTTP Service declarations and produce
a deterministic declaration plan. This additive path uses the existing Node.js
>=20 and locked Ajv dependency. Install from the repository root with
`npm ci --ignore-scripts`; no daemon, database, cloud account or credentials are
needed. The existing legacy environment helpers and deploy commands are unchanged.

## Usage

The CLI accepts exactly two commands and one explicit local UTF-8 JSON file:

```bash
node scripts/declarations/cli.mjs validate scripts/declarations/test/fixtures/two-projects.json
node scripts/declarations/cli.mjs plan scripts/declarations/test/fixtures/two-projects.json
npm run declarations:test
```

An absolute CLI path and explicit input path also work from another directory.
There is no apply, down, destroy, stdin, URL, UNC-share or output-file mode.
Unknown commands/flags are errors; the CLI never sources `.env` or uses environment
variables to select a project, environment, runtime or policy. It reads only the
explicit input and the bundled schema/dependencies needed at module startup.
The validator and planner perform no filesystem access during evaluation and
invoke no subprocess, network, secret lookup or provider API.

| Exit code | Meaning | Output |
|---|---|---|
| 0 | Valid declarations / successful offline plan | One JSON result on stdout, empty stderr |
| 1 | Shape, scope, ownership or resource validation failed | JSON diagnostics on stdout; plan has `planId: null` and no actions |
| 2 | Usage, read, invalid UTF-8/JSON, or byte-size error | Empty stdout; redacted JSON `{code, message}` on stderr |

Messages do not echo input values, file contents or filesystem paths. Diagnostic
`path` values are JSON pointers into the bundle. Stable codes are `SCHEMA`,
`BUNDLE_LIMIT`, `DUPLICATE_RESOURCE`, `UNRESOLVED_REFERENCE`, `DUPLICATE_ROUTE`,
`HOSTNAME_OWNERSHIP`, `RESOURCE_BOUNDS` and `RESOURCE_OVERFLOW`. Shape diagnostics
intentionally avoid Ajv's value-bearing details. Operational stderr codes are
`USAGE`, `READ`, `JSON` and `SIZE`.

## Bundle and identity

The executable source of shape validation is
[bsk-declaration-v0alpha1.schema.json](../../contracts/schemas/bsk-declaration-v0alpha1.schema.json).
Its draft-2020-12 contract follows the
[ES0 declaration subset](../architecture/es0/canonical-contracts.md).
All objects are closed: unknown fields, status/UID/generation input, wrong types,
unsupported versions and undeclared kinds are rejected without coercion/defaults.

A bundle is `{apiVersion: "bsk/v0alpha1", resources: [...], catalog: {...}}`.
Each resource has `apiVersion`, `kind`, `metadata` and `spec`. The
[two-project fixture](../../scripts/declarations/test/fixtures/two-projects.json)
is a complete runnable example with independent routes and repeated service/env
names across projects. The
[invalid fixture](../../scripts/declarations/test/fixtures/invalid-cross-project.json)
demonstrates an unresolved project reference and exits 1.

- Project metadata: `installationRef`, `name`; spec: `ownerRef`, optional `budgetRef`.
- Environment metadata adds `projectRef`; spec: `policyRef`, optional `quotaRef`
  and `placementRef`. Names such as `review-142`, `sandbox` and `perf-lab` are
  ordinary slugs, with no fixed tier list or fallback to `local`/`prod`.
- Service metadata adds `projectRef`; spec: `runtimeRef`, integer `port` 1–65535,
  optional `secretRefs` and `resources`. Service is project-scoped, reusable across
  that project's declared environments; it is not a running deployment.

All slugs are 1–63 lowercase ASCII letters/digits with interior hyphens only.
Project identity is installation/name; Environment and Service identity is
installation/project/name. Identical names in different scopes are independent.
References resolve against the full tuple; a service or route cannot borrow a
resource from another project/installation. No names are trimmed or normalized.

The explicit catalog contains unique slug arrays `policies` and `runtimes`, and
`routes` (possibly empty). Policy/runtime references must exist there. Each route
contains `installationRef`, `projectRef`, `environmentRef`, `serviceRef`,
`hostname`, `pathPrefix`, `visibility` (`public`/`private`) and boolean `stripPrefix`.
Its project/environment/service must exist in scope. These are offline claims,
not gateway configuration or proof of domain ownership.

Hostname policy requires lowercase ASCII DNS labels, a dot, <=253 characters,
and no IP literal, wildcard, URL, userinfo, port or trailing dot. Path prefixes
are `/` or slash-delimited ASCII letters/digits/underscore/hyphen segments,
without encodings, dot segments, regex, query, repeated/trailing slashes or fragment.
A hostname belongs to one project/environment per installation. That owner may
claim distinct nested paths; identical hostname/path claims fail even if their
visibility differs. Prefix stripping is explicit; matching/forwarding is not
implemented in ES1.

An optional Service `resources` object must supply all seven positive safe
integer fields: `cpuRequestMillis`, `cpuLimitMillis`, `memoryRequestBytes`,
`memoryLimitBytes`, `storageBudgetBytes`, `pidsLimit`, `replicas`. Requests cannot
exceed limits. Replicated values and installation-wide aggregate declared values
must fit `Number.MAX_SAFE_INTEGER`; arithmetic uses exact integers for this check.
This detects malformed/overflowing declarations, not host capacity or quotas.

The CLI checks a maximum of 1 MiB of file bytes before parsing, including a
bounded read if the file grows. Bundles allow at most 1,000 resources and route
claims combined; policy/runtime/secret-reference arrays also have schema bounds.
These input limits are not a maximum environment tier count.

## Deterministic plan

`validateBundle(value)` returns `{valid, diagnostics}`;
`planBundle(value)` returns `{apiVersion, mode: "dry-run", planId, actions, diagnostics}`.
The functions in `scripts/declarations/lib/` do not mutate input objects. A valid
plan contains one `declare` action per resource, with a tuple `resourceKey`, a
copied `spec` and `runtimeChecks: "not-evaluated"`. The tuple is
`[installationRef, kind, projectRef-or-null, null, name]`; the fourth slot is the
unused environment scope for these resource kinds. Routes are catalog claims
included in validation and plan identity, not separate executable route actions.

Resource tuples sort by ordinal ASCII field comparison; object keys sort
recursively by ordinal order. Catalog policy/runtime sets and Service secret-ref
sets sort lexically. Routes sort by installation/hostname/path identity. Arrays
without set semantics preserve their order. The 64-character lowercase `planId`
is SHA-256 over UTF-8 compact canonical JSON of the complete validated bundle,
including version and catalog. No clock, random identity, machine path or implicit
environment enters it. Reordering resources, sets and object keys produces the
same serialized plan; changing a spec, scope or catalog changes the ID.

## Limits and compatibility

ES1 is offline structural validation. Owner membership, policy contents,
budget/quota/placement targets, secret existence/access, DNS ownership, certificates,
runtime availability, capacity, authorization and all applied/observed state are
**not evaluated**. Optional budget/quota/placement/secret references are validated
as identifiers only because their resource catalogs are outside this slice.
Never supply secret values in a declaration. A valid shape or plan hash is not
an execution token, authorization, reservation or production-safety guarantee.

This does not implement Docker, resource enforcement, gateways, certificate
providers, Tailscale, delivery or business applications. The accepted metadata
guardrails, module schema `1.0`, platform line `1.x` and legacy environment behavior
remain intact. ES0 audit and security findings remain historical evidence, including
unresolved npm advisories and legacy deployment risks; passing ES1 does not resolve
them. No dependency update or migration is included.

Rollback removes the declaration schema, library/CLI/tests and their npm/CI wiring;
there is no persisted state or runtime/data migration. ES2 is a separate future
assignment. See [ES1 verification](es1-verification.md) for actual test outcomes.
