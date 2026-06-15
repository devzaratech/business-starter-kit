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

Supabase CLI uses environment-specific port ranges so Local, Dev, QA, UAT, Staging and Prod profiles can coexist without manual reconfiguration.

| Environment | API | DB | Studio | Inbucket UI | SMTP | POP3 | Studio Default |
|---|---:|---:|---:|---:|---:|---:|---|
| Local | 54321 | 54322 | 54323 | 54324 | 54325 | 54326 | Enabled |
| Dev | 55121 | 55122 | 55123 | 55124 | 55125 | 55126 | Enabled |
| QA | 55221 | 55222 | 55223 | 55224 | 55225 | 55226 | Enabled |
| UAT | 55321 | 55322 | 55323 | 55324 | 55325 | 55326 | Enabled |
| Staging | 55421 | 55422 | 55423 | 55424 | 55425 | 55426 | Disabled |
| Prod | 55521 | 55522 | 55523 | 55524 | 55525 | 55526 | Disabled |

Use `make supabase-start ENV=<env>` to generate the active `supabase/config.toml` from the selected profile. Supabase Studio can be enabled or disabled without editing TOML files manually.

Production Studio is disabled by default. If it is enabled temporarily, it must be kept private through Tailscale, SSH tunneling, VPN or Cloudflare Access.
