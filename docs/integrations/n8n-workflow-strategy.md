# n8n Workflow Automation Strategy

n8n is the recommended tool for business workflow orchestration, especially for
workflows that change frequently and do not require strong transactional
guarantees.

## Good Fit for n8n

- Email ingestion and parsing.
- Notifications (chat, email, webhooks).
- Approval and review flows.
- External API orchestration and glue logic.
- Scheduled data syncs.

## Keep in Application Code

- Business rules requiring strong consistency or auditability.
- Authorization and tenant-isolation decisions.
- Anything that must be versioned, tested and promoted as code.

## Repository Assets

| Path | Purpose |
|---|---|
| `automation/n8n/workflows/` | Sanitized, generic workflow exports. |
| `automation/n8n/credentials.example/` | Credential templates (never real secrets). |

## Rules

- Never commit real credentials or customer-specific workflow names.
- Keep exported workflows generic and environment-driven.
- Document the environment variables each workflow needs.
- Treat n8n as orchestration, not as the system of record.

## Runtime

n8n runs in the default Compose stack, backed by the shared PostgreSQL database.
In production, place the n8n admin UI behind a private network or VPN.
