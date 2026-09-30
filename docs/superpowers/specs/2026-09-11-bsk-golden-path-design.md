# Business Starter Kit (BSK) Golden Path Architecture Design

**Status:** Approved design, pending repository review  
**Date:** 2026-09-11  
**Project:** Business Starter Kit (BSK)  
**Repository target:** `devzaratech/business-starter-kit`  
**Design class:** Architectural  

## 1. Purpose

Business Starter Kit (BSK) is a polyglot, open-core, schema-first, provider-neutral software platform for creating production-ready applications and integrations without forcing a single programming language, cloud, database, deployment target, or proprietary vendor.

BSK exists to provide a **Golden Path**: a paved, testable, observable and secure route from developer intent to a deployable production system, while preserving escape hatches and explicit extension points.

The Golden Path is not a preferred technology stack. It is a set of contracts, quality guarantees, conformance rules and operational behaviors that multiple stacks can implement.

The governing principle is:

> **BSK prescribes contracts, quality and behavior; it does not unnecessarily prescribe providers, languages or infrastructure.**

A second principle governs developer experience:

> **Pave the road, but do not build walls around it.**

## 2. Design goals

BSK SHALL:

- remain polyglot by design;
- allow Java, Node.js, Python, PHP and future runtimes such as .NET to participate through the same platform contracts;
- make provider lock-in an explicit deployment choice rather than an architectural accident;
- support OSS and proprietary extensions without allowing proprietary code to contaminate the OSS core;
- make runtime and deployment compatibility verifiable through conformance tests;
- provide security, privacy and observability as baseline architecture concerns rather than late additions;
- make production readiness inspectable and explainable;
- support local, VPS, cloud and enterprise integration use cases without making any one of them mandatory;
- remain usable without the BSK CLI, even though the CLI is the preferred developer entry point;
- enable products such as OpenFiscal to run on BSK without making them dependent on BSK internals.

## 3. Non-goals

BSK SHALL NOT:

- become a universal abstraction that pretends PostgreSQL, Redis, Kafka, MongoDB and object storage are equivalent;
- require Kubernetes to be considered production-ready;
- require AWS, Azure or GCP to operate;
- treat React, Spring Boot, Grafana, SAP or any other concrete tool as part of the kernel;
- implement proprietary cryptography;
- claim legal compliance merely because a compliance pack is installed;
- make all supported technologies equally mature;
- require all modules in the monorepo to share one release version or lifecycle;
- generate opaque code that cannot be understood without the generator;
- hide architectural decisions behind proprietary configuration formats when standard formats are available.

---

# Part I — Fundamental Architecture

## 4. Architectural shape

BSK SHALL use a **minimal kernel + curated profiles + optional capabilities/packs** model.

```text
                         BUSINESS STARTER KIT

┌─────────────────────────────────────────────────────────────┐
│                       PUBLIC CONTRACTS                      │
│ OpenAPI · JSON Schema · CloudEvents · OTel conventions     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                     ┌─────────▼─────────┐
                     │    BSK KERNEL     │
                     │                   │
                     │ errors            │
                     │ config ports      │
                     │ secret ports      │
                     │ identity basics   │
                     │ security baseline │
                     │ telemetry         │
                     │ conformance       │
                     └─────────┬─────────┘
                               │
              ┌────────────────┼─────────────────┐
              ▼                ▼                 ▼
          web-api         async-worker       integration
           profile           profile           profile
              │                │                 │
              └────────────────┼─────────────────┘
                               │
             ┌─────────────────▼──────────────────┐
             │             CAPABILITIES           │
             │ tenancy · RBAC · audit · events    │
             │ workflow · storage · notifications │
             │ privacy · analytics · AI · offline │
             └─────────────────┬──────────────────┘
                               │
            ┌──────────────────┼───────────────────┐
            ▼                  ▼                   ▼
       Runtime impl.      Provider adapters    Optional packs
     Java/Node/Python    DB/cloud/SAP/etc.    compliance/etc.
```

## 5. Dependency rules

The following rules are architectural invariants:

1. `kernel` SHALL NOT depend on runtime frameworks, cloud SDKs, databases, Grafana, SAP, OpenFiscal or private components.
2. Canonical public contracts SHALL be the source of truth. Runtime implementations SHALL NOT redefine them independently.
3. A runtime implements BSK capabilities; capabilities do not belong to a runtime.
4. Adapters depend on BSK ports/contracts. The core SHALL NOT depend on adapters.
5. OSS components SHALL NOT require private components.
6. Private components MAY depend on public BSK extension contracts.
7. OpenFiscal and other products MAY consume BSK, but BSK SHALL NOT know those products.
8. Compatibility SHALL be demonstrated through conformance, not asserted only in documentation.
9. Deployment environment and deployment target SHALL remain separate concepts.
10. Provider-specific dependencies SHALL be explicit and localized.

## 6. Freedom Class and Support Level

A single tier SHALL NOT represent license freedom and maturity at the same time.

### 6.1 Freedom Class

| Class | Meaning |
|---|---|
| **F1 — Open** | Open-source / openly usable technology with no mandatory proprietary license dependency for the supported path. |
| **F2 — Vendor-associated** | Technology with meaningful vendor-specific constraints, proprietary components or commercial coupling. |
| **F3 — Proprietary / licensed** | Strong proprietary dependency, commercial licensing or closed enterprise ecosystem. |

Each module SHALL also record its **exact license**, because F1 does not imply all OSS licenses are operationally equivalent.

### 6.2 Support Level

| Level | Meaning |
|---|---|
| **GA** | Stable, documented, maintained, versioned and passing all required gates. |
| **Preview** | Architecture accepted, but one or more guarantees, docs, interoperability paths or operational validations are incomplete. |
| **Lab** | Experimental, educational, PoC or intentionally unstable. Breaking changes are expected. |

