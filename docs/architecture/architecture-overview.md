# Architecture Overview

For the source-audited implementation status, proposed resource contracts and
ES1–ES6 acceptance gates, see the [PR0 / ES0 review](es0/README.md). The target
capabilities described below are not all implemented; that review distinguishes
working examples, incomplete components and planned behavior.

Business Starter Kit is a modular SaaS foundation designed around a clean separation between platform capabilities and business products.

## Architecture Goal

The goal is to allow a product to start on a low-cost VPS with Docker Compose, while preserving a clear path toward enterprise-grade infrastructure.

## High-Level Components

```txt
Users
  ↓
Web Application
  ↓
API Gateway / Reverse Proxy
  ↓
Spring Boot Core API ── PostgreSQL
  ↓                  └─ Redis
NodeJS Integration Services
  ↓
n8n Automation Workflows
  ↓
Storage Providers / ERP / CMS / External APIs
```

The diagram above describes the current runnable stack. It is not the dependency model for the long-term Golden Path.

## Golden Path governance

Governed modules carry a `bsk.module.json` manifest. The first executable dependency direction is:

```txt
Products → Profiles → Runtimes → Capabilities → Kernel → Contracts
```

The initial Foundation Guardrails checkpoint catalogs the existing `apps/` and selected `packages/` in place. It does not physically migrate the repository into the final conceptual directory model.

Architecture rules are executable through:

```bash
npm run architecture:test
npm run architecture:check
```

## Core Platform Capabilities

- Authentication
- RBAC and policy enforcement
- Tenant resolution
- Audit logging
- Storage abstraction
- Integration abstraction
- Observability
- Configuration profiles
- Deployment profiles

The current governed core seed is intentionally limited to `core-domain`, `tenancy`, `auth-rbac` and `audit`. Other existing packages remain outside the first governed checkpoint until their contracts and conformance expectations are explicitly defined.

## Runtime strategy

Current runnable/reference runtimes include Spring Boot, Node/Express, FastAPI, PHP, a Node worker and a React reference client. They are classified as `Preview`; being present and runnable does not imply Golden Path conformance or GA support.

## Provider Strategy

Providers must be implemented behind interfaces and adapters.

Examples:

- Storage: SeaweedFS, AWS S3, Azure Blob Storage, GCP Cloud Storage
- Database: PostgreSQL canonical, Supabase/PostgREST optional, MongoDB optional
- Automation: n8n workflow profile
- Cloud: VPS, AWS, Azure, GCP

## Open-core rule

The BSK core is Apache-2.0 / F1. Public modules must never depend on private
modules. An F1 supported required path must never require F2/F3. Optional public
integrations may cross Freedom Classes only within the explicit
[dependency policy](module-boundaries.md#explicit-edge-policy); the core still
cannot depend on runtime/provider implementations. Each module must declare
its actual license independently of visibility and maturity.
