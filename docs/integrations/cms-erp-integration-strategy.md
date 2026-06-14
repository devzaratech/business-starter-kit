# CMS / ERP Integration Strategy

CMS and ERP systems are integrated as **adapters behind contracts**, never as
hardcoded platform dependencies. The reusable contracts live in
`packages/integrations`.

## Integration Direction

```txt
Business Product -> Integration Adapter -> External CMS / ERP
```

The platform core never depends on a specific CMS or ERP product.

## Adapter Contract

Each integration adapter defines:

- Configuration schema (endpoints, scopes, identifiers).
- Credential storage requirements (always from the secret store).
- Health check.
- Sync strategy (push, pull, or event-driven).
- Error handling and retry policy.
- Audit events for sensitive operations.

## CMS Patterns

- Use a CMS to power business-facing content while the platform core owns
  identity, tenancy and permissions.
- Treat CMS content as data; do not let CMS-specific structures leak into the
  platform core.

## ERP Patterns

- Prefer event-driven or scheduled syncs over tight coupling.
- Map external ERP entities to platform-neutral domain objects in the adapter.
- Keep idempotency keys so retries do not duplicate records.

## Rules

- No customer-specific ERP/CMS logic in the platform core or in committed examples.
- Keep adapters generic and configuration-driven.
