# DEV Cloudflare-ready checkpoint

Date: 2026-06-29

Public DEV URL:
- https://bsk-dev.devzaratech.xyz

Health checks:
- https://bsk-dev.devzaratech.xyz/
- https://bsk-dev.devzaratech.xyz/api/actuator/health
- https://bsk-dev.devzaratech.xyz/api/node/health

Status:
- Web: OK
- Spring API: OK
- Node API: OK
- Caddy reverse proxy: OK
- Cloudflare proxy: OK
- HTTPS: OK
- Security headers: OK

Architecture:
User -> Cloudflare -> Caddy -> Docker services

Environment domains:
- bsk-dev.devzaratech.xyz
- bsk-qa.devzaratech.xyz
- bsk-uat.devzaratech.xyz
- bsk-staging.devzaratech.xyz
- bsk-prod.devzaratech.xyz

Notes:
- Flat subdomains are used for Cloudflare Universal SSL compatibility.
- Cloudflare SSL/TLS mode should be Full strict.
- HSTS remains disabled while environments are still being stabilized.
- n8n should run on version 1.121.0 or higher.
