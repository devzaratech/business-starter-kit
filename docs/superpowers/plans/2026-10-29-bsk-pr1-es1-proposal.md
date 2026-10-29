# PR1 / ES1 declaration and dry-run implementation proposal

> **For agentic workers:** After PR0 approval and explicit ES1 assignment, use
> superpowers:executing-plans to implement this proposal task by task. This is a
> bounded subordinate proposal, not a second long-term roadmap or authorization
> to begin ES1 during PR0.

**Goal:** Validate two projects with arbitrary environments and produce a
deterministic, side-effect-free declaration plan.

**Architecture:** Canonical JSON Schema 2020-12 owns shape validation; a pure
evaluator owns scoped references, route conflicts and resource math. A thin
Node CLI prints JSON results. No control plane, driver or durable store is added.

**Tech stack:** Existing Node >=20, Node test runner, locked Ajv 8.20.0 and
built-in crypto/fs. No new dependency or framework.

**Spec:** [ES0 canonical contracts](../../architecture/es0/canonical-contracts.md),
[threat model](../../architecture/es0/threat-model.md),
[ES1 acceptance](../../architecture/es0/engineering-slices.md), proposed ADR 0006.
The [master plan](2026-10-28-bsk-agent-master-plan.md) remains authoritative.

## Global constraints

- Do not execute this proposal until PR0 review resolves its contract decisions.
- Use `bsk/v0alpha1`; preserve module schema `1.0` and platform line `1.x`.
- Use JSON declaration input only, closed fields and no coercion/default env.
- Environments use the exact 1–63 character slug pattern in the contract; no tier enum.
- Limit a bundle to 1 MiB and 1,000 resources/route claims in total; errors are explicit.
- No Docker, shell, SSH, cloud, DNS, credential discovery, environment-file sourcing,
  implicit repository writes, production action or business-domain code.
- English artifacts, public F1 / Apache-2.0 path, existing feature branch workflow.
- ES1 plans are offline declarations, not approved executable deployment plans.

## Review focus

1. Confusing project names across installations: resolve complete scoped keys.
2. Reordering resources/object keys: preserve identical plan bytes and planId.
3. Malicious host/path and oversized input: reject before any side effect.
4. Claimed runtime enforcement or authentication from a local catalog: mark not evaluated.
5. Legacy environment behavior: retain helpers; never route a new slug through fallback.

Each is covered by the tasks below. No API endpoint or live apply command is in scope.

## Task 1: Closed declaration schema and graph validation

Files to create:

- `contracts/schemas/bsk-declaration-v0alpha1.schema.json`: bundle, three resource
  kinds, catalog, shared identifier/resource/route definitions; use `$defs`.
- `scripts/declarations/lib/validate.mjs`: strict Ajv compilation and graph policy.
- `scripts/declarations/test/validation.test.mjs`: shape and scope negatives.
- `scripts/declarations/test/fixtures/`: small synthetic JSON bundles only.

Interfaces: `validateBundle(value) -> {valid:boolean, diagnostics:Diagnostic[]}`.
Diagnostic is `{code, path, message, resourceKey?}`; stable codes and ordering,
no input values in messages. Consume exactly the envelope/bundle/catalog in the
ES0 contract. Check installation/project/environment existence, policies/runtimes
against catalog, resource-key uniqueness, route-service scope/ownership, hostname
claims, numeric safe bounds and request <= limit. Resource math is validation,
not host admission. Validate byte size before parsing in Task 3 and resource/route
counts before graph evaluation.

- [ ] Write tests that initially fail: valid two-project fixtures with 1/5/10
  arbitrary environments each (including `review-142`, `sandbox`, `perf-lab`);
  equal env/service names in different projects valid; repeat scoped key invalid.
- [ ] Add cases for wrong version/kind, unknown fields, null/wrong types, status
  input, empty/uppercase/overlong/traversal IDs, missing foreign refs, installation
  mismatch, cross-project route, unknown catalog entry, duplicate catalog entry.
- [ ] Add duplicate exact hostname/path, cross-owner nested paths and public/private
  duplicate claims; same-owner nested prefixes valid. Reject bad DNS/IP/port,
  dot/encoded path, wildcard/regex and credential-bearing route input.
- [ ] Add unsafe/negative/overflow numeric fields, request > limit, zero replicas,
  >1,000 resource+route total and malformed resource objects. Assert diagnostics
  contain stable pointers/codes without fake secret strings.
