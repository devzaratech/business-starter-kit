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

```bash
cp .env.example .env
docker compose -f infra/compose/docker-compose.vps.yml up -d
```

## Stop Infrastructure

```bash
docker compose -f infra/compose/docker-compose.vps.yml down
```

## Production Notes

Before production use:

- Replace all default passwords.
- Disable public ports for private services.
- Put administration services behind a private network or VPN.
- Use TLS at the reverse proxy layer.
- Configure backups.
- Configure log retention.
- Define tenant isolation strategy.
