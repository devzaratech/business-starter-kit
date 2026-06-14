# LOCAL Environment

## Purpose

Developer workstation environment for local iteration.

## Rules

- Use isolated configuration.
- Use isolated secrets.
- Use isolated database/schema or database server depending on maturity.
- Use isolated storage buckets.
- Do not share runtime credentials with other environments.
- Promote tested code and artifacts instead of changing code per environment.

## Files

```txt
config/env/.env.local.example
infra/compose/docker-compose.local.yml
```
