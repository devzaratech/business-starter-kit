# RBAC Strategy

Role-Based Access Control is a first-class platform capability. The reusable
primitives live in `packages/auth-rbac`.

## Core Concepts

| Concept | Meaning |
|---|---|
| User | An authenticated principal. |
| Tenant | A business customer / organization. |
| Membership | A user's relationship to a tenant. |
| Role | A named set of permissions within a tenant. |
| Permission | A single allowed action (e.g. `invoice:read`). |
| Policy | The rule that maps roles/permissions to a decision. |

## Permission Model

Use coarse-grained roles backed by fine-grained permissions:

```txt
Role: TenantAdmin   -> [tenant:*, user:*, audit:read, ...]
Role: Operator      -> [order:read, order:update, file:upload]
Role: Viewer        -> [order:read, report:read]
```

Permissions are checked, not roles. Roles are just bundles of permissions, which
keeps authorization stable when roles are renamed or restructured.

## Tenant Scoping

Every authorization decision is tenant-scoped. A permission grant is always
evaluated **within** a tenant context resolved by `packages/tenancy`. Cross-tenant
access is denied by default.

## Enforcement Points

- API boundary (Spring Boot core API) for synchronous requests.
- Integration services for webhook/automation actions.
- Database layer (Row-Level Security) when using the Supabase/PostgREST profile.

## Auditing

Authorization-relevant events (role assignment, permission change, tenant switch)
must emit audit events. See [Audit Logging Strategy](audit-logging-strategy.md).

## Testing Requirements

Every reusable RBAC rule must have tests covering allow, deny and
cross-tenant-denied cases.
