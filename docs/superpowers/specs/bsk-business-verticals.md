# BSK Business Verticals & Solution Accelerators

**Status:** Proposed implementation specification — **not implemented**. **Business-domain code is blocked until engineering slices ES0–ES6 pass the Engineering Golden Path Baseline (EGPB) in the master plan.**  
**Scope:** `examples/crm-lite`, `examples/erp-lite`, `examples/operations-dashboard`, `examples/cms-backed-portal`  
**Source of delivery sequencing:** [BSK Agent Master Plan](../plans/2026-10-28-bsk-agent-master-plan.md)  
**Baseline:** Main branch inspection, 28 October 2026. Four example folders only contain README and `.gitkeep`. No functional business vertical is verified.

## 1. Product decision

A **business vertical** is a deployable reference product or solution accelerator that consumes public BSK Golden Path contracts and optional services. It is **not** a platform kernel module, environment, host, container profile, generic SaaS capability, or compliance jurisdiction pack.

Separate three layers:

1. **Platform:** hosts, projects, environments, services, domains, deployments, CI/CD, resources, secrets, RBAC, audit and monitoring.
2. **Golden Path:** reusable contracts, generator/templates and runtime reference implementations for Java, React, Angular, Node and optional adapters.
3. **Business vertical:** domain model, application logic, user flows, persistence, tests, fixture datasets and its own releases/pipeline, built upon the other layers.

**Dependency direction:** business vertical → public platform contracts/capabilities; never platform core → CRM/ERP/CMS/operations business logic. A business product can run without the BSK dashboard/CLI after deployment where technically feasible. No client-specific or proprietary workflow/data in this repository.

`examples/` remains the initial home for four sanitized example applications. Do not move folders or create a mandatory `verticals/` tree during documentation-only changes. A future ADR may split each product into an independently released repository/package. The presence of source or a README does not imply `GA`.

## 2. Contract for every vertical

The first implementation PR for each example must define a minimal **Vertical Definition** validated by a versioned schema, or justify reusing the existing `bsk.module.json` manifest schema without introducing incompatible fields.

Minimum metadata:
- stable `id`, display name, owner and domain purpose; license, version and support level (`Lab`, `Preview`, `GA`);
- explicit source repository/path, runtime profile(s), Golden Path/BSK compatibility and optional capabilities;
- services, ports, internal dependencies, persistent stores and migrations;
- resource baseline (CPU/memory/storage), `SecretRef` and deployment target capability requirements;
- required permissions, tenant isolation strategy, data classifications/retention policy references, optional jurisdiction packs;
- domain migrations, fixture policy, health probes, API contract location, CI pipeline reference and release artifact digest;
- whether it is `sample`, `reference` or `supported accelerator`; **never infer readiness from directory presence**.

Formal JSON Schema, CLI integration and catalog publication are later PR deliverables, after PR1/PR3 and the Golden Path contract stabilize. Prefer standard OpenAPI, JSON Schema, CloudEvents and OCI images rather than custom, opaque formats.

### Product boundary and data rules

- Own the product's domain logic and schema. Shared BSK capabilities provide authentication/authorization interfaces, tenancy conventions, audit contracts, storage integrations and telemetry; verticals implement the business semantics.
- Publish explicit OpenAPI contracts and, for events, versioned envelopes and schemas. Validate compatibility in CI.
- Use tenant-scoped queries and ownership checks for all endpoints, background workers, exports and event consumers; denial and cross-tenant leakage are **negative acceptance cases**.
- No development fixture may contain actual customers, contact information, credentials or sensitive business data. Synthetic names, emails on `example.test`, fake invoices and datasets only.
- Persist migrations with a deterministic upgrade/rollback assessment. Do not promise automatic rollback for destructive database migrations.
- Each vertical owns a release cycle, CI pipeline and deploy manifest; only validated shared libraries/contracts are reused.
- Services such as n8n, SeaweedFS, WordPress, Supabase, Kafka and AI are **opt-in**. A vertical cannot make them mandatory for BSK kernel installation.
- Privacy/retention and requests for data subjects must be supported technically where in scope, but jurisdictional legal compliance is **not automatically certified**.

