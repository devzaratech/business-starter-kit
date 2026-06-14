# Operations Runbook

This runbook contains operational guidelines for the starter kit.

## Daily Checks

- Check container health.
- Check disk usage.
- Check database backups.
- Check error logs.
- Check failed workflow executions.

## Useful Commands

```bash
docker compose -f infra/compose/docker-compose.vps.yml ps
docker compose -f infra/compose/docker-compose.vps.yml logs -f
docker system df
```

## Incident Principles

- Do not change DNS ownership without a rollback plan.
- Preserve logs before restarting critical services.
- Identify whether the issue is application, network, DNS, storage or database related.
- Write down every manual change applied during the incident.
