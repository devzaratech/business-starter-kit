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
├── automation/            # Workflow automation assets such as n8n workflows
├── data/                  # Database provider profiles and data-layer strategy
├── supabase/              # Supabase CLI profile, migrations, policies and functions
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


## Supabase Studio Workflow

Supabase Studio is managed through environment profiles. Do not edit `supabase/config.toml` manually when switching environments.

```bash
make supabase-start ENV=dev
make supabase-studio
make supabase-studio-disable ENV=dev
```

Production Studio is disabled by default and requires explicit confirmation before it can be enabled:

```bash
CONFIRM_SUPABASE_PROD_STUDIO=yes make supabase-studio-enable ENV=prod
```

See [Supabase Studio](docs/database/supabase-studio.md).

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

## Running the Full Stack (Apps Included)

The lean default above starts only the shared infrastructure (PostgreSQL, Redis,
SeaweedFS, n8n) so the stack stays cheap and fast on a small VPS. To also build
and run the application services (Spring Boot API, Node integration service, web
app, worker) behind the reverse proxy, enable the `apps` Compose profile:

```bash
make up-full
# or
docker compose -f infra/compose/docker-compose.vps.yml --profile apps up -d
```

## Documentation Index

### Getting Started
- [Local Development](docs/development/local-development.md)
- [Environment Strategy](docs/environments/README.md)
- [Port Convention](docs/environments/port-convention.md)
- [Troubleshooting Guide](docs/operations/troubleshooting.md)

### Architecture
- [Architecture Overview](docs/architecture/architecture-overview.md)
- [Module Boundaries](docs/architecture/module-boundaries.md)
- [Repository Map](docs/architecture/repository-map.md)
- [Enterprise Growth Path](docs/architecture/enterprise-growth-path.md)

### Delivery & Quality
- [CI/CD Strategy](docs/ci-cd/ci-cd-strategy.md)
- [Jenkins Strategy](docs/ci-cd/jenkins-strategy.md)
- [SonarQube Strategy](docs/ci-cd/sonarqube-strategy.md)
- [Unit Testing Strategy](docs/ci-cd/unit-testing-strategy.md)
- [Quality Gates](docs/ci-cd/quality-gates.md)
- [Release Strategy](docs/release/release-strategy.md)

### Deployment & Operations
- [VPS Docker Compose Deployment](docs/deployment/vps-docker-compose.md)
- [Cloud Profiles](docs/cloud-profiles/cloud-profiles-overview.md)
- [Operations Runbook](docs/operations/operations-runbook.md)

### Security & Tenancy
- [Security Baseline](docs/security/security-baseline.md)
- [Secrets Management](docs/security/secrets-management.md)
- [RBAC Strategy](docs/security/rbac-strategy.md)
- [Audit Logging Strategy](docs/security/audit-logging-strategy.md)
- [Multi-Tenancy Strategy](docs/tenancy/multi-tenancy-strategy.md)

### Data & Storage
- [Database Provider Strategy](docs/database/database-provider-strategy.md)
- [Supabase / PostgREST Optional Profile](docs/database/supabase-postgrest-profile.md)
- [Supabase Studio](docs/database/supabase-studio.md)
- [MongoDB Optional Profile](docs/database/mongodb-optional-profile.md)
- [MS SQL Server Optional Profile](docs/database/mssql-optional-profile.md)
- [Oracle Optional Profile](docs/database/oracle-optional-profile.md)
- [Storage Provider Strategy](docs/storage/storage-provider-strategy.md)

### Integrations & Automation
- [Integration Patterns](docs/integrations/integration-patterns.md)
- [n8n Workflow Strategy](docs/integrations/n8n-workflow-strategy.md)
- [CMS / ERP Integration Strategy](docs/integrations/cms-erp-integration-strategy.md)