## 3. Initial verticals: functional MVP definitions

### 3.1 CRM Lite — first complete end-to-end reference

**Purpose:** demonstrate reusable multi-tenant business SaaS and the full BSK Golden Path.

**MVP domain:** `Organization` (tenant), `UserMembership`, `Contact`, `Company`, `Lead`, `Opportunity` and `OpportunityStage`. Define IDs, ownership, required fields, uniqueness, contact linkage, audit trail and allowed status transitions. Do not implement a full Salesforce replacement.

**MVP user journey:**
1. Authenticated authorized user selects their organization.
2. Creates a company, a contact, a lead and converts/links the lead to an opportunity.
3. Updates stage and notes; sees changes in list/search and history.
4. Viewer cannot mutate; user from tenant B cannot read, search, export or modify tenant A.
5. Admin handles a demo data-subject request, with audit, retention/exception handling and no legal-compliance claim.

**Technology target:** Spring Boot + PostgreSQL + Flyway + OpenAPI; React + TypeScript as first UI, Angular as a second independently tested client **after** canonical API conformance is verified. Java 25 default where supported, with explicit Java 17/21 compatibility profiles where applicable.

**Evidence required:** migrations, backend/frontend code, CI per project, unit/integration/E2E/contract/tenant isolation tests, sample manifests, logs/traces with PII redaction, a release OCI digest, deploy to a disposable Compose environment, verified backup+restore and resource-limits inspection. Break into several PRs; do not deliver one giant scaffold.

### 3.2 CMS-backed Portal — content integration example

**MVP:** a public content listing/detail page, authenticated editorial access with roles, drafts, approval and publishing, sync/retry and visibility rules. WordPress REST as the first **optional** CMS adapter; MariaDB/MySQL is isolated from application PostgreSQL. Provide a local mock CMS for fast offline CI, plus an opt-in real WordPress integration test.

**Security:** least privilege editorial credentials, no public management panel by default, webhook signature/anti-replay when available, content sanitization, audit of who approved. An AI-assisted draft flow remains behind an explicit flag and cannot publish without the configured editorial approval.

**Acceptance:** one article progresses draft → review → publish through an integration test; disabling WordPress/AI does not break the BSK kernel or other projects.

### 3.3 Operations Dashboard — generic business data product

**MVP:** define a metric catalog, ingestion via a documented sample API/event adapter, validated time series/aggregates, date and tenant filters, CSV export by authorized role, freshness indication and error states. All fixtures are synthetic and vendor-neutral. Keep business KPIs separate from infrastructure observability: OTel/Grafana logs/traces are not automatically business transactions.

**Acceptance:** generate metrics from fixtures, compare aggregation against known totals, reject cross-tenant filters/exports, test empty/late/duplicate events and show data lineage/source timestamps.

### 3.4 ERP Lite — controlled domain slice, not an ERP suite

**MVP domain:** `Product`, `Warehouse`, `StockMovement`, `PurchaseOrder` and `SalesOrder` with minimal state machines, deterministic stock math, idempotency keys for order commands and audit. Choose **one workflow**, for example receiving stock and reserving/fulfilling a sales order, and implement it end-to-end.

**Explicit non-goals:** fiscal/official e-invoicing, accounting ledger, payroll, taxation, SAP connectors and real money movement; those need separate domain/legal specifications and must not be implied by the name `ERP Lite`.

**Acceptance:** concurrent reservations do not oversell; replayed commands do not double-adjust inventory; unauthorized tenants cannot see orders; reconciled movement sum equals displayed stock; migrations and restore tested.

## 4. Execution dependencies and stage gates

Do **not** start all four verticals in parallel. Work depends on common platform contracts, not on having every cloud capability finished.

