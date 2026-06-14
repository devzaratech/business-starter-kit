# Secrets Management

Secrets never live in the repository. This document defines how they are handled
across environments.

## Principles

- No secrets in Git. `.env`, `*.key`, `*.pem` and similar files are git-ignored.
- Only `*.example` files are committed, and they contain placeholders only.
- Each environment (local, dev, qa, uat, staging, prod) has isolated secrets.
- Use least-privilege credentials and rotate them periodically.

## Where Secrets Live

| Context | Source of secrets |
|---|---|
| Local | A developer-only `.env` file (never committed). |
| CI (GitHub Actions) | Repository/Environment **secrets**; non-secret config as **variables**. |
| CI (Jenkins) | Jenkins **credentials** + global env properties. |
| Runtime (VPS) | An environment-specific `.env` file on the host, outside the repo, with restricted permissions. |
| Cloud profiles | A managed secret store (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager). |

## Example Files vs Real Files

```txt
.env.example                       # committed, placeholders only
config/env/.env.<env>.example      # committed, placeholders only
.env                               # local only, git-ignored
```

## Rotation Checklist

- Rotate database, storage and JWT signing secrets on a schedule.
- Rotate immediately after any suspected exposure.
- Invalidate old tokens after rotation.
- Record rotations in the operations log (without recording the secret values).

## Hard Rules

- Never log secret values.
- Never place secrets in URLs, query strings or client-side code.
- Never share a single credential across environments.
