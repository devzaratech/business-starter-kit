# First Real Golden Path Vertical — WorkspaceItem

**Status:** Conversational design approved; written-spec review pending  
**Date:** 2026-09-30  
**Project:** Business Starter Kit (BSK)  
**Repository target:** `devzaratech/business-starter-kit`  
**Branch:** `feat/workspace-item-golden-path-vertical`  
**Design class:** Architectural  
**Support target:** Preview

## 1. Purpose

This specification defines the first real end-to-end Golden Path vertical for BSK.

The vertical exists to prove that the architecture already defined by BSK can support a small, production-shaped flow across public contracts, platform capabilities, a runtime implementation, PostgreSQL persistence, a React reference client, conformance tests, and baseline observability.

The neutral sample resource is `WorkspaceItem` (short API resource name: `item`). It intentionally carries almost no business-specific meaning. Its purpose is to exercise platform behavior rather than model a product domain.

The vertical SHALL demonstrate this path:

```text
public contracts
      ↓
Spring Boot runtime
      ↓
tenancy + authorization + WorkspaceItem capability
      ↓
PostgreSQL
      ↓
transactional audit

React reference client
      ↓
same public HTTP contract
```

This checkpoint SHALL remain independent of OpenFiscal or any other downstream product.

## 2. Success criteria

The vertical is complete when all of the following are true:

1. A valid authenticated actor can discover the tenants to which that actor belongs.
2. Tenant-scoped `WorkspaceItem` create, list, read, and update operations work through the public HTTP contract.
3. Every tenant-scoped data operation includes `tenantId` explicitly at the persistence boundary.
4. Cross-tenant access is denied without revealing the existence of inaccessible tenant resources.
5. Authorization is expressed through permissions, never hard-coded role-name checks.
6. `POST` and successful `PUT` operations persist an append-only audit event in the same database transaction as the business mutation.
7. Updates use optimistic concurrency through `ETag` and mandatory `If-Match`.
8. A stale update returns `412 Precondition Failed` and performs no mutation or audit append.
9. Listing uses opaque cursor pagination with deterministic ordering.
10. The React reference client can discover a tenant, list items, create an item, read an item, and update an item.
11. A runtime-neutral black-box conformance suite verifies the externally observable contract.
12. The Spring Boot reference implementation passes the conformance suite and its runtime-specific integration tests.
13. Logs and traces provide enough correlation to follow a request through authentication, authorization, persistence, and audit without exposing secrets.
14. The capability and runtime remain Preview after this checkpoint; completion does not imply GA promotion.

## 3. Non-goals

This checkpoint SHALL NOT include:

- OpenFiscal-specific behavior;
- delete or soft-delete semantics;
- ABAC;
- PostgreSQL RLS as a required enforcement mechanism;
- external production IdP integration;
- user provisioning or password management;
- role-management or permission-management UI/API;
- outbox/event-broker infrastructure;
- RabbitMQ or Kafka integration for this flow;
- microservice decomposition;
- Node.js or FastAPI implementations of this vertical;
- Kubernetes;
- advanced jurisdiction-specific compliance packs;
- workflow engines;
- advanced dashboards or mature SLO programs;
- automatic runtime promotion to GA.

These capabilities may be added in later checkpoints without changing the core semantics established here.

---

# Part I — Architecture and boundaries

## 4. Architectural approach

The first vertical SHALL use a modular monolith implemented in Spring Boot.

Externally, the source of truth is the runtime-neutral HTTP contract. Internally, Spring SHALL preserve explicit boundaries between tenancy, authorization, audit, the neutral item capability, persistence adapters, and HTTP adapters.

The intended request flow is:

```text
React
  ↓
HTTP/OpenAPI contract
  ↓
Spring HTTP adapter
  ↓
authentication
  ↓
tenant membership resolution
  ↓
permission check
  ↓
WorkspaceItem application service
  ↓
tenant-scoped repository
  ↓
PostgreSQL
  ↓
transactional audit append
```

Spring Boot is the first implementation, not the definition of the contract.

Future Node.js and FastAPI implementations SHALL be free to use different internal structures provided they reproduce the same observable contract and pass the same conformance suite.

## 5. Capability responsibilities

### 5.1 Tenancy

The tenancy capability SHALL:

- represent tenants, users, and memberships;
- resolve whether an authenticated actor belongs to a requested tenant;
- return no positive tenant context when membership is absent;
- avoid making role or permission policy decisions itself.

