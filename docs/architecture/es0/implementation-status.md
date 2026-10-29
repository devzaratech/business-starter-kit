# Implementation status and architecture review

Baseline and scope: see [ES0 review](README.md). This is a source audit, not a
claim about deployed infrastructure. **Implemented** means executable behavior
exists, with the limits below. **Incomplete / Preview** means partial behavior;
**Experimental / Lab** means an opt-in example without conformance evidence;
**Planned** means no implementation was found. These audit labels do not change
manifest `supportLevel` and do not certify GA.

## Repository implementation matrix

| Capability | Audit status | Evidence in repository | Verified limit / missing guarantee |
|---|---|---|---|
| Module schema and discovery | Implemented | `contracts/schemas/bsk-module.schema.json`, `scripts/architecture/lib/{module-manifest,discover-manifests}.mjs` | Ajv 2020 validates 10 governed manifests; fixtures excluded; not import or license scanning |
| Dependency rules | Implemented | `scripts/architecture/lib/dependency-rules.mjs`, architecture tests, ADRs 0004/0005 | Explicit kind edges, optional edges, visibility and required Freedom Class rules; graph-cycle detection beyond self-reference is absent |
| Kernel, tenancy, RBAC, audit | Incomplete / Preview metadata; behavior planned | `packages/{core-domain,tenancy,auth-rbac,audit}/README.md`, corresponding manifests and source placeholders | Empty dependency/capability arrays truthfully advertise no implementation; no access enforcement |
| Storage, integrations, observability packages | Planned | `packages/{storage,integrations,observability}/README.md` | Documentation placeholders, not governed runtime adapters |
| Node HTTP example | Implemented narrow behavior / Preview | `apps/api-node/src/app.js`, `test/app.test.js` | `/health` only; no service lifecycle, authorization, readiness or shared error contract |
| Worker example | Implemented narrow behavior / Preview | `apps/worker/src/{heartbeat,index}.js`, heartbeat unit test | Unit test covers payload, not process shutdown, file freshness or delivery/retry semantics |
| Spring runtime | Incomplete / Preview | `apps/api-spring/pom.xml`, `BusinessStarterKitApiApplication.java`, `application.yml`, `EnvironmentName.java` | Boot 3.3.0 / Java 17 target, Actuator/JPA config and enum tests; no project API or observed deployment; local Maven test blocked |
| React client | Incomplete / Preview | `apps/web/src/main.tsx`, `environment.{js,ts}`, environment test | Starter screen; tests exercise JS normalization, not TS parity or rendered UI; unknown environment becomes `local` |
| FastAPI / PHP | Experimental runtime examples; manifests Preview | `apps/api-fastapi/src/main.py`, `apps/api-php/public/index.php`, Dockerfiles | Health/root handlers; no automated runtime tests in existing CI; PHP fallback returns a generic response for other paths |
| Container packaging | Incomplete / Preview | `apps/*/Dockerfile` | Build recipes exist, images not built/run in ES0; Node builds use `npm install` without workspace lock; image tags mutable; non-root policy uneven |
| VPS Compose | Incomplete / Preview | `infra/compose/docker-compose.vps.yml`, six environment overlays | Renderable examples; fixed project names and environment-only `container_name`; volumes project-scoped by Compose, not an ownership guard |
| Data/automation defaults | Experimental profiles / legacy baseline | VPS Compose, `automation/n8n`, `supabase/migrations/*.sql` | PostgreSQL, Redis, SeaweedFS and n8n in default stack; n8n is not optional in this legacy topology, conflicting with future lean kernel; SQL seeds not a control-plane state store |
| Optional data profiles | Experimental / Lab | `infra/compose/docker-compose.{mongodb,postgrest}.yml`, `supabase/config/*.toml`, `scripts/supabase` | Compose renders and Studio safeguards tested; no DB isolation/restore tests; PostgREST role/migration provisioning not demonstrated |
| Shared ingress | Incomplete / Preview | `infra/compose/docker-compose.edge.yml`, `infra/caddy/Caddyfile.multi-env` | One static edge configuration for five environments; no managed routes, atomic registry or domain proof; upstream names fixed |
| Single-environment proxy | Incomplete / compatibility path | VPS `single-env-proxy` profile and `infra/caddy/Caddyfile` | Separate from `apps` profile; `make up-full` enables only `apps`, so ADR 0002's complete-stack entry-point claim no longer matches profile wiring |
| Nginx / Traefik edge | Experimental example / Planned respectively | `infra/nginx/nginx.conf.example`; no Traefik implementation | Nginx example uses `apps-web:5173`, unlike container `web:80`; not an equivalent tested gateway adapter |
| Arbitrary environments / project CLI | Planned | Fixed `EnvironmentName`, web normalizers, deploy script case list, workflow inputs | Current helpers assume six names (dispatch five); no project/environment declaration schemas, `bsk` CLI or deterministic planner |
| Resource governance | Planned | No CPU/memory/PID budgets or admission in VPS Compose | No host reserve ledger, cgroup evidence, storage quota driver, build quota or effective-status reporting |
| GitHub CI | Implemented baseline | `.github/workflows/ci.yml` | Architecture on Linux/Windows Node 20, Java 17 tests, workspace build/tests, Compose/Studio checks; no runtime conformance or security enforcement gate |
| Jenkins CI | Incomplete / Preview scaffold | `Jenkinsfile` | Architecture/tests, opt-in build/deploy and production input; omits workspace artifact build compared with Actions; execution not verified |
| Deploy/release | Incomplete / unsafe for platform claims | `.github/workflows/{deploy,release}.yml`, `scripts/deploy/restart-compose.sh` | SSH restart, mutable tags, fixed envs, no project scope, no digest promotion; release validates staging Compose only |
| Optional analysis | Incomplete / Preview scaffold | `scripts/quality/run-sonar-scan.sh`, CI Sonar job | Scanner optional; required quality gate does not depend on Sonar; scan submission is not proof of server quality-gate success |
| Tailscale / cloud / Cloudflare | Planned integration, plus legacy operational scripts | `infra/{tailscale,aws,azure,gcp,cloudflare}/README.md`, `scripts/cloudflare/*.sh` | Documentation and DNS helper scripts are not scoped adapters, bootstrap or reviewed Tailnet policy; no external actions taken |
| Control plane / common API/UI/MCP | Planned | Master plan; no queue/reconciler implementation | No durable operations, shared authorization, API OpenAPI, transactional ownership or drift reconciliation |
| Observability / recovery | Incomplete diagnostics; platform behavior planned | Heartbeat, Actuator, `scripts/doctor*`, operations docs | No correlated operations, bounded telemetry, tested backup/restore, safe rollback or SLO evidence |
| Business verticals | Planned / documentation-only | `examples/*/README.md` | No product implemented; gated on demonstrated ES0–ES6 |

