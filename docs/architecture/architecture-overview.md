# Architecture Overview

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

## Provider Strategy

Providers must be implemented behind interfaces and adapters.

Examples:

- Storage: SeaweedFS, AWS S3, Azure Blob Storage, GCP Cloud Storage
- Database: PostgreSQL canonical, Supabase/PostgREST optional, MongoDB optional
- Automation: n8n workflow profile
- Cloud: VPS, AWS, Azure, GCP
