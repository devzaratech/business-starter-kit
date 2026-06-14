# Multi-Tenancy Strategy

The starter kit should support multiple tenant isolation strategies without forcing a single model too early.

## Tenant Concepts

- Tenant: a business customer or organization.
- User: a person with access to one or more tenants.
- Membership: relationship between a user and a tenant.
- Role: a named permission group within a tenant.
- Permission: a specific action allowed by policy.

## Isolation Options

### Shared Database, Shared Schema

Best for lean deployments and early SaaS products.

- Lowest cost
- Simple operations
- Requires strict tenant filtering

### Shared Database, Separate Schema

Good for stronger logical isolation.

- More complex migrations
- Better tenant-level separation

### Separate Database per Tenant

Good for enterprise tenants.

- Strong isolation
- Higher operational cost
- More complex provisioning

## Initial Recommendation

Start with shared database and shared schema, but design tenant context and query filtering so the platform can evolve later.