| Work item | Precondition | Deliverable | Required evidence |
|---|---|---|---|
| **VRT0 — audit/catalog contracts** | PR0 architecture review and agreed Golden Path boundaries | Accurate `Lab/Preview/GA` inventory, Vertical Definition schema draft and ADR for module ownership | Catalog does not mark README-only examples as implemented |
| **VRT1 — CRM domain/API** | PR1 contracts + PR6 minimum runtime Golden Path | Domain model, Flyway, OpenAPI, auth/RBAC and tenant-safe APIs | Unit, integration, contract and cross-tenant negative tests |
| **VRT2 — CRM web + delivery** | CRM API + project CI/CD + Compose target | React UI, E2E, independent project pipeline, signed/identified release, resource policy and deployment | Real E2E, artifact digest, deploy/restore/runbook; Angular client as separate incremental PR |
| **VRT3 — CMS portal** | App templates + WordPress optional profile (PR10) | Editorial app and CMS adapter | Mock and real integration tests; approval permissions |
| **VRT4 — Operations Dashboard** | Stable app API and ingestion contracts (PR6/PR7) | Metric catalog, aggregation and UI | Known totals, duplicate/late data and cross-tenant tests |
| **VRT5 — ERP Lite** | Mature transaction/migration patterns from CRM | Purchase/stock/sales minimal workflow | Concurrency, idempotency, invariants and restore |

**PR sizing:** a VRT item is an epic; split it into small PRs with one reviewable vertical slice each. Avoid creating empty directories or manifest-only PRs presented as completed verticals. After shared contracts stabilize, independent verticals may run in parallel **on separate branches and files** with integration review.

**Current priority:** PR0/ES0, followed by engineering slices ES1–ES6 using non-business fixtures. The EGPB must pass before VRT1+ implementation. VRT0 documentation may proceed after PR0, but this specification is not permission to skip platform contracts, delivery or conformance.

## 5. Maturity and release policy

- **Lab:** documentation, mock, incomplete code or demonstrator without full conformance. All four examples currently meet only this classification at best; their current state is *documentation-only*.
- **Preview:** source code + migrations + a demonstrable user journey + deployed test environment + automated tests and known limitations; not production supported.
- **GA:** independently reviewed security and license inventory, stable versioned contracts, CI/CD and release ownership, reliable backup/restore, measurable observability, deployment/update/rollback runbook, privacy and threat-model checks applicable to the use case, tests on documented supported targets and maintained compatibility policy.
- A vertical must not be marked GA because its underlying infrastructure, Java framework or a dependency is GA.
- Keep `bsk.module.json` `supportLevel` and `capabilities.provides` truthful, and do not add them until the implementation satisfies the schema and the actual claims.

**Definition of Done per vertical slice:** acceptance tests pass against real implementation, negative authorization tests pass, operations are reproducible, synthetic fixtures are isolated, no secrets leak, documentation reflects actual state, and an independent reviewer signs off. Record skipped/unavailable tests explicitly.

## 6. Demo and business validation

Provide an explicit demo narrative for every vertical, including setup, seeded fictional tenant(s), HTTP/UI flow, deliberate failure, metrics/traces, rollback or recovery step and teardown. A prospective user should be able to reproduce the walkthrough on a disposable VPS/Compose environment without access to the author's private services or Tailnet.

Measure: time to first successful deployment, cost and CPU/memory footprint, developer setup steps, time to add a new field/API/UI change, test coverage of tenant permissions and recovery behavior. These metrics should inform priorities instead of counting frameworks in a README.

## 7. Instructions for agents

1. Read [AGENTS.md](../../../AGENTS.md), the [master plan](../plans/2026-10-28-bsk-agent-master-plan.md), existing ADRs and actual code.
2. For any vertical, first report the real implementation status, supported features, required shared interfaces and the smallest meaningful user journey.
3. Work on a branch; submit PRs with bounded scope and tests. No real VPS, DNS, Tailnet, cloud accounts, production databases, or third-party APIs without specific authorization.
4. Do not create real customer data, run external AI publishing, purchase services or change repo visibility.
5. Stop at the assigned PR stage. Never declare a vertical functional merely because its README, manifest or Dockerfile exists.
