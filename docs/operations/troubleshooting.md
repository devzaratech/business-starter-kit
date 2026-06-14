# Troubleshooting Guide

Practical fixes for common issues, ordered from most to least frequent.

## Compose / Containers

**`docker compose config` fails with an `include` error**
The Compose files use the `include` directive and profiles. Upgrade to Docker
Compose v2.20+ (`docker compose version`).

**A service is unhealthy or restarting**
```bash
make ps
docker compose -f infra/compose/docker-compose.vps.yml logs <service>
```
Check the healthcheck command and the service's environment variables.

**Apps do not start with `make up`**
That is expected. The lean default starts infrastructure only. Use `make up-full`
(or `--profile apps`) to start the application services.

## Database

**API cannot connect to PostgreSQL**
Confirm Postgres is healthy (`make ps`), the credentials in your `.env` match the
compose values, and the service name (`postgres`) is used as the host inside the
network — not `localhost`.

**Schema validation error on Spring Boot startup**
The placeholder runs with `ddl-auto: none`. Once entities exist, add a migration
tool (Flyway/Liquibase) and apply migrations before validation.

## Node / Web

**`ERR_MODULE_NOT_FOUND` for a dependency**
Run `npm install` from the repository root (workspaces hoist dependencies). The
worker and web tests need no external dependencies; the Node API needs Express.

**Web build fails on a dependency version**
Dependencies are pinned in `apps/web/package.json`. If a registry blocks a
version, adjust the pin and refresh `package-lock.json` with `npm install`.

## CI/CD

**SonarQube stage does nothing**
That is intended when `SONAR_HOST_URL` / `SONAR_TOKEN` are not configured. See
[SonarQube Strategy](../ci-cd/sonarqube-strategy.md).

**Deployment ran but nothing changed**
Confirm the `IMAGE_TAG` points to an already-built, tested artifact and that the
target environment's env file exists.

## Secrets / Env

**Placeholders left in a runtime env file**
Run `make validate-env ENV_FILE=path/to/.env` to detect missing keys and
leftover `change_me` placeholders before deploying.

## General Incident Hygiene

- Preserve logs before restarting critical services.
- Record every manual change made during an incident.
- Do not change DNS ownership without an approved rollback plan.