A technology can move from Lab → Preview → GA without changing Freedom Class.

A product requiring a Lab component MUST declare that risk explicitly.

---

# Part II — Repository and Module Boundaries

## 7. Monorepo strategy

BSK SHALL remain a **modular monorepo with publishable/extractable boundaries**.

The monorepo shares history and simplifies refactoring, interoperability and conformance. It SHALL NOT force all modules to share one release version or deployment lifecycle.

Recommended conceptual layout:

```text
business-starter-kit/
│
├── contracts/
│   ├── http/
│   ├── events/
│   ├── schemas/
│   ├── observability/
│   ├── security/
│   ├── integration/
│   └── config/
│
├── kernel/
│   ├── errors/
│   ├── identity/
│   ├── config/
│   ├── secrets/
│   ├── telemetry/
│   └── security/
│
├── capabilities/
│   ├── tenancy/
│   ├── auth-rbac/
│   ├── audit/
│   ├── event-bus/
│   ├── workflow/
│   ├── storage/
│   ├── notifications/
│   ├── analytics/
│   ├── ai/
│   └── offline/
│
├── runtimes/
│   ├── java/
│   ├── node/
│   ├── python/
│   ├── php/
│   └── dotnet/
│
├── adapters/
│   ├── databases/
│   ├── messaging/
│   ├── storage/
│   ├── identity/
│   ├── secrets/
│   ├── cloud/
│   └── enterprise/
│       ├── generic/
│       └── sap/
│
├── profiles/
│   ├── web-api/
│   ├── async-worker/
│   ├── integration-service/
│   └── full-platform/
│
├── compliance/
│   ├── kernel/
│   ├── jurisdictions/
│   └── sectors/
│
├── observability/
│   ├── otel/
│   ├── prometheus/
│   ├── loki/
│   ├── tempo/
│   └── grafana/
│
├── conformance/
│   ├── runtime/
│   ├── contracts/
│   ├── security/
│   └── deployment/
│
├── deployment/
│   ├── compose/
│   │   ├── base/
│   │   ├── profiles/
│   │   └── overlays/
│   ├── kubernetes/
│   ├── opentofu/
│   └── targets/
│
├── extension-contracts/
├── cli/
├── ci/
├── examples/
└── docs/
```

`extension-contracts/` contains **public** extension points used by OSS and private implementations. Private implementation code itself SHALL live outside the OSS repository unless intentionally open-sourced.

## 8. Module metadata

Publishable modules SHOULD declare machine-readable metadata containing at least:

- module name;
- module version;
- BSK platform compatibility range;
- Freedom Class;
- Support Level;
- exact software license;
- required public contracts/capabilities;
- optional capabilities;
- forbidden dependency categories where useful;
- conformance level/status.

The exact manifest format is implementation-phase work; this design requires the capability, not a specific YAML schema.

---

# Part III — Canonical Contracts and Polyglot Conformance

## 9. Schema-first contracts

BSK SHALL use canonical, vendor-neutral contracts:

| Concern | Canonical form |
|---|---|
| HTTP APIs | OpenAPI |
| Payload/config schemas | JSON Schema |
| Events | CloudEvents-compatible envelope + versioned schemas |
| Telemetry | OpenTelemetry + BSK semantic conventions |
| gRPC/Protobuf | Optional capability, not universal core requirement |

Generated SDK/client code SHALL NOT become the canonical source of truth.

## 10. Runtime contract

A runtime reaches GA only by satisfying the required profile and conformance suite.

The baseline runtime contract includes, as applicable:

### Platform
- canonical error model;
- configuration contract;
- SecretProvider integration;
- liveness/readiness/health semantics;
- graceful startup/shutdown.

### HTTP
- OpenAPI compatibility;
- request/correlation identifiers;
- validation;
- versioning conventions;
- standardized errors.

### Security
- authentication hooks;
- RBAC integration;
- secure defaults;
- secret redaction;
- supply-chain/security gates.

### Tenancy
- tenant propagation;
- isolation conventions;
- no implicit global tenant assumption.

### Events
- CloudEvents-compatible envelope;
- schema validation;
- correlation/causation IDs;
- idempotency support.

### Observability
- OpenTelemetry instrumentation;
- structured logs;
- metrics;
- traces;
- service/environment/version metadata;
- privacy-safe telemetry.

### Quality
- unit tests;
- integration tests;
- contract tests;
- conformance tests;
- SBOM;
- license metadata;
- vulnerability gates.

## 11. Curated profiles

Profiles define coherent capability baselines without forcing all features into every service.

### `web-api`
Typical required capabilities:

- kernel;
- HTTP contract;
- security baseline;
- observability;
- config/secrets;
- canonical error model.

### `async-worker`
Typical required capabilities:

- kernel;
- events;
- idempotency;
- observability;
- config/secrets;
- graceful shutdown.

### `integration-service`
Adds:

- timeouts;
- retry/backoff/jitter;
- circuit breaker;
- bulkhead where appropriate;
- DLQ/recovery;
- reconciliation;
- integration observability;
- recovery runbook.

Profiles SHALL be versioned.

## 12. Conformance

Conformance SHALL be executable and versioned.

Illustrative checks:

```text
HTTP contract            PASS
Event envelope           PASS
Schema compatibility     PASS
Correlation propagation  PASS
Tenant propagation       PASS
Error model              PASS
Telemetry attributes     PASS
Privacy redaction        PASS
Security baseline        PASS
```

Interoperability tests SHALL verify real cross-runtime behavior, for example:

- Java publishes an event consumed by Python;
- Node publishes an event consumed by Java;
- React client consumes an OpenAPI contract implemented by multiple backends.

