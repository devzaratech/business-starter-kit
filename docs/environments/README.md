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
| `config/env/.env.<env>.example` | The deploy script + application runtime | Per-environment runtime configuration templates. |

Copy the relevant example to a real, git-ignored file and replace every
placeholder before use. Validate it before deploying:

```bash
make validate-env ENV_FILE=config/env/.env.dev.example   # example: placeholders allowed
make validate-env ENV_FILE=.env                           # real file: placeholders rejected
```

Real environment files (and all secrets) live outside the repository, in the host
or in a managed secret store. See [Secrets Management](../security/secrets-management.md).
