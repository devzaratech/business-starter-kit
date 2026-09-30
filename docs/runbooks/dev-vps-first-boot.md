# DEV VPS First Boot

Date: 2026-06-29

Status:
- Postgres: OK
- Redis: OK
- SeaweedFS: OK
- n8n: OK
- api-node: OK
- worker: OK
- api-spring: OK
- web: OK
- reverse-proxy: OK

Environment:
- config/env/.env.dev
- infra/compose/docker-compose.dev.yml
- profile: apps

Local URL:
- http://127.0.0.1:11080

Public DEV URL:
- http://dev.bsk.devzaratech.xyz:11080

Notes:
- Redis requires vm.overcommit_memory=1 on the host.
- n8n recommends N8N_RUNNERS_ENABLED=true.
- n8n recommends N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true.