Polyglot support is considered real only when cross-runtime interoperability is demonstrated.

---

# Part IV — Open Core and Enterprise Extensibility

## 13. Open-core rule

BSK SHALL use an explicit open-core model:

> **The OSS core SHALL NOT depend on proprietary components. Proprietary components MAY depend on public OSS contracts.**

Any extension point required by a private component MUST be public, documented and testable if it represents a genuinely general platform need.

Private customer/vendor details SHALL NOT leak into kernel or generic capability contracts.

## 14. Enterprise Integration Layer

BSK SHALL define a generic Enterprise Integration Layer even before all enterprise adapters exist.

Representative adapters may include:

```text
enterprise-integrations/
├── generic-rest/
├── odata/
├── sap/
├── dynamics/
├── salesforce/
└── servicenow/
```

SAP begins as **F3 / Lab**.

Possible SAP adapters include S/4HANA, BTP, OData, IDoc and RFC bridges. Exact adapters are post-v1 implementation work.

The core SHALL NOT contain SAP-specific branching.

---

# Part V — Configuration, Secrets and Security

## 15. Configuration and secrets

BSK SHALL treat configuration and secrets as separate concerns.

### ConfigProvider
Possible implementations:

- environment variables;
- configuration files;
- Kubernetes ConfigMaps;
- remote configuration providers.

### SecretProvider
Possible implementations:

- environment/local development;
- Vault;
- AWS Secrets Manager;
- Azure Key Vault;
- Google Secret Manager;
- Kubernetes Secrets;
- other compatible providers.

Rules:

- real secrets SHALL NOT be committed to Git;
- examples SHALL contain fictional values only;
- required configuration SHALL be validated at startup;
- secrets SHALL be redacted from logs/telemetry;
- production guidance SHALL favor real secret providers rather than giant `.env` files;
- secret rotation SHALL be possible without changing business code.

## 16. Security model

BSK SHALL separate:

```text
Identity       → who is the actor
Authentication → how identity is proven
Authorization  → what the actor may do
Tenant Context → for which organization/context
Audit          → what happened
Policy         → rules that produced the decision
```

Kernel primitives may include:

- Principal;
- ActorId;
- TenantId;
- Role;
- Permission;
- Scope;
- SecurityContext;
- PolicyDecision.

The kernel SHALL NOT depend on a specific identity provider.

OIDC/OAuth2/JWT may be used where appropriate, but JWT SHALL NOT be treated as the only possible security mechanism.

## 17. Authorization

Initial authorization support:

- RBAC — baseline/GA target;
- scopes — baseline/GA target;
- ABAC — Preview target;
- external/general policy engine — optional.

The backend remains the authorization boundary. Client-side permission handling is UX only.

## 18. Multi-tenancy

Tenant context SHALL be explicit and propagated through HTTP, application commands, repositories and events.

BSK SHOULD support multiple physical isolation strategies:

- shared database/shared schema;
- shared database/schema-per-tenant;
- database-per-tenant;
- deployment-per-tenant.

Modules SHALL declare supported isolation modes.

Conformance SHALL include negative isolation tests proving that Tenant B cannot access Tenant A data.

Defense in depth MAY include:

- application policies;
- repository filters;
- database RLS where supported;
- storage namespaces;
- cache namespaces.

## 19. Service-to-service security

Internal network location SHALL NOT imply trust.

Production-capable patterns SHOULD support:

- service/workload identity;
- mTLS where justified;
- short-lived credentials;
- audience validation;
- least privilege.

## 20. Cryptography

BSK SHALL define capabilities such as:

- EncryptionPort;
- KeyProvider;
- SigningPort;
- HashingPolicy.

BSK SHALL NOT implement custom cryptographic algorithms.

Production key material SHOULD be provided by Vault/KMS/HSM or equivalent provider capabilities.

## 21. Audit is not logging

Operational logs and business/security audit trails SHALL remain distinct.

Audit records may include actor, tenant, action, previous/new state, timestamp and evidence metadata, subject to privacy policy.

Audit retention, integrity and access policies MAY be stricter than logging policies.

---

# Part VI — Data, Storage, Messaging and Consistency

## 22. Capability-oriented data architecture

BSK SHALL abstract capabilities, not erase technology semantics.

Representative families:

```text
RelationalStore
DocumentStore
KeyValueCache
ObjectStore
SearchIndex
AnalyticalStore
MessageBroker
```

Business/application code SHOULD request domain ports such as `InvoiceRepository`, `EvidenceStore` or `DocumentArchive`, not provider-specific clients.

## 23. Reference classifications

Initial direction:

- PostgreSQL — F1 / GA reference relational store;
- MySQL/MariaDB — F1 / Preview candidate;
- SQL Server — F2 / Preview candidate;
- Oracle Database — F3 / Lab;
- Valkey — F1 / GA reference cache candidate;
- Redis distributions — classified according to exact distribution/license;
- S3-compatible storage — reference object-storage capability;
- SeaweedFS and/or other compatible OSS implementations may serve local/reference needs.

The exact license of every concrete distribution SHALL be tracked.

## 24. Transaction boundaries

An ACID transaction SHOULD remain inside one transactional resource unless an exceptional, documented case justifies otherwise.

Distributed consistency SHALL use explicit patterns rather than pretending all resources share one transaction.

Reference patterns:

- Transactional Outbox;
- Inbox/deduplication;
- idempotent consumers;
- reconciliation.

## 25. Delivery semantics

BSK SHALL NOT claim universal exactly-once distributed execution.

Default distributed assumptions:

```text
at-least-once delivery
+ idempotency
+ deduplication
+ reconciliation
```

## 26. Event metadata

Important event/command envelopes SHOULD support metadata such as:

