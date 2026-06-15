# Environment Strategy

Business Starter Kit supports six execution contexts:

- Local: developer workstation environment.
- Dev: shared development environment for integrated but unstable changes.
- QA: technical validation environment for automated and manual quality checks.
- UAT: business validation environment for product owners, stakeholders and selected users.
- Staging: production-like environment used to rehearse releases before going live.
- Prod: live production environment used by real customers.

The platform separates runtime configuration from application code. Each environment must use isolated databases, storage buckets, secrets, domains, logs and deployment policies.

## Environment Files

Two complementary sets of example files exist; this is intentional:

| File | Used by | Purpose |
|---|---|---|
| `.env.example` (root) | The default VPS Compose stack | Compose-time defaults (service names, ports, passwords). |
| `config/env/.env.<env>.example` | Human template only | Per-environment runtime configuration templates. |
| `config/env/.env.<env>` | Deploy script + application runtime | Real git-ignored runtime configuration. Must not contain placeholders. |

Copy the relevant example to a real, git-ignored file and replace every
placeholder before use. Validate it before deploying:

```bash
make env-dev                                           # create config/env/.env.dev from template
make validate-env ENV_FILE=config/env/.env.dev            # real file: placeholders rejected
make validate-env ENV_FILE=config/env/.env.dev.example    # template: placeholders allowed
```

Real environment files (and all secrets) live outside the repository, in the host
or in a managed secret store. See [Secrets Management](../security/secrets-management.md).


## Deployment Safety

`scripts/deploy/restart-compose.sh` uses real runtime files such as
`config/env/.env.dev` by default. It refuses to deploy with `.example` templates
unless `ALLOW_EXAMPLE_ENV=yes` is explicitly set for disposable local testing.
This prevents accidental deployments with placeholder passwords.
