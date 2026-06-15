# Repository Map

```txt
apps/api-spring                     Spring Boot core API (+ Dockerfile)
apps/api-node                       NodeJS integration service (+ Dockerfile)
apps/web                            Frontend shell (Vite/React, + Dockerfile)
apps/worker                         Background worker (long-running, + Dockerfile)
packages/*                          Shared platform packages
infra/compose                       Lean VPS stack + environment + optional overlays
infra/caddy                         Reverse proxy config (working Caddyfile + example)
infra/nginx                         Alternative reverse proxy example
infra/aws | azure | gcp             Cloud deployment profile placeholders
infra/tailscale | cloudflare        Private networking / edge profile notes
supabase                            Optional Supabase CLI/PostgREST profile
automation/n8n                      Workflow automation assets
docs                                English documentation
examples                            Sanitized product examples
scripts/quality                     Tests, env validation and Sonar scan scripts
scripts/deploy                      Environment-aware deployment scripts
Jenkinsfile                         Optional Jenkins delivery pipeline
sonar-project.properties            SonarQube analysis configuration
.github/workflows                   GitHub Actions CI, deploy and release
```

## Compose Files

```txt
infra/compose/docker-compose.vps.yml          Lean stack; apps via --profile apps
infra/compose/docker-compose.<env>.yml         Per-environment overlays (include vps)
infra/compose/docker-compose.postgrest.yml      Optional PostgREST profile (standalone)
infra/compose/docker-compose.mongodb.yml        Optional MongoDB profile (standalone)
```

## Documentation Areas

```txt
docs/development        Local development guide
docs/architecture       Overview, boundaries, growth path, ADRs
docs/ci-cd              CI/CD, Jenkins, SonarQube, testing, quality gates
docs/release            Release strategy
docs/deployment         VPS Docker Compose deployment
docs/cloud-profiles     Cloud profile strategy
docs/operations         Runbook and troubleshooting
docs/security           Baseline, secrets, RBAC, audit logging
docs/tenancy            Multi-tenancy strategy
docs/database           Database, Supabase/PostgREST, MongoDB strategies
docs/storage            Storage provider strategy
docs/integrations       Integration patterns, n8n, CMS/ERP
docs/environments       Environment strategy and per-environment notes
```


## Final Structural Notes

- `automation/n8n/` stores n8n workflow exports and credential templates.
- `data/` stores provider-specific data-layer profiles and placeholders.
- `supabase/` remains at the repository root for Supabase CLI compatibility and Studio support.
- `docs/environments/port-convention.md` defines Local, Dev, QA, UAT, Staging and Prod host port conventions.
- `supabase/config.toml` is the generated active Supabase CLI profile. Source profiles live under `supabase/config/` and support Local, Dev, QA, UAT, Staging and Prod port conventions.