### 5.2 Authorization

The authorization capability SHALL:

- evaluate effective permissions within an already resolved tenant context;
- authorize by permission identifier;
- never require callers to check hard-coded role names.

Initial permissions are:

- `item:create`
- `item:read`
- `item:update`

Roles MAY exist as bundles of permissions. Example seed roles MAY include administrative, operator, and viewer-style bundles, but role names are not application authorization contracts.

### 5.3 Audit

The audit capability SHALL:

- append immutable audit records;
- participate in the same transaction as successful item creation/update;
- avoid storing JWTs, secrets, credentials, or raw request payloads;
- remain separate from ordinary application logging.

### 5.4 WorkspaceItem

The item capability SHALL own:

- item validation;
- item creation;
- item retrieval;
- item listing;
- item replacement/update;
- optimistic concurrency semantics at the application boundary.

It SHALL NOT own authentication, membership resolution, role definitions, HTTP parsing, or provider-specific database configuration.

## 6. Dependency direction

Capabilities SHALL remain independent of Spring-specific HTTP types.

The conceptual dependency direction is:

```text
HTTP adapter → application/capability ports → domain rules → persistence ports
                                                   ↑
                                            provider adapters
```

The core business/capability interfaces SHALL NOT depend on controllers, servlet APIs, JPA entities, or React code.

---

# Part II — Identity, tenancy, and authorization

## 7. Authentication contract

Authentication SHALL use JWTs compatible with an OIDC-style issuer model.

The Spring runtime SHALL validate at minimum:

- signature;
- issuer (`iss`);
- audience (`aud`);
- expiration;
- subject (`sub`).

`sub` is the stable actor identity used to resolve the BSK user record.

For development and automated tests, BSK SHALL provide a deterministic local issuer or equivalent test fixture. This mechanism SHALL be restricted to development/test contexts and SHALL NOT become a production authentication strategy.

The API SHALL NOT support fake identity headers such as `X-User-Id` as an authentication bypass.

## 8. Authorization source of truth

JWTs prove actor identity; they SHALL NOT be treated as the sole source of current tenant membership or effective BSK permissions.

Membership and role/permission relationships SHALL be resolved from platform persistence for the requested tenant.

This avoids making long-lived token claims the source of truth for authorization changes and supports users belonging to more than one tenant.

## 9. Tenant discovery

Because tenant membership is database-backed rather than encoded as the authoritative JWT permission model, the reference API SHALL expose a minimal authenticated discovery endpoint:

```http
GET /me/tenants
```

It returns only tenants to which the authenticated actor currently belongs.

Each entry SHALL include:

- tenant identifier;
- tenant display name;
- effective permission identifiers needed by the reference client.

This endpoint exists only for self-discovery. It is not a tenant-administration API.

An authenticated actor with no memberships SHALL receive `200 OK` with an empty collection rather than `404`.

## 10. Cross-tenant information policy

For an authenticated actor:

- absence of membership in the requested tenant SHALL result in `404 Not Found`;
- a resource not present within an authorized tenant SHALL result in `404 Not Found`;
- insufficient permission within a tenant to which the actor belongs SHALL result in `403 Forbidden`.

This distinction prevents an actor from using authorization responses to enumerate inaccessible tenants or cross-tenant resources.

---

# Part III — HTTP contract

## 11. Resource endpoints

The first vertical SHALL expose:

```http
POST /tenants/{tenantId}/items
GET  /tenants/{tenantId}/items/{itemId}
GET  /tenants/{tenantId}/items?limit={limit}&cursor={cursor}
PUT  /tenants/{tenantId}/items/{itemId}
```

Delete is intentionally absent.

## 12. WorkspaceItem representation

The public resource representation contains:

- `id`
- `tenantId`
- `name`
- `description`
- `status`
- `createdAt`
- `updatedAt`
- `version`

For this first neutral sample, `status` SHALL be an application-neutral enum with exactly:

- `ACTIVE`
- `INACTIVE`

The enum exists only to prove validation and mutable state. It SHALL NOT be interpreted as deletion, retention, or workflow state.

For the first contract:

- `name` is required and SHALL reject blank values;
- `description` is optional/nullable;
- `status` is required and SHALL be one of the two values above.

Length limits and any normalization rules SHALL be defined once in the canonical schema and reused by runtime validation rather than re-invented independently in Spring and React.

### 12.1 Server-controlled fields

Clients SHALL NOT choose:

- `id`;
- `tenantId`;
- timestamps;
- `version`.

The path tenant is authoritative for tenant scope.

New items start at version `1`.

## 13. Create

`POST /tenants/{tenantId}/items` requires `item:create`.

The request body contains the editable fields:

- `name`;
- `description`;
- `status`.

A successful create SHALL:

1. verify authentication;
2. resolve tenant membership;
3. verify `item:create`;
4. create the item using the path `tenantId`;
5. append `item.created` audit data in the same transaction;
6. return `201 Created`;
7. return the created representation;
8. include an `ETag` for the new version.

## 14. Read

`GET /tenants/{tenantId}/items/{itemId}` requires `item:read`.

The repository lookup SHALL be tenant scoped.

A successful response SHALL include the item representation and its current `ETag`.

## 15. List and cursor pagination

`GET /tenants/{tenantId}/items` requires `item:read`.

Pagination uses:

- `limit`;
- optional opaque `cursor`;
- `nextCursor` in the response when more results exist.

The canonical ordering SHALL be:

```text
createdAt ASC, id ASC
```

The cursor SHALL encode enough state to continue that ordering, but its encoding is private implementation detail. Clients SHALL treat it as opaque and SHALL only return it unchanged.

`limit` defaults to `20` and SHALL be capped at `100`. Invalid limits or malformed cursors SHALL return `400 Bad Request`.

The response shape is conceptually:

```json
{
  "items": [],
  "nextCursor": null
}
```

No advanced search, filtering, or arbitrary sorting is part of this checkpoint.

## 16. Update and optimistic concurrency

`PUT /tenants/{tenantId}/items/{itemId}` requires `item:update`.

`PUT` replaces the complete editable state:

- `name`;
- `description`;
- `status`.

`If-Match` is mandatory.

The client SHALL echo the `ETag` associated with the representation it is editing.

The reference implementation MAY derive the ETag from the version number, but the ETag itself is opaque to clients.

A successful update SHALL atomically:

1. match `tenantId`;
2. match `itemId`;
3. match the expected version represented by `If-Match`;
4. replace editable fields;
5. increment `version`;
6. update `updatedAt`;
7. append `item.updated` audit data;
8. commit once;
9. return `200 OK` with the updated representation and new `ETag`.

A valid but stale `If-Match` SHALL return `412 Precondition Failed` with no mutation and no audit append.

A missing or syntactically invalid `If-Match` SHALL return `400 Bad Request`.

## 17. Error contract

Errors SHALL use the shared BSK machine-readable envelope.

The minimum fields are:

- `code`;
- `message`;
- `correlationId`;
- optional `details`.

The public API SHALL NOT expose stack traces, SQL fragments, framework exception names, JWT contents, or other implementation internals.

Initial status semantics are:

| Condition | HTTP status |
|---|---:|
| malformed/invalid input | 400 |
| missing or invalid authentication | 401 |
| authenticated member lacks required permission | 403 |
| tenant outside actor membership | 404 |
| resource absent within visible tenant | 404 |
| stale `If-Match` | 412 |

This checkpoint uses `400` for request validation rather than introducing a separate `422` policy.

---

# Part IV — Persistence and transactions

## 18. PostgreSQL reference model

PostgreSQL is the reference persistence implementation for this vertical.

Tenant-scoped tables SHALL contain a non-null `tenant_id`.

The reference schema SHALL minimally represent:

- users;
- tenants;
- memberships;
- roles;
- permissions;
- role-to-permission relationships;
- membership-to-role relationships;
- workspace items;
- audit events.

The exact physical names may follow existing repository conventions, but the semantic relationships above are required.

## 19. Tenant-scoped repository invariant

No tenant-scoped item repository API SHALL expose a data operation equivalent to:

```text
findById(itemId)
updateById(itemId)
```

without tenant scope.

Operations SHALL be equivalent to:

```text
findByTenantIdAndId(tenantId, itemId)
updateByTenantIdAndIdAndVersion(tenantId, itemId, version, ...)
```

The tenant identifier is part of the persistence contract, not an optional filter added by controller convention.

## 20. RLS policy

PostgreSQL Row Level Security is not required in this checkpoint.

Tenant isolation SHALL be correct at the application/repository layer first and proven by negative tests.

A later checkpoint MAY add RLS as defense in depth, especially for Supabase/PostgREST paths. RLS SHALL NOT be used to excuse unsafe tenant-unscoped repository APIs.

