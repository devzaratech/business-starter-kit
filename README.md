# Business Starter Kit

Business Starter Kit is a private, sanitized, modular and scalable SaaS foundation for building business applications.

It is designed to start lean on a low-cost VPS with Docker Compose, while keeping a clean evolution path toward enterprise-grade deployments with multi-tenancy, RBAC, audit logs, pluggable storage, database adapters, automation workflows, CMS/ERP integrations and cloud profiles for AWS, Azure and GCP.

## Core Principles

- Start lean, scale safely.
- Keep the platform core separated from business products.
- Keep business-specific implementations outside the core.
- Prefer modular adapters over hardcoded providers.
- Use PostgreSQL as the canonical source of truth.
- Support optional providers such as Supabase, PostgREST, MongoDB and S3-compatible storage.
- Design for multi-tenancy, auditability and enterprise integration from day one.
- Keep the repository sanitized: no customer names, no production secrets, no proprietary business data.

## Repository Layout

```txt
business-starter-kit/
├── apps/                  # Deployable applications and services
├── packages/              # Shared platform modules
├── infra/                 # Docker, reverse proxy and cloud infrastructure profiles
├── supabase/              # Supabase/PostgREST migrations, policies and functions
├── n8n/                   # Workflow automation exports and credential templates
├── docs/                  # English documentation
├── examples/              # Sanitized example products built on top of the platform
└── scripts/               # Developer and operational scripts
```

## Initial Target

The first milestone is a deployable multi-tenant SaaS skeleton with:

- Spring Boot API
- NodeJS integration service
- Web application shell
- PostgreSQL
- Redis
- SeaweedFS S3-compatible storage
- n8n automation
- Supabase/PostgREST optional profile
- RBAC foundations
- Audit log foundations
- Tenant context foundations
- English documentation

## Quick Start

```bash
cp .env.example .env
docker compose -f infra/compose/docker-compose.vps.yml up -d
```


## Quality and Delivery

Business Starter Kit includes CI/CD and unit testing scaffolding from day one.

```bash
make test
make test-spring
make test-node
make validate-compose
```

The default CI pipeline validates Spring Boot tests, NodeJS/web/worker tests and Docker Compose configuration. Deployment workflows are environment-aware and prepared for Dev, QA, UAT, Staging and Prod.

## Git Initialization

```bash
git init
git add .
git commit -m "chore: initialize business starter kit structure"
```

## Documentation Index

- [Architecture Overview](docs/architecture/architecture-overview.md)
- [Module Boundaries](docs/architecture/module-boundaries.md)
- [VPS Docker Compose Deployment](docs/deployment/vps-docker-compose.md)
- [Security Baseline](docs/security/security-baseline.md)
- [Multi-Tenancy Strategy](docs/tenancy/multi-tenancy-strategy.md)
- [Integration Patterns](docs/integrations/integration-patterns.md)
- [Cloud Profiles](docs/cloud-profiles/cloud-profiles-overview.md)
- [Operations Runbook](docs/operations/operations-runbook.md)
- [Environment Strategy](docs/environments/README.md)
- [CI/CD Strategy](docs/ci-cd/ci-cd-strategy.md)
- [Unit Testing Strategy](docs/ci-cd/unit-testing-strategy.md)
- [Quality Gates](docs/ci-cd/quality-gates.md)
```
