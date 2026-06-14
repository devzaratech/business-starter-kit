# Integration Patterns

The starter kit should treat integrations as adapters, not as hardcoded platform dependencies.

## Integration Categories

- ERP systems
- CMS platforms
- Billing providers
- Electronic signature providers
- Logistics providers
- Email providers
- Document storage providers
- AI providers

## Adapter Contract

Each integration should define:

- Configuration schema
- Credential storage requirements
- Health check
- Sync strategy
- Error handling strategy
- Retry policy
- Audit events

## n8n Usage

n8n is recommended for business workflow orchestration, especially when workflows are expected to change frequently.

Examples:

- Email ingestion
- File parsing
- Approval workflows
- Notifications
- External API orchestration

Critical business rules should remain in versioned application code when they require strong consistency or auditability.
