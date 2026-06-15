# Port Convention

Business Starter Kit separates stable internal container ports from environment-specific host ports.

## Rule

- Container ports stay boring and stable: PostgreSQL `5432`, Redis `6379`, SeaweedFS S3 `8333`, n8n `5678`, PostgREST `3000`, MongoDB `27017`.
- Host ports are configured through environment files so multiple environments can coexist on one VPS when needed.
- Administrative ports bind to `127.0.0.1` by default. Expose them remotely only through SSH tunnels, Tailscale, Cloudflare Access or another private access layer.
- Production should normally expose only the reverse proxy publicly.

## Default Host Port Matrix

| Environment | HTTP | HTTPS | PostgreSQL | Redis | SeaweedFS S3 | n8n | PostgREST | MongoDB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Local | 8080 | 8443 | 5432 | 6379 | 8333 | 5678 | 3000 | 27017 |
| Dev | 11080 | 11443 | 15432 | 16379 | 18333 | 15678 | 13000 | 27018 |
| QA | 12080 | 12443 | 25432 | 26379 | 28333 | 25678 | 23000 | 27019 |
| UAT | 13080 | 13443 | 35432 | 36379 | 38333 | 35678 | 33000 | 27020 |
| Staging | 14080 | 14443 | 45432 | 46379 | 48333 | 45678 | 43000 | 27021 |
| Prod | 80 | 443 | 55432 | 56379 | 58333 | 55678 | 53000 | 27022 |

These are starter defaults, not a security boundary. If environments are deployed to separate servers, ports can be simplified. If environments share one VPS, keep the matrix to avoid collisions.

## Supabase CLI Ports

The Supabase CLI local profile uses the conventional local Supabase port range:

| Service | Port |
|---|---:|
| Supabase API | 54321 |
| Supabase DB | 54322 |
| Supabase Studio | 54323 |
| Inbucket UI | 54324 |
| Inbucket SMTP | 54325 |
| Inbucket POP3 | 54326 |

Supabase Studio is intended for local/development workflows. Do not expose it publicly in production.