- `event_id`;
- `correlation_id`;
- `causation_id`;
- `tenant_id` where applicable;
- `schema_version`;
- `occurred_at`;
- `producer`;
- `idempotency_key` where applicable.

## 27. Messaging capabilities

BSK SHALL model messaging semantics explicitly:

- queue;
- publish/subscribe;
- event stream;
- dead letter;
- delayed delivery;
- ordered partition where supported.

A module SHOULD request capabilities rather than naming Kafka, RabbitMQ or a cloud provider unless provider-specific behavior is intentionally required.

## 28. Consistency requirements

Modules SHOULD be able to declare consistency expectations, for example:

- STRONG;
- READ_YOUR_WRITES;
- EVENTUAL;
- APPEND_ONLY;
- IMMUTABLE.

The exact vocabulary is implementation-phase work.

## 29. Data ownership and migrations

Each component that owns persisted data SHALL own its migrations.

A module SHALL NOT directly mutate another module's tables merely because they share a PostgreSQL instance.

Logical ownership boundaries SHOULD make later physical separation possible.

## 30. Backup and restore

A persistence adapter SHALL NOT be considered GA merely because it can write data.

GA operational evidence SHOULD cover:

- backup;
- restore;
- migration;
- rollback strategy;
- retention;
- encryption;
- capacity/failure behavior.

---

# Part VII — Resilience and Recovery

## 31. Resilience contract

All remote/process boundaries SHALL be treated as fallible.

BSK SHALL define vendor-neutral resilience concepts:

- Timeout;
- Retry;
- Backoff;
- Jitter;
- Circuit Breaker;
- Bulkhead;
- Rate Limit;
- Fallback;
- Dead Letter / Recovery.

Libraries such as Resilience4j are runtime implementations, not the architectural source of truth.

## 32. Timeout rule

Every remote call SHALL have explicit timeout/deadline behavior.

## 33. Retry rule

Retries SHALL declare:

- whether the operation is idempotent;
- retryable failure categories;
- maximum attempts;
- backoff;
- jitter;
- per-attempt timeout;
- overall deadline where applicable.

Retries SHALL NOT be a generic response to all exceptions.

## 34. Circuit breakers and adapters

Circuit breakers belong at remote/provider boundaries, not inside domain logic.

Business code SHALL NOT know the circuit breaker library or provider implementation.

## 35. Typed failures

BSK SHOULD define portable categories such as:

- ValidationFailure;
- AuthorizationFailure;
- ConflictFailure;
- DependencyUnavailable;
- DependencyTimeout;
- RateLimitExceeded;
- ConcurrencyConflict;
- TransientFailure;
- PermanentFailure.

These categories allow retry/recovery decisions to be explicit.

## 36. DLQ and replay

A GA async component using a DLQ SHALL document how to:

- inspect failures;
- correct underlying causes;
- replay safely;
- preserve idempotency;
- preserve correlation/evidence;
- audit replay actions.

A DLQ without a recovery path is not sufficient.

## 37. Reconciliation

Enterprise/financial/fiscal integrations SHOULD support reconciliation when remote acknowledgment is insufficient to prove final state.

Reconciliation compares expected internal state with external authoritative state and produces repair, alert or manual-review actions.

## 38. Degradation

Capabilities SHOULD declare whether they are:

- critical;
- degradable;
- optional.

Readiness/health SHALL distinguish whole-system failure from non-critical feature degradation.

## 39. Resilience evidence

OpenTelemetry SHOULD expose relevant operational signals such as retries, circuit state, dependency latency, timeout counts, DLQ backlog and reconciliation mismatch counts.

Fault-injection/resilience tests SHOULD cover representative failures without running an expensive full chaos suite on every local edit.

---

# Part VIII — Observability and Operations

## 40. OpenTelemetry contract

OpenTelemetry SHALL be the canonical observability boundary.

The reference F1 distribution SHALL be:

```text
Application runtimes
      ↓
OpenTelemetry
      ↓
OTel Collector
      ↓
Prometheus / Loki / Tempo
      ↓
Grafana
```

Grafana and these backends are replaceable implementations; BSK business code SHALL NOT depend on them.

## 41. Required telemetry identity

GA services SHOULD expose standard resource/trace metadata such as:

- service name;
- service version;
- deployment environment;
- deployment target where appropriate;
- trace/span identifiers;
- correlation/request identifiers;
- runtime;
- relevant HTTP attributes;
- duration;
- typed error information.

## 42. Structured logging

GA services SHALL use structured logs suitable for correlation.

Logs SHALL remain operational evidence, not substitute for the business/security audit trail.

## 43. Telemetry classification and redaction

Telemetry SHALL be allowlist-oriented for sensitive attributes.

Attributes SHOULD be classified as:

- metrics-safe;
- trace-only;
- log-only;
- audit-only;
- forbidden.

Secrets, passwords, private keys, session tokens, authorization headers and equivalent credentials SHALL be forbidden from telemetry.

Personal data SHALL require explicit policy before collection.

## 44. Health semantics

BSK SHALL distinguish:

- liveness — process alive;
- readiness — able to accept work;
- health/dependency state — state of capabilities/dependencies.

A non-critical dependency failure SHOULD NOT necessarily make a healthy service unready.

## 45. SLI, SLO and error budgets

Critical services SHOULD define a small set of meaningful SLIs/SLOs, typically including relevant combinations of:

- availability;
- latency;
- correctness;
- processing freshness for async systems.

Where SLOs exist, error-budget/burn-rate concepts MAY guide operational decisions.

## 46. Alerting

Alerts SHOULD prioritize user-visible symptoms and imminent user impact over arbitrary infrastructure thresholds.

Infrastructure metrics remain useful but SHALL NOT be the sole alerting strategy.

## 47. Runbooks

Critical alerts SHOULD reference versioned runbooks covering:

