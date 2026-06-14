# Unit Testing Strategy

Unit testing is mandatory for the platform core and strongly recommended for every product module.

## Test Layers

| Layer | Purpose | Example Tooling |
|---|---|---|
| Unit tests | Validate isolated functions, services and domain rules | JUnit, Node.js test runner |
| Integration tests | Validate database, storage, queues and external adapter behavior | Testcontainers, Docker Compose |
| Contract tests | Validate API contracts between services and adapters | OpenAPI, schema tests |
| End-to-end tests | Validate critical user flows | Playwright or equivalent |

This repository starts with unit test scaffolding. Integration, contract and end-to-end tests should be added progressively as modules become real.

## Initial Test Targets

```bash
make test
make test-spring
make test-node
```

## Minimum Policy

Every reusable package should have tests for:

- Tenant resolution rules.
- Permission and RBAC decisions.
- Audit event construction.
- Storage provider selection.
- Integration adapter mapping.
- Environment configuration parsing.

## Test Data Rule

Never use real customer data in tests. Use synthetic, anonymized or generated fixtures only.
