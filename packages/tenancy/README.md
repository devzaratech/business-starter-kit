# Tenancy Package

Tenant resolution and tenant context primitives.

Responsibilities:

- Resolve tenant from hostname, header, token or explicit context.
- Make tenant context available to downstream modules.
- Prevent cross-tenant data access.
