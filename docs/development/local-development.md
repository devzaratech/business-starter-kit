# Local Development

This guide gets a new developer productive quickly.

## Prerequisites

- Docker and Docker Compose v2.20+ (the Compose files use `include` and profiles).
- Node.js 20+ and npm.
- JDK 17 and Maven 3.9+ (for the Spring Boot API).

## First-Time Setup

```bash
cp .env.example .env          # create a local env file
make up                       # start lean infrastructure (pg, redis, seaweed, n8n)
```

To also build and run the application services behind the reverse proxy:

```bash
make up-full                  # infra + apps + Caddy reverse proxy
```

## Common Commands

| Command | Action |
|---|---|
| `make up` / `make down` | Start / stop the lean infrastructure stack. |
| `make up-full` | Start infrastructure + application services. |
| `make logs` | Follow container logs. |
| `make ps` | Show running services. |
| `make test` | Run all available unit tests + Compose validation. |
| `make validate-env` | Check an env file for missing keys / leftover placeholders. |
| `make quality` | Run the full local quality gate. |

## Service Endpoints (full stack)

| Service | URL |
|---|---|
| Web application | http://localhost/ |
| Spring Boot API | http://localhost/api/ |
| Node integration API | http://localhost/api/node/ |
| n8n | http://localhost:5678/ |
| SeaweedFS S3 | http://localhost:8333/ |

## Running Tests Without Docker

```bash
# Node workspaces (worker and web have no external dependencies)
npm install
npm test

# Spring Boot API
cd apps/api-spring && mvn --batch-mode test
```

## Project Conventions

- Promote the same artifact across environments; never fork code per environment.
- Keep platform-generic code in `packages/`; keep product-specific code in
  `examples/` or separate product repositories.
- Never commit secrets or real customer data.