## 21. Transaction boundaries

Item creation and its audit append SHALL commit or roll back together.

Item update and its audit append SHALL commit or roll back together.

A failed authorization decision SHALL not open a business mutation transaction.

A stale concurrency check SHALL not append an audit event.

Read/list operations do not create business audit records in this checkpoint.

### 21.1 Reconciliation with the existing audit strategy

The existing `docs/security/audit-logging-strategy.md` says audit writes must not block the primary request path and recommends asynchronous durable publishing for high-volume actions. The approved vertical requires a stronger invariant for its low-volume mutation audit: the canonical durable audit append is part of mutation correctness and therefore commits atomically with `POST`/`PUT`.

This specification refines that blanket rule as follows:

- the canonical integrity record for correctness-critical mutations MAY be synchronous and transactional;
- downstream publication, export, indexing, analytics, or high-volume fan-out SHOULD be asynchronous and durable;
- a later outbox checkpoint MAY move downstream delivery off the request path without weakening the atomic integrity record.

The implementation plan SHALL update the existing audit strategy document so the repository contains one consistent policy rather than two contradictory rules.

## 22. Audit record

The minimum audit record contains:

- `tenantId`;
- `actorUserId`;
- `action`;
- `resourceType`;
- `resourceId`;
- timestamp;
- non-sensitive metadata.

Initial actions are:

- `item.created`;
- `item.updated`.

Audit storage is append-only at the application contract level.

This first vertical deliberately uses synchronous transactional persistence. Outbox-based publication or asynchronous processing belongs to a later checkpoint when there is a concrete need for event delivery or high-volume decoupling.

## 23. Migrations

Schema changes SHALL be explicit, versioned migrations committed to the repository.

Manual database changes are not part of the supported Golden Path.

Database triggers SHALL NOT implement the primary tenancy, RBAC, or audit rules for this checkpoint. Those rules must remain visible in application/persistence code and testable through normal BSK boundaries.

---

# Part V — React reference client

## 24. Role of React

`apps/web` is the reference consumer of the public contract.

React SHALL NOT depend on Spring implementation details, JPA models, database schemas, or internal capability types.

A future conformant runtime SHALL be replaceable without requiring business-level changes in the React application.

## 25. Minimum UI flow

The reference UI SHALL support:

1. authenticated startup;
2. loading actor-visible tenants from `GET /me/tenants`;
3. selecting an available tenant;
4. listing that tenant's items;
5. creating an item;
6. reading an item;
7. editing an item;
8. handling a stale update without silent overwrite.

The UI SHALL NOT include tenant administration, user administration, or role administration in this checkpoint.

## 26. Generated client boundary

OpenAPI remains the HTTP source of truth.

A generated TypeScript transport client MAY be used and is encouraged as the reference path, but UI code SHALL access it through a small application-owned client/service boundary.

This prevents generated transport details from spreading throughout React components.

## 27. Concurrency behavior in the UI

When loading an individual item, the client SHALL retain its ETag.

When saving, it SHALL send that ETag using `If-Match`.

On `412`, the UI SHALL NOT overwrite the remote state automatically. It SHALL tell the user the resource changed and require a refresh/retry flow.

On `403` or `404`, the UI SHALL present a safe error state and SHALL NOT attempt to infer or disclose whether an inaccessible tenant/resource exists.

---

# Part VI — Conformance, testing, and observability

## 28. Runtime-neutral conformance suite

BSK SHALL add a black-box conformance suite that targets a running API through its public HTTP interface.

The suite SHALL verify at least:

- valid and invalid authentication;
- tenant membership behavior;
- permission allow/deny behavior;
- cross-tenant denial;
- item create;
- item read;
- item list;
- cursor continuation;
- item update;
- ETag emission;
- mandatory `If-Match`;
- stale-update `412`;
- expected `403` versus `404` semantics;
- shared error envelope.

The suite SHALL not import Spring implementation classes or query Spring repositories directly.

Spring is the first runtime expected to pass this suite. Node.js and FastAPI SHALL later pass the same externally observable tests before claiming equivalent support.

## 29. Runtime-specific tests

The Spring implementation SHALL additionally include:

- unit tests for capability/domain rules;
- authorization tests;
- repository integration tests against real PostgreSQL;
- transaction tests proving item + audit atomicity;
- negative cross-tenant persistence tests;
- optimistic-locking race/stale-version tests;
- migration tests appropriate to the repository's existing tooling.

