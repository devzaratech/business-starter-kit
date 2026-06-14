# Audit Logging Strategy

Audit logging records who did what, to which resource, in which tenant, and when.
The reusable primitives live in `packages/audit`.

## Audit Event Shape

| Field | Description |
|---|---|
| `tenant_id` | Tenant the action occurred in. |
| `actor_user_id` | User (or service principal) who performed the action. |
| `action` | Verb-style action name (e.g. `role.assigned`). |
| `resource_type` | Type of the affected resource. |
| `resource_id` | Identifier of the affected resource. |
| `metadata` | Structured, non-sensitive context (JSON). |
| `created_at` | Server-side timestamp. |

A matching table is provided in `supabase/migrations/0001_initial_platform_schema.sql`
(`platform.audit_events`).

## Events to Audit

Login success/failure, password reset, role assignment, permission change,
tenant switch, data export, file upload/download, API key creation/revocation,
and integration credential updates.

## Rules

- Audit records are **append-only** where possible; never update or delete in place.
- Never store secrets, passwords or raw tokens in `metadata`.
- Audit writes must not block the primary request path; prefer asynchronous,
  durable publishing for high-volume actions.
- Audit data is tenant-scoped and only readable by authorized roles.

## Retention

Define retention per environment and per compliance need. Production retention
should be longer and backed up; lower environments can expire quickly.
