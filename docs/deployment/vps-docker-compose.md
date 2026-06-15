# VPS Docker Compose Deployment

The lean deployment profile is intended for low-cost VPS environments.

## Target Services

- PostgreSQL
- Redis
- SeaweedFS
- n8n
- Spring Boot API
- NodeJS integration service
- Web application
- Reverse proxy

## Start Local Infrastructure

The default (lean) startup brings up only shared infrastructure:

```bash
cp .env.example .env
docker compose -f infra/compose/docker-compose.vps.yml up -d
```

## Start the Full Stack (Apps Included)

To also build and run the application services behind the Caddy reverse proxy,
enable the `apps` profile:

```bash
docker compose -f infra/compose/docker-compose.vps.yml --profile apps up -d
# or simply:
make up-full
```

With the full stack running, the reverse proxy exposes everything on port 80:

- `http://localhost/` → web application
- `http://localhost/api/` → Spring Boot API
- `http://localhost/api/node/` → Node integration service


## Environment-Specific Deployment

For environment-aware deployments, create a real runtime env file from the
matching template and replace every placeholder before deploying:

```bash
make env-dev
nano config/env/.env.dev
make validate-env ENV_FILE=config/env/.env.dev
make deploy-dev
```

Production deploys are guarded:

```bash
make env-prod
nano config/env/.env.prod
make validate-env ENV_FILE=config/env/.env.prod
make deploy-prod CONFIRM_PROD_DEPLOY=yes
```

Do not deploy with `config/env/*.example` files outside disposable local tests.

## Stop Infrastructure

```bash
docker compose -f infra/compose/docker-compose.vps.yml --profile apps down
```

## Healthchecks

PostgreSQL, Redis and the application services define healthchecks, and startup
ordering uses dependency conditions so dependent services wait for healthy ones.

## Production Notes

Before production use:

- Replace all default passwords.
- Disable public ports for private services.
- Put administration services behind a private network or VPN.
- Use TLS at the reverse proxy layer.
- Configure backups.
- Configure log retention.
- Define tenant isolation strategy.