- diagnosis;
- dependencies;
- safe actions;
- rollback/recovery;
- escalation.

## 48. Deployment markers

Telemetry/dashboards SHOULD expose deployment version/time markers so operational regressions can be correlated with releases.

## 49. Frontend observability

React and other supported clients MAY participate in end-to-end trace propagation, web vitals and frontend error reporting, subject to privacy controls.

---

# Part IX — Privacy and Compliance

## 50. Compliance architecture

BSK SHALL use:

```text
compliance/
├── kernel/
├── jurisdictions/
└── sectors/
```

The kernel SHALL remain legally neutral.

Jurisdiction packs and sector overlays implement concrete policy differences.

## 51. Compliance kernel capabilities

The kernel SHOULD model capabilities such as:

- data classification;
- processing purpose;
- legal basis;
- consent evidence;
- subject-right requests;
- retention;
- deletion/anonymization;
- portability/export;
- breach workflow;
- data residency;
- processor/subprocessor registry;
- risk assessment;
- compliance evidence.

## 52. Jurisdiction packs

Planned/required architecture includes at least:

```text
jurisdictions/
├── eu/gdpr/
├── chile/law-21719/
├── brazil/lgpd/
├── canada/pipeda/
└── us/
    ├── california/ccpa-cpra/
    └── state-privacy/
```

## 53. Sector overlays

Architecture SHALL support overlays such as:

```text
sectors/
├── healthcare/us-hipaa/
├── financial/us-glba/
├── children/us-coppa/
└── future/
```

The design intentionally avoids one monolithic `usa-compliance-pack` because US privacy obligations are distributed across state and sector frameworks.

## 54. Data classification

BSK SHOULD provide neutral classifications such as:

- PUBLIC;
- INTERNAL;
- PERSONAL;
- SENSITIVE_PERSONAL;
- FINANCIAL;
- HEALTH;
- BIOMETRIC;
- CHILD_DATA;
- CREDENTIAL;
- SECRET.

Jurisdiction/sector packs may map these to legal terminology.

Classification SHOULD influence telemetry, encryption, access, retention and export policies.

## 55. Retention and deletion

Deletion SHALL NOT be modeled as an unconditional database `DELETE`.

The system SHALL support policy outcomes such as:

- physical deletion;
- logical deletion;
- anonymization;
- retention hold;
- archival.

This allows privacy requests to coexist with legal/accounting/fiscal retention duties.

## 56. Consent

Consent SHALL NOT be represented only as a boolean.

Consent evidence SHOULD support subject, purpose, status, policy version, capture time, withdrawal time and evidence reference.

The platform SHALL also model legal bases other than consent.

## 57. Privacy breach workflow

A potential privacy incident SHOULD be able to produce a workflow including:

- affected datasets;
- affected jurisdictions;
- risk assessment;
- notification requirements;
- timeline/evidence.

The concrete legal deadlines and rules belong to packs, not the kernel.

## 58. No legal certification claim

Installing or passing a compliance pack SHALL NOT cause BSK to claim that a product is legally compliant.

BSK can provide technical readiness, controls and evidence. Legal compliance also depends on configuration, actual processing, contracts, organizational procedures and legal review.

A future command such as `bsk compliance assess` SHOULD clearly distinguish **technical readiness** from **legal certification**.

---

# Part X — Deployment and Cloud Portability

## 59. Environment vs deployment target

These are distinct dimensions.

### Environment examples
- local;
- dev;
- qa;
- uat;
- staging;
- prod.

### Deployment target examples
- local Docker;
- VPS;
- bare metal;
- Kubernetes;
- AWS;
- Azure;
- GCP;
- future providers.

Examples such as `prod + VPS`, `qa + Azure` and `staging + AWS` are valid.

## 60. Compose layout

Compose SHOULD evolve toward base + profiles + environment overlays rather than complete duplication per environment.

```text
deployment/compose/
├── base/
├── profiles/
└── overlays/
    ├── local/
    ├── dev/
    ├── qa/
    ├── uat/
    ├── staging/
    └── prod/
```

## 61. Cloud neutrality

Cloud-neutral SHALL NOT mean cloud-blind or lowest-common-denominator.

A deployment MAY intentionally use provider-native capabilities if:

1. domain/application layers remain independent;
2. provider code stays in adapters/deployment tooling;
3. the dependency is documented;
4. migration consequences are explicit;
5. an exit strategy is described when technically reasonable.

BSK does not forbid vendor lock-in; it forbids accidental vendor lock-in.

## 62. Reference IaC

OpenTofu SHALL be the preferred F1 Infrastructure-as-Code reference, with Terraform-compatible ecosystem use where appropriate.

IaC modules SHOULD be capability-oriented and provider-specific logic localized under deployment targets.

## 63. Deployment capability descriptors

BSK SHOULD support a machine-readable description of application infrastructure needs such as relational store, object storage, queue semantics, secrets and telemetry export.

The descriptor SHALL express capabilities rather than hard-code a provider where portability is intended.

Automatic infrastructure generation is not required for v1.

## 64. Deployment conformance

Targets SHOULD be testable for capabilities such as:

- startup;
- health;
- database connectivity;
- object storage read/write;
- message publish/consume;
- secret retrieval;
- telemetry export;
- backup/restore;
- graceful shutdown.

Portability is considered demonstrated when tested, not merely diagrammed.

## 65. Kubernetes

Kubernetes SHALL be optional.

A production deployment using VPS + Docker + edge proxy + PostgreSQL + observability + tested backup/restore may be fully valid.

## 66. Disaster recovery

GA deployment targets SHOULD document:

- backup strategy;
- restore procedure;
- RPO;
- RTO;
- failure domains;
- data residency where relevant;
- secret recovery;
- deployment rollback.

