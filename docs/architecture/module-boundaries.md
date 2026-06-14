# Module Boundaries

The starter kit must keep platform primitives separate from business-specific products.

## Platform Core

The platform core owns reusable capabilities:

- Identity primitives
- Tenant primitives
- Permission primitives
- Audit primitives
- Storage contracts
- Integration contracts
- Observability contracts
- Deployment profiles

## Product Modules

Product modules own business-specific workflows:

- Logistics workflows
- CRM workflows
- ERP workflows
- Billing workflows
- CMS-backed portals
- Vertical reporting

## Rule

Do not put customer-specific logic into the platform core.

```txt
Good: storage provider interface
Bad: customer invoice upload workflow inside the core
```

## Recommended Dependency Direction

```txt
Business Product → Optional Module → Platform Core
```

The core must not depend on a specific product.