## Module and open-core review

Keep `Products → Profiles → Runtimes → Capabilities → Kernel → Contracts` as a
summary, but use ADR 0005's explicit allowed-target table as the actual rule.
Adapters consume inward ports; conformance and deployment compose at the edge.
Generic capabilities consume telemetry contracts, not observability backends.
No physical directory migration is necessary for ES0 or ES1.

All ten governed manifests are public F1 / Apache-2.0 / Preview. The current
required/optional module dependency arrays are empty; tests prove policy rejection
on fixtures, not integration of a functioning kernel. `capabilities.requires`
(for example web's `http.contract`) is metadata; the checker does not resolve
providers for capability strings. It does not inspect imports, general graph
cycles, upstream licenses, license compatibility or runtime isolation. Preserve
these distinctions in future support claims.

The repository's Apache-2.0 license does not relicense container images or
upstream tools. Record actual licenses and optionality when those providers
become governed modules. In particular, an existing n8n deployment example must
not silently become a required F1 kernel dependency. Required public F1 paths
remain F1; public-to-private edges remain forbidden even when optional. PR1
should use the existing locked Ajv for validation, with no cloud/runtime imports.

## Findings and compatibility register

| ID / priority | Finding and evidence | Review disposition / owner stage |
|---|---|---|
| R01 / High | `deploy.yml` embeds `inputs.image_tag` in shell source and later a remote command; Jenkins also interpolates `IMAGE_TAG`. Validation only checks non-empty strings. | Treat as injection risk, not a demonstrated exploit. Before delivery reuse, validate digest/identifiers, use argument-safe execution and never build a shell program from input (PR5). |
| R02 / High | `ssh-keyscan` at deployment time discovers host trust on the same channel; `pull || true` masks retrieval failure and `up` has no readiness/rollback gate. | Pin reviewed host keys, fail closed on pull/digest mismatch, observe rollout (PR5). Do not run current workflow as proof of safe deployment. |
| R03 / High | All app endpoints join global external `bsk-edge`; single-env proxy also joins database network. No CPU/memory limits or privilege admission. | Lateral access and noisy-neighbor risk; adopt per-project/environment ingress and private networks plus observed resource checks (PR2). Compose shares the host kernel. |
| R04 / High | `CF-Connecting-IP` is copied into upstream identity headers without a verified trusted origin path in authored Caddy files. | Reject client header spoofing; establish trusted-proxy policy, block direct-origin bypass where selected (PR2 gateway/PR4). Never use these headers alone for authorization. |
| R05 / High | Default placeholder credentials, shared PostgreSQL credentials for n8n, no implemented RBAC/audit. `validate-env.sh` checks key presence and placeholder substrings, not non-empty/strong secrets or exposure policy; its failure output can print matching value lines. | Secret references and redacted diagnostics; scoped stores/roles, deny public admin/data by policy (PR2/PR3). Runtime defaults are examples, not safe production settings. |
| R06 / High | npm advisory query reports 11 affected package entries, including critical `proxy-addr`; see evidence. Docker/Java/Python/PHP dependencies have not been scanned here. | Separate reviewed dependency remediation with applicability analysis; no automatic major updates in ES0. No clean security bill. |
| R07 / Medium | Spring rejects unknown environment; web maps it to `local`; scripts/workflows/config templates hard-code tiers. | Add canonical slugs alongside legacy configuration in PR1. Never silently map a new declaration to local/prod. Retain old helpers until a reviewed migration. |
| R08 / Medium | Environment-only container names collide across projects. Renaming Compose projects changes default volume names; shared gateway/certificate state has independent lifetime. | Explicit ownership/adoption and volume mapping migration in PR2; no automatic orphan removal, rename or prune. |
| R09 / Medium | ADR 0003 says production approval on both runners, but Actions relies on externally configured environment protections that cannot be verified from source. | Record desired vs configured vs tested controls; check protections before remote delivery. Do not amend accepted ADR history to imply verification. |
| R10 / Medium | `make test` and `run-all-tests.sh` omit architecture commands; `up-full` proxy mismatch; Nginx upstream mismatch. | Focused compatibility correction PR with tests after PR0; do not bundle into ES1 unless necessary and explicitly reviewed. |
| R11 / Medium | CI actions use version tags; Dockerfiles do not pin base digests and Node image installs ignore root lock; no SBOM/provenance checks. | Reproducibility and supply-chain gate in PR5/PR6. Do not confuse a successful Vite build with reproducible OCI artifacts. |
| R12 / Medium | SQL tenants/audit tables lack demonstrated RLS or append-only enforcement; `tenancy` package is not platform project isolation. | Keep business tenant identity separate from project ownership; test all access paths in PR3. SQL presence does not prove policy enforcement. |

## Architecture alternatives and recommendation

1. Extend the accepted contracts and existing guardrails with a small planner and
   constrained worker. This retains runtime freedom and allows failure cases to
   be proved incrementally. **Recommended for ES1–ES6.**
2. Delegate all orchestration to an existing PaaS adapter. This can reduce
   orchestration work later, but provider-specific capabilities and ownership
   still need conformance. Keep optional; it cannot replace the canonical model.
3. Make Kubernetes the mandatory kernel. Its richer policies do not justify the
   bootstrap/operating cost or a rewrite of the VPS baseline. Defer as planned.

The proposed ADRs choose the first approach; they do not claim owner acceptance.
Existing working components stay in place. The next change is declaration and
dry-run validation, not a dashboard, runtime upgrade or business application.
