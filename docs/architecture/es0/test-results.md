# ES0 verification evidence

## Historical local evidence

This section preserves the original local run evidence and limitations. Later
hosted evidence is recorded separately below; it does not rewrite these outcomes.

Run date: 2026-10-29 (project date); audited commit
`54983f3650328187e92b257261b81a0400c151ab`. Local Windows PowerShell environment:
Node `v24.22.1`, npm `11.19.1`, Docker Compose `v5.5.1`. CI targets Node 20 and
Java 17; the local Node 24 run is not a substitute for that CI matrix. Installed
Java is Microsoft JDK 25; Maven is not on PATH and the repository has no wrapper.

No tests were added for these documentation-only changes. Existing tests were
run without changing implementations or weakening assertions. No containers were
started/stopped/built, and no VPS, DNS, Tailnet, production data or cloud account
was modified. Compose validation below invokes `config`, not `up`.

## Commands and actual outcomes

| Command | Outcome | What it proves / limitations |
|---|---|---|
| `npm ci --ignore-scripts` | Exit 0 after authorized network retry; 142 packages added, 146 audited | Installs existing lock; no dependency/lock changes. Lifecycle scripts disabled. First sandbox attempt failed with registry DNS `ENOTFOUND`. |
| `npm run architecture:test` | Exit 0; **104 passed**, 0 failed/skipped | Schema/discovery/kind/visibility/Freedom Class/CI wiring fixtures. Does not inspect runtime imports, upstream licensing or isolation. |
| `npm run architecture:check` | Exit 0; **10 module manifests validated** | Actual discovered module metadata, excluding test fixtures. |
| `npm test` | Exit 0 after authorized loopback retry; **4 tests passed** (Node 1, web 2, worker 1), 0 failed/skipped | Node `/health`, JS environment helper and heartbeat payload. No integration/auth/UI/worker lifecycle proof. |
| `$env:BASH_PATH='C:/Program Files/Git/bin/bash.exe'; npm run infrastructure:test` | Exit 0 after authorized Git Bash retry; **7 passed**, 0 failed/skipped | Four port/render tests and three isolated Supabase Studio generation safeguards. Includes ten Compose configs: local/dev/qa/uat/staging/prod/vps/edge/mongodb/postgrest; repeated render ignores parent interpolation. No daemon or DB needed. |
| `npm run build --if-present` | Exit 0; Vite `5.4.21`, 29 modules transformed | Only the web workspace defines build; emitted index and JS bundle. Not TypeScript typecheck, OCI build or reproducibility proof. |
| `mvn --batch-mode test` in `apps/api-spring` | **Blocked**, exit 1: command not found | Existing JUnit suite not executed locally; Java test result unknown. No Maven wrapper or Java 17 toolchain installed by this PR. |
| `npm audit --json` | Exit 1: **11 affected package entries** (4 moderate, 6 high, 1 critical) | Advisory query succeeded, security check is not green. Advisory counts do not prove exploitability or equal distinct CVE counts. No automatic fix executed. |
| Local Markdown target validation | Exit 0; 18 architecture/proposal documents checked, 0 missing local targets | Checked relative file targets after excluding inline code; external links and anchors not checked. |
| `git diff --check` plus new-document whitespace scan | Exit 0; 12 new Markdown documents, no trailing whitespace or missing final newlines | Tracked diff is the overview index link; remaining changes are added documents only. |

Initial architecture/workspace attempts were mistakenly started before dependency
installation completed and failed due to absent Ajv/Express modules. Those runs
are invalid as product failure evidence; the table records fresh post-install
runs. The first post-install Node test was blocked by sandbox loopback `EACCES`;
the Git Bash fixture tests were blocked by MSYS `NtCreateDirectoryObject` access
denial. Both complete suites passed on authorized rerun outside the sandbox.
These initial failures are disclosed rather than omitted as successful checks.

## Dependency advisories requiring separate review

The exact queried tree is `package-lock.json` at the audited commit. The npm
report returned these package entries; severity reflects the advisory service
at run time, not a BSK exploit assessment:

| Severity | Package entries |
|---|---|
| Critical | `proxy-addr` |
| High | `body-parser`, `browserslist`, `nanoid`, `postcss`, `source-map-js`, `vite` |
| Moderate | `baseline-browser-mapping`, `esbuild`, `fast-uri`, `qs` |

For example, the service linked `proxy-addr` to
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
The Node example does not configure Express trust proxy, so presence is not proof
that this specific spoofing condition is reachable. Development/build tool
advisories have different exposure from the served static web bundle. Review
actual versions, call paths and remediation in a separate dependency PR; npm's
suggested Vite remediation includes a major update and is not applied here.

