# DEV Cloudflare-ready checkpoint

Date: 2026-06-29

Public DEV URL:
- https://bsk-dev.devzaratech.xyz

Status:
- Web: OK
- Spring API: OK
- Node API: OK
- Cloudflare proxy: OK
- Caddy reverse proxy: OK
- HTTPS: OK
- Security headers: OK

Health checks:
- https://bsk-dev.devzaratech.xyz/
- https://bsk-dev.devzaratech.xyz/api/actuator/health
- https://bsk-dev.devzaratech.xyz/api/node/health

Architecture:
User -> Cloudflare -> Caddy -> Docker services

Notes:
- Use flat environment domains for Cloudflare Universal SSL compatibility:
  - bsk-dev.devzaratech.xyz
  - bsk-qa.devzaratech.xyz
  - bsk-uat.devzaratech.xyz
  - bsk-staging.devzaratech.xyz
  - bsk-prod.devzaratech.xyz