---

# Part XI — Frontend and Full-Stack Experience

## 67. React reference client

React SHALL be the official frontend reference path.

React SHALL NOT be a kernel dependency or a requirement for BSK conformance.

Angular MAY be demonstrated later or in a separate project; it is outside the v1 critical path.

## 68. API client generation

TypeScript transport clients MAY be generated from canonical OpenAPI contracts.

Generated code SHALL remain at the transport boundary rather than becoming the application/domain model of the frontend.

## 69. Canonical error contract

Frontends SHALL consume a stable provider-independent error model rather than runtime-specific exception structures.

The final schema is implementation work, but SHALL support typed code/category, safe user-facing message, correlation information and structured details where appropriate.

## 70. API evolution

Within a stable major contract line, compatible additive evolution is preferred.

Breaking changes SHALL be explicit, versioned and deprecation-managed.

## 71. Backend For Frontend

BFF SHALL be available as an optional profile/capability, not a default requirement.

BFFs compose/adapt client experience and SHALL NOT become a hidden replacement domain layer.

## 72. Client state

BSK SHALL conceptually distinguish:

- server state;
- UI-local state;
- session/security state;
- offline/synchronization state.

No single state-management library is mandated by the BSK contract.

## 73. Browser security

Reference frontend guidance SHALL include:

- CSP where appropriate;
- secure cookie policy where applicable;
- CSRF protections according to auth model;
- CORS discipline;
- XSS-safe patterns;
- dependency scanning;
- no secrets in browser bundles.

## 74. PWA and offline

PWA/offline SHALL be optional capabilities:

- web baseline;
- installable PWA;
- offline read;
- offline write;
- advanced sync/conflict resolution.

Offline write/sync is explicitly not a v1 critical-path requirement.

## 75. Accessibility

The React reference path SHOULD include baseline accessibility expectations: semantic HTML, keyboard support, focus management, labels and automated accessibility checks where practical.

---

# Part XII — Quality, Testing and Supply Chain

## 76. Quality & Supply Chain Contract

Every GA component SHALL satisfy relevant common gates independent of runtime/tooling.

Representative gates:

```text
build/compile              PASS
unit tests                 PASS
integration tests          PASS
contract compatibility     PASS
BSK conformance            PASS
secret scanning            PASS
SAST/dependency checks     PASS
container/image scan       PASS where applicable
SBOM generation            PASS
license policy             PASS
architecture checks        PASS
```

CI policy SHALL remain separate from CI engine.

Supported CI templates MAY include GitHub Actions, GitLab CI, Jenkins and Azure DevOps without making any one engine part of the core contract.

## 77. Test taxonomy

BSK SHALL distinguish:

- unit;
- integration;
- contract;
- conformance;
- E2E;
- performance;
- resilience/chaos;
- security;
- privacy/compliance.

Each test class validates a different boundary.

## 78. Unit tests

Unit tests SHOULD remain fast and focus on isolated logic: domain rules, validation, mapping, policies, state machines and local retry/idempotency decisions.

## 79. Integration tests

Provider adapters SHOULD eventually be tested against the real provider technology or a faithful compatible implementation rather than only mocks.

## 80. Contract tests

CI SHALL detect incompatible OpenAPI/event/schema evolution before downstream consumers discover it in production.

## 81. E2E tests

E2E SHALL be limited to high-value business journeys and cross-component behavior, not used as a substitute for lower-level testing.

## 82. Performance

Components with performance expectations SHOULD establish appropriate p50/p95/p99, throughput/concurrency or resource baselines and detect meaningful regressions.

No universal latency target applies to all endpoints.

## 83. Security tests

Security suites SHOULD include both positive and negative authorization/isolation cases.

Tenant B being denied Tenant A data is a required class of behavior, not an incidental result.

## 84. Test data

Tests SHALL NOT use real personal production data.

Synthetic/pseudonymous fixtures and generators SHOULD be used.

## 85. Golden files/snapshots

Golden datasets/snapshots MAY be used for serialization, XML, event payloads and evidence structures, but snapshot updates SHALL require review rather than blind mass acceptance.

## 86. Testability requirement

Components that cannot be tested independently SHOULD trigger review of architectural boundaries.

Ports/adapters SHOULD enable production and test implementations without requiring massive mock graphs.

## 87. Test execution stages

Recommended staging:

### Local / inner loop
- format;
- lint;
- unit;
- local contract validation.

### Pull request
- unit;
- integration;
- contract;
- conformance;
- architecture;
- security baseline.

### Main/nightly
- full integration;
- multi-runtime interoperability;
- performance baseline;
- resilience tests.

### Release
- supply chain;
- critical E2E;
- deployment conformance;
- backup/restore;
- extended security.

---

# Part XIII — Developer Experience and CLI

## 88. Developer experience principle

The platform may be architecturally sophisticated; accidental developer complexity SHOULD be low.

A developer SHOULD be able to create and run a conformant service without manually reconstructing the architecture.

## 89. `bsk` CLI

The BSK CLI SHALL be the preferred Golden Path entry point while remaining optional.

Illustrative command families:

```text
bsk create
bsk add
bsk remove
bsk up
bsk down
bsk test
bsk doctor
bsk contracts
bsk conformance
bsk security
bsk compliance
bsk observability
bsk deploy
bsk explain
bsk architecture
bsk adr
```

The exact commands are implementation-phase decisions.

## 90. CLI independence rule

> **Everything the CLI automates SHALL remain understandable and operable through standard underlying tools/files.**

The CLI SHALL NOT become a proprietary execution runtime required by applications.

## 91. Scaffolding

Scaffolding SHALL generate the minimum structure needed to enter a Golden Path.

Generated output SHALL be maintainable without understanding the generator implementation.