## Historical local checks not executed / not established

- Hosted GitHub Actions and Jenkins were not triggered; no green hosted CI claim.
- Maven/Spring tests are blocked locally; Java 17/Node 20 CI parity is unverified.
- FastAPI/PHP have no existing automated tests in the audited test gate; no new
  runtime/conformance tests were invented for ES0.
- Docker builds, Caddy validation via container, cgroups, network isolation,
  project teardown, backup/restore, failure injection and ES1–ES6 are not run.
- `scripts/doctor/validate-caddy-multi-env.sh` starts a container and expects a
  real dev env file; public-domain smoke scripts and mutating operational scripts
  are deliberately not run as baseline tests.
- Optional SonarQube analysis, Java/Python/PHP/image vulnerability scans,
  production environment protection settings and license audits are unverified.
- Aggregate `make test` / `run-all-tests.sh` were not substituted for individual
  commands: both stop at missing Maven and omit architecture checks. No overall
  all-tests-green claim is made.

## Independent documentation review

A read-only reviewer checked AGENTS.md, the master roadmap, ADRs 0001–0010,
all ES0 artifacts and the PR1 proposal against relevant source/contracts/CI.
The review reported no critical, high or medium findings, no accidental ES1
implementation, and retained the owner/CI/runtime verification gates below.
The reviewer did not rerun tests. A final clarification makes local transactional
claims persistence a PR2 responsibility, extended by PR3's operation ledger,
so PR2 cannot depend on an unimplemented PR3 registry. The same reviewer checked
that clarification and reported no dependency or contract contradiction.

PR0's output is evidence and proposed architecture. Owner approval, complete
required CI, dependency remediation and future runtime conformance remain gates
for their corresponding claims. Documentation rollback requires no data changes.

## Hosted GitHub Actions evidence for published PR #7

Verified on 2026-10-29 through GitHub's workflow-run and job/step APIs for
[PR #7](https://github.com/devzaratech/business-starter-kit/pull/7), branch
`docs/bsk-agent-pr0-architecture`, head commit
`b8d2dfe586f17ceaa201b6f79aae4b044efb38f8`.
[CI run #31 / 40813369297](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297)
completed with conclusion **success**.

| Hosted job | Observed result | Scope from the workflow and returned steps |
|---|---|---|
| [Architecture guardrails (ubuntu-latest)](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248664508) | Success | Node 20 locked install, architecture tests and manifest validation |
| [Architecture guardrails (windows-latest)](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248664451) | Success | Same architecture commands on Windows / Node 20 |
| [Spring Boot API tests](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248664594) | Success | Java 17 setup and Maven unit-test step succeeded |
| [Node, worker and web tests](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248664522) | Success | Node 20 workspace tests and artifact build succeeded |
| [Docker Compose validation](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248664295) | Success | Infrastructure environment/safety test step succeeded; not deployed runtime isolation |
| [Quality gate](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248886358) | Success | Required workflow dependencies completed successfully |
| [SonarQube analysis (optional)](https://github.com/devzaratech/business-starter-kit/actions/runs/40813369297/job/123248781898) | Job success; analysis step **skipped** | Configuration check succeeded; no Sonar analysis or server quality-gate claim |

This establishes hosted baseline Java 17/Node 20 job success for that revision,
separately from the historically blocked local Maven run. API step summaries
were inspected; test counts were not inferred from local counts or fresh log
parsing. Jenkins, dependency remediation, certificate/ingress conformance and
production deployment protections remain unverified. The 11 npm vulnerability
entries and deployment/security findings in the inventory are preserved; a green
CI workflow does not resolve them. This run predates the final documentation
review commit and must not be represented as that later commit's CI result.

## Final architecture documentation validation

The final PR #7 review changes five Markdown documents only. `git diff --check`
passed; local-target validation checked 19 relative file links across those five
documents with no missing targets. Whitespace/final-newline checks passed.
Baseline comparison (normalizing Windows line endings) confirmed the complete
implementation/security inventory, threat model, PR1 proposal and npm lockfile
remain unchanged. The resulting diff was reviewed for English documentation,
minimum certificate contracts, ES3-only implementation boundaries and unchanged
security findings. No runtime tests, Certbot commands, DNS challenges or production
operations were run for this documentation-only follow-up.

A separate read-only review of this five-file follow-up found no actionable
issues and confirmed the unchanged PR1 scope and security findings. No tests were
rerun by that reviewer; new-head hosted CI remains a separate check after push.