- [ ] Run `node --test scripts/declarations/test/validation.test.mjs`; verify
  failure due to absent implementation, then implement schema and validator.
- [ ] Run that test and existing `npm run architecture:test` and
  `npm run architecture:check`; review schema rules are not duplicated in JS.
- [ ] Commit the bounded schema/validator change on the assigned feature branch.

## Task 2: Pure deterministic declaration planner

Files to create:

- `scripts/declarations/lib/plan.mjs`: pure plan generation and canonical hashing.
- `scripts/declarations/test/plan.test.mjs`: determinism and invalid/no-action tests.

Interfaces: `planBundle(value) -> PlanResult`, consuming Task 1 validation.
`PlanResult` is `{apiVersion, mode:"dry-run", planId, actions, diagnostics}`.
For invalid input, `planId` is null and `actions` is empty. Valid actions are
`{action:"declare", resourceKey, spec, runtimeChecks:"not-evaluated"}`.
Canonicalize/hash per the spec. No timestamps or generated UIDs. Plan ID includes
the full catalog so changing policy/runtime catalog cannot silently reuse it.

- [ ] Write failing tests asserting reordered resources, catalog sets and JSON
  object keys give byte-identical plans; meaningful spec/catalog changes alter ID.
- [ ] Assert invalid scopes/routes produce no actions; valid plans explicitly
  report runtime checks not evaluated, with no `applied`/healthy result.
- [ ] Deny network/process APIs in tests and snapshot the fixture tree before/after
  evaluation to catch hidden writes. Verify validation/planning use no process env,
  Docker discovery, filesystem writes or secret lookup.
- [ ] Run `node --test scripts/declarations/test/plan.test.mjs`; observe failing
  tests, implement pure planner, rerun and inspect canonical output.
- [ ] Commit the planner and tests.

## Task 3: Read-only CLI, documentation and CI wiring

Files to create:

- `scripts/declarations/cli.mjs`: `validate <bundle.json>` and `plan <bundle.json>` only.
- `scripts/declarations/test/cli.test.mjs`: process-level JSON and exit tests.
- `docs/development/declaration-planning.md`: example commands and limitations.

Files to modify:

- `package.json`: `declarations:test` = `cd scripts/declarations && node --test`.
- `.github/workflows/ci.yml`: run declaration tests on existing Linux/Windows
  architecture matrix after `npm ci --ignore-scripts`.
- `Jenkinsfile`: run the same test command after locked install.

CLI: success exit 0; invalid declarations exit 1; usage/read/parse/size error exit 2.
JSON results only on stdout; redacted operational/usage diagnostics on stderr.
Accept one explicit file, check bytes before JSON parse and never source env files.
No `--apply`, mutation command, network discovery or output-file flag. Root
`package-lock.json` changes are unnecessary unless required by npm metadata;
review any such diff explicitly rather than regenerating it gratuitously.

- [ ] Write failing CLI tests: valid/invalid output and exit codes, corrupt JSON,
  missing file, >1 MiB input, unsupported command/flag and attempted apply/down/
  destroy; denied actions leave filesystem snapshots unchanged.
- [ ] Run `node --test scripts/declarations/test/cli.test.mjs`; implement CLI,
  add documentation/CI commands and rerun tests on Node 20 Linux/Windows.
- [ ] Run `npm run declarations:test`, `npm run architecture:test`,
  `npm run architecture:check`, `npm test`, `npm run infrastructure:test`,
  `npm run build --if-present`, and Java baseline tests when tooling is available.
  Record actual skipped/blocked checks; no runtime isolation claim from these tests.
- [ ] Independently review scope, negative tests, redaction and compatibility,
  then commit and prepare one reviewable PR. Push only when authorized.

## Migration, rollback and definition of done

This is an additive declaration path, not a migration of existing deployments.
Leave Spring `EnvironmentName`, JS/TS helpers, Compose, legacy Make targets and
deploy workflow inputs unchanged. Remove the new CLI/schema/test wiring to roll
back; no persistent state or data migration exists. If the reviewed contracts
change, revise this proposal before writing code.

ES1 is complete only with two-project arbitrary-environment fixtures, deterministic
plans, negative tests, documented offline limitations, green required CI and
review. Stop there. PR2a/ES2 is a separate assignment requiring disposable-host
runtime tests and resource/ownership review; no CRM or dashboard work is implied.
