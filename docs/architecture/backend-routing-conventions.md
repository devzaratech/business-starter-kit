# Backend Routing Conventions

The Business Starter Kit supports multiple backend runtimes.

## Public routing

| Runtime | Public path | Internal service | Internal port |
|---|---|---|---|
| Web | `/` | `web` | `80` |
| Spring Boot | `/api/*` | `api-spring` | `8080` |
| Node.js | `/api/node/*` | `api-node` | `3001` |
| FastAPI | `/api/python/*` | `api-fastapi` | `8000` |

## Environment domains

| Environment | Domain |
|---|---|
| DEV | `bsk-dev.devzaratech.xyz` |
| QA | `bsk-qa.devzaratech.xyz` |
| UAT | `bsk-uat.devzaratech.xyz` |
| Staging | `bsk-staging.devzaratech.xyz` |
| Prod | `bsk-prod.devzaratech.xyz` |

## Health checks

| Environment | FastAPI health |
|---|---|
| DEV | `https://bsk-dev.devzaratech.xyz/api/python/health` |
| QA | `https://bsk-qa.devzaratech.xyz/api/python/health` |
| UAT | `https://bsk-uat.devzaratech.xyz/api/python/health` |
| Staging | `https://bsk-staging.devzaratech.xyz/api/python/health` |
| Prod | `https://bsk-prod.devzaratech.xyz/api/python/health` |

## Routing order

Specific routes must be declared before generic routes.

Correct order:

1. `/api/python/*`
2. `/api/node/*`
3. `/api/*`
4. `/`

This prevents Spring Boot from receiving Python or Node requests.