Audit persistence may be verified through runtime-specific integration tests because the first public API does not expose a general audit-query endpoint.

## 30. React tests

The React reference client SHALL have focused tests for:

- tenant discovery/selection;
- item list rendering;
- create;
- edit;
- ETag propagation;
- stale-update handling;
- safe `403`/`404` behavior.

A small number of end-to-end tests SHOULD cover the critical happy path and concurrency failure path. The goal is confidence in the Golden Path, not exhaustive browser duplication of lower-level tests.

## 31. Observability baseline

The vertical SHALL participate in BSK's OpenTelemetry baseline.

At minimum, a request SHALL be traceable through:

- incoming HTTP request;
- authentication;
- tenant membership resolution;
- permission decision;
- application operation;
- persistence;
- audit append for mutations.

Logs SHALL be structured and include a request/correlation identifier.

Sensitive data, JWTs, passwords, secrets, and raw authorization credentials SHALL NOT be logged.

Tenant/user identifiers SHALL NOT be used as unbounded metric labels.

Advanced dashboards and mature SLOs are outside this checkpoint.

---

# Part VII — Repository impact and maturity

## 32. Existing BSK modules

This vertical is expected to turn the existing seed capabilities into real behavior rather than create a parallel architecture.

Conceptually:

- `packages/tenancy` gains tenant/membership contracts and behavior;
- `packages/auth-rbac` gains permission-oriented authorization contracts and behavior;
- `packages/audit` gains append-only audit contracts and behavior;
- a neutral WorkspaceItem capability is added in the capability layer according to existing module-boundary rules;
- `apps/api-spring` becomes the first runtime implementation of the vertical;
- `apps/web` becomes the reference client;
- canonical HTTP/schema contracts live in the contract area;
- conformance lives in the repository's conformance area.

Physical changes SHALL follow the repository's existing architecture rules rather than invent a second parallel layout.

## 33. Support level

Completion of this slice does not imply GA.

The new vertical and associated runtime/capability implementations remain Preview until the broader BSK maturity requirements are met, including stable conformance, CI evidence, documented compatibility, and the support criteria defined by the Golden Path architecture.

The existence of code SHALL NOT be treated as proof of support level.

## 34. Compatibility expectation

This design intentionally separates semantic compatibility from implementation uniformity.

A future runtime is compatible when it reproduces the public behavior and passes conformance. It does not need to copy Spring's package structure, persistence library, or framework idioms.

---

# Part VIII — Acceptance checklist

The implementation plan derived from this specification SHALL produce evidence for every item below:

- [ ] `GET /me/tenants` returns only current actor memberships and effective permissions.
- [ ] `POST /tenants/{tenantId}/items` creates version 1 and emits ETag.
- [ ] `GET /tenants/{tenantId}/items/{itemId}` is tenant scoped and emits ETag.
- [ ] `GET /tenants/{tenantId}/items` uses deterministic cursor pagination.
- [ ] `PUT /tenants/{tenantId}/items/{itemId}` requires `If-Match`.
- [ ] stale `If-Match` returns `412` without mutation.
- [ ] cross-tenant known IDs cannot be read or changed.
- [ ] non-membership returns `404`.
- [ ] membership with insufficient permission returns `403`.
- [ ] code authorizes by permission identifiers, not role names.
- [ ] all tenant-scoped repository operations require `tenantId`.
- [ ] create + audit are one transaction.
- [ ] update + audit are one transaction.
- [ ] audit records contain no secrets or raw tokens.
- [ ] React supports tenant selection plus item list/create/read/update.
- [ ] React sends the received ETag back in `If-Match`.
- [ ] React handles `412` without silent overwrite.
- [ ] black-box conformance passes against Spring.
- [ ] PostgreSQL integration tests prove tenant isolation and audit atomicity.
- [ ] OTel/log correlation covers the critical request path.
- [ ] CI supplies test evidence without promoting the modules to GA.

## 35. Governing principle

This vertical is successful if it proves one small path deeply rather than many paths superficially.

The design intentionally prefers:

- one runtime before three;
- one neutral resource before a business domain;
- one ACID database transaction before distributed infrastructure;
- permission contracts before role-name coupling;
- application-enforced tenant scoping before RLS defense in depth;
- conformance evidence before maturity claims.

The checkpoint therefore establishes a reusable Golden Path behavior while leaving later runtimes, providers, and deployment models free to implement the same contract in their own appropriate way.