## 92. Versioned templates

Template version, runtime version, profile version and BSK contract/platform compatibility SHALL be explicit.

Upgrades SHOULD produce inspectable changes and compatibility reports rather than silently rewriting large parts of a project.

## 93. `bsk doctor`

`bsk doctor` SHALL evolve from existing diagnostic scripts into a platform inspector capable of checking, as applicable:

- tool/runtime prerequisites;
- repository/module graph;
- architecture violations;
- configuration/secrets;
- runtime conformance;
- observability;
- security gates;
- compatibility status;
- deployment health.

Any `--fix` mode SHALL only perform safe, deterministic repairs.

## 94. `bsk explain`

The platform SHOULD be able to explain why a component, adapter or capability was selected, what it requires and what contracts it satisfies.

Explainability is part of long-term maintainability.

## 95. Architecture enforcement

A command such as `bsk architecture check` SHOULD detect prohibited dependency directions, including:

- kernel importing cloud SDKs;
- OSS depending on private packages;
- domain code importing provider adapters;
- GA components missing mandatory conformance.

Important architecture decisions SHOULD be executable where practical, not only documented.

## 96. ADRs

Significant architecture changes SHALL use Architecture Decision Records containing at least:

- context;
- decision;
- alternatives;
- consequences;
- status.

ADRs SHALL be required for meaningful public-contract, profile, security-baseline, extension-mechanism or core-policy changes, not trivial bug fixes.

## 97. Documentation model

Documentation SHOULD be organized by user intent:

- Getting Started;
- Golden Path;
- Concepts;
- Reference;
- Operations;
- Architecture;
- Compliance;
- Runbooks.

Executable examples SHOULD be tested in CI to prevent documentation drift.

## 98. Fast feedback

Quality checks SHALL be staged so local development remains fast while heavier verification runs pre-merge, nightly and release-time.

## 99. AI-assisted development

AI agents MAY accelerate BSK development, but SHALL be constrained by the same contracts, ADRs, module metadata, conformance rules and architecture checks as human-generated code.

AI-generated provider coupling SHALL not bypass architectural boundaries.

---

# Part XIV — Versioning, Releases and Governance

## 100. Versioning model

BSK SHALL use a hybrid model:

- a **platform compatibility line** for canonical contract/conformance generation;
- independent SemVer for modules/runtime implementations;
- versioned profiles;
- versioned conformance suites;
- a periodically published tested catalog/BOM of compatible module versions.

Module version SHALL NOT have to match BSK platform version.

## 101. Stable public contracts

Within a stable major contract version:

Generally compatible:

- add optional field;
- add endpoint;
- add event.

Generally breaking:

- remove field/endpoint/event;
- change type;
- change public semantics;
- make optional field mandatory.

CI SHALL enforce compatibility rules where machine-checkable.

## 102. Deprecation lifecycle

Stable public APIs SHOULD follow:

```text
ACTIVE
  ↓
DEPRECATED
  ↓
replacement documented
  ↓
migration period
  ↓
REMOVED in next major
```

Emergency exceptions may apply to severe security, legal or actively dangerous behavior and SHALL be documented.

## 103. Tested platform catalog

BSK SHOULD periodically publish a tested combination catalog showing compatible versions and support statuses.

A change to one adapter SHALL NOT automatically require release of every module in the monorepo.

## 104. Release evidence

GA releases SHOULD provide, as applicable:

- artifact;
- checksums;
- SBOM;
- dependency/license inventory;
- provenance;
- security scan status;
- conformance result;
- release notes;
- signatures where adopted.

## 105. Governance rule for open-core extensions

A private extension requesting a core change SHALL only result in a public core extension when the abstraction is genuinely general.

Customer/vendor special cases remain outside the generic kernel.

---

# Part XV — BSK v1 Scope

## 106. v1 objective

BSK v1 SHALL demonstrate a complete Golden Path end to end. It SHALL NOT attempt to implement every technology the architecture can support.

## 107. v1 canonical foundation

v1 critical path includes:

### Contracts
- OpenAPI;
- JSON Schema;
- CloudEvents conventions;
- OpenTelemetry conventions.

### Kernel
- canonical error model;
- ConfigProvider;
- SecretProvider;
- identity/security primitives;
- telemetry primitives.

### Core capabilities
- tenancy;
- RBAC;
- audit;
- events;
- idempotency;
- storage contracts.

### Profiles
- web-api;
- async-worker;
- integration-service.

### Runtimes
- Java/Spring;
- Node.js;
- Python/FastAPI;
- PHP.

Initial expected maturity:

- Java — GA candidate;
- Node.js — GA candidate;
- Python — GA candidate;
- PHP — Preview initially, graduating only after the same relevant conformance gates pass.

### Frontend
- React reference client.

### Reference infrastructure
- PostgreSQL;
- Valkey/approved Redis-compatible profile;
- RabbitMQ;
- S3-compatible object storage;
- Docker Compose.

### Observability
- OpenTelemetry Collector;
- Prometheus;
- Loki;
- Tempo;
- Grafana;
- basic dashboards/alerts/runbooks.

### Quality
- conformance;
- architecture checks;
- contract checks;
- security baseline;
- SBOM;
- supply-chain gates.

### CLI
Initial target operations:

- bootstrap;
- create service;
- add capability;
- up/down;
- test;
- doctor;
- contracts validate;
- conformance;
- architecture check.

### Documentation
- Golden Path;
- architecture;
- ADRs;
- runbooks.

## 108. v1 compliance scope

The compliance kernel architecture is part of v1.

The first jurisdiction packs targeted for validation are:

- Chile Law 21.719;
- GDPR.

Planned subsequent packs:

- Brazil LGPD;
- Canada PIPEDA;
- California CCPA/CPRA;
- other US state privacy packs;
- US sector overlays such as HIPAA, GLBA and COPPA where relevant.

This sequencing validates extensibility before multiplying jurisdictions.

## 109. v1 deployment scope

The first deployment path SHALL be:

1. local Docker;
2. generic VPS.

AWS, Azure and GCP are architectural targets and learning priorities but are **post-v1 critical path** so provider neutrality is proven before cloud-specific optimizations are added.

The later cloud goal is to implement equivalent BSK capability sets across all three providers and compare them through deployment conformance.

## 110. Explicitly post-v1 / Preview / Lab

The following SHALL NOT block BSK v1:

- .NET runtime;
- Angular reference client;
- Kubernetes production distribution;
- AWS-native target;
- Azure-native target;
- GCP-native target;
- Oracle adapter;
- SQL Server adapter;
- SAP adapters;
- Kafka streaming profile;
- MongoDB;
- OpenSearch;
- ClickHouse;
- full AI gateway;
- full data lake;
- mobile;
- offline write/sync;
- advanced ABAC/policy engine;
- full product marketplace;
- automatic infrastructure generation.

The architecture MAY contain public contracts/extension points needed to support these later, but v1 SHALL NOT create fake placeholder implementations merely to claim coverage.

## 111. v1 success criterion

BSK v1 is not complete until a clean environment can perform an experience equivalent to:

```text
clone repository
bootstrap BSK
create a web-api service
start local platform
run tests
run conformance
```

and obtain a working, observable service with:

- reference React UI;
- one conformant API runtime;
- PostgreSQL;
- RabbitMQ when profile requires events;
- object storage when profile requires it;
- auth/RBAC hooks;
- tenancy;
- audit;
- OpenTelemetry traces;
- Prometheus metrics;
- Loki logs;
- Grafana dashboards;
- contract validation;
- security baseline.

v1 SHALL also demonstrate at least one real cross-runtime flow, for example:

```text
Java publishes CloudEvent
        ↓
Python or Node consumes it
        ↓
trace/correlation preserved
        ↓
audit + telemetry visible
```

The final v1 success definition is:

> **A developer can create, run, test, observe and deploy a BSK-conformant service without understanding the internal implementation of the platform, while an architect can inspect exactly which contracts, dependencies and guarantees the service has.**

---

# Part XVI — Product Relationship: OpenFiscal

## 112. BSK/OpenFiscal boundary

OpenFiscal SHALL be able to run on BSK without depending on BSK internals.

The target rule is:

> **OpenFiscal may consume public BSK capabilities and adapters; OpenFiscal domain/application layers SHALL NOT import BSK-specific provider implementations.**

A future OpenFiscal distribution may declare requirements such as:

```text
requires:
  web-api capability
  audit capability
  evidence storage capability

optional:
  BSK compliance packs
  BSK observability distribution
  BSK cloud adapters
```

Equivalent non-BSK implementations must remain architecturally possible.

React remains the OpenFiscal official frontend direction; Angular is not required for OpenFiscal or BSK v1.

---

# Part XVII — Acceptance and Architecture Invariants

## 113. Non-negotiable invariants

The implementation plan MUST preserve these invariants:

1. BSK remains polyglot.
2. Canonical contracts are runtime-neutral.
3. Kernel has no provider/vendor dependencies.
4. OSS core never requires private code.
5. Private extensions use public documented extension points.
6. Environment and deployment target remain independent.
7. OpenTelemetry is the observability contract; Grafana is an implementation.
8. Privacy/security are baseline concerns, not future hardening phases.
9. Compliance kernel remains jurisdiction-neutral.
10. Technology maturity is proven by conformance, not labels.
11. Data/messaging abstractions preserve semantic differences.
12. Remote dependencies are fallible and explicitly resilient.
13. Audit is not operational logging.
14. Vendor lock-in is allowed only when explicit/localized/documented.
15. The CLI is convenient but not architecturally mandatory.
16. The monorepo does not imply a single release lifecycle.
17. v1 proves the Golden Path instead of maximizing checkbox coverage.
18. OpenFiscal can use BSK but does not belong inside the BSK kernel.

## 114. Implementation sequencing constraint

This document is an architectural design, not an implementation plan.

Implementation SHALL NOT begin by simultaneously rewriting all existing BSK subsystems.

The subsequent implementation plan MUST decompose migration into small, testable stages that preserve a runnable repository and prioritize:

1. inventory/current-state mapping;
2. canonical contracts and module metadata;
3. architecture/conformance skeleton;
4. one vertical Golden Path reference flow;
5. runtime convergence;
6. observability/security baseline;
7. developer CLI consolidation;
8. remaining v1 capabilities;
9. only then post-v1 provider/enterprise experiments.

The detailed order, file changes and test-first steps belong in the follow-up implementation plan after this specification is reviewed and approved.

---

# 115. Decision summary

This design formally chooses:

- polyglot platform over single-runtime framework;
- schema-first contracts over runtime-owned DTO truth;
- minimal kernel + curated profiles + optional packs over batteries-everywhere or total modular chaos;
- monorepo modularity with independent module lifecycles;
- open-core with one-way dependency from private extensions to public contracts;
- Freedom Class separate from Support Level;
- conformance-based GA status;
- OpenTelemetry as observability boundary;
- privacy/compliance kernel + jurisdiction packs + sector overlays;
- capability-oriented data/messaging abstractions;
- explicit resiliency, recovery and reconciliation;
- React as official reference frontend without making it part of the kernel;
- OpenTofu as preferred OSS IaC reference;
- local/VPS first, then AWS/Azure/GCP;
- CLI as a transparent Golden Path façade;
- evidence-based release, quality and supply-chain governance;
- strict v1 scope focused on proving the architecture end to end.

