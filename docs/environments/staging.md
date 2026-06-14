# STAGING Environment

## Purpose

Production-like environment used to rehearse releases before going live.

## Rules

- Use isolated configuration.
- Use isolated secrets.
- Use isolated database/schema or database server depending on maturity.
- Use isolated storage buckets.
- Do not share runtime credentials with other environments.
- Promote tested code and artifacts instead of changing code per environment.

## Files

```txt
config/env/.env.staging.example
infra/compose/docker-compose.staging.yml
```
