# WorkspaceItem Golden Path Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build BSK's first real end-to-end Golden Path vertical: a contract-first, tenant-scoped `WorkspaceItem` flow implemented first in Spring Boot/PostgreSQL and consumed by the React reference client, with permission authorization, transactional audit, ETag concurrency, runtime-neutral conformance, and baseline OpenTelemetry observability.

**Architecture:** Keep the first implementation as a Spring Boot modular monolith. Canonical OpenAPI/JSON Schema contracts live outside the runtime; Spring implements generated server interfaces, PostgreSQL stays behind explicit tenant-scoped JDBC repositories, and React consumes generated TypeScript contract types through an application-owned API client. The externally observable contract is enforced by a black-box Node conformance suite so future Node/FastAPI runtimes can implement the same behavior without copying Spring internals.

**Tech Stack:** Java 17, Spring Boot 3.3.0, Spring Security resource server, Spring JDBC/JdbcClient, Flyway, PostgreSQL 16, Testcontainers, OpenAPI 3.1 + JSON Schema 2020-12, OpenAPI Generator, React 18, TypeScript 5.6, Vite 5, Vitest/Testing Library, Playwright, Node.js 20+, Micrometer Observation + OpenTelemetry bridge.

**Spec:** `docs/superpowers/specs/2026-09-30-workspace-item-golden-path-vertical-design.md`

## Global Constraints

- The first vertical SHALL use a modular monolith implemented in Spring Boot.
- Spring Boot is the first implementation, not the definition of the contract.
- The source of truth for the public API SHALL be the runtime-neutral OpenAPI/JSON Schema contract.
- `WorkspaceItem` is neutral platform sample behavior; no OpenFiscal-specific logic belongs in this implementation.
- The only item operations in this checkpoint are create, read, list, and replace/update. DELETE and soft-delete semantics stay out of scope.
- Every tenant-scoped persistence operation SHALL receive `tenantId` explicitly; there must be no public tenant-scoped repository method equivalent to `findById(itemId)`.
- Authentication SHALL validate JWT signature, `iss`, `aud`, `exp`, and `sub`; fake identity headers such as `X-User-Id` are forbidden.
- JWT identity SHALL NOT be the source of tenant membership or effective BSK permissions; those come from platform persistence.
- Authorization SHALL check `item:create`, `item:read`, and `item:update`; application code SHALL NOT authorize by role name.
- Non-membership/cross-tenant access SHALL return `404`; insufficient permission inside a valid membership SHALL return `403`.
- Create/update audit SHALL be append-only and SHALL commit in the same PostgreSQL transaction as the successful item mutation.
- Reads/listing do not create business audit records in this checkpoint.
- `PUT` SHALL require `If-Match`; a valid stale ETag SHALL return `412` with no mutation and no audit append.
- Item ETags SHALL be opaque to clients; the Spring implementation will emit strong tags in the form `"v<positive-version>"`.
- Cursor pagination SHALL order by `createdAt ASC, id ASC`; `limit` defaults to `20` and is capped at `100`.
- `status` SHALL be exactly `ACTIVE` or `INACTIVE`.
- `name` SHALL be nonblank with max length 120; `description` SHALL be nullable with max length 2000. Do not silently normalize either value.
- The shared error envelope SHALL contain `code`, `message`, `correlationId`, and optional `details`, and SHALL never expose stack traces, SQL, framework exception names, secrets, or raw JWTs.
- PostgreSQL RLS, ABAC, external production IdP integration, role-management APIs/UI, outbox/brokers, microservices, Kubernetes, Node/FastAPI implementations, and advanced compliance packs remain out of scope.
- New/changed governed modules remain public F1, Apache-2.0, Preview unless an existing manifest already states otherwise.
- Retain the repository's current Java 17 and Spring Boot 3.3.0 baseline for this checkpoint; do not mix a platform/runtime upgrade into this vertical.
- Node-based tooling SHALL continue to support Node.js 20+.
- Generated sources SHALL be reproducible from the canonical contract and SHALL NOT become a second hand-edited source of truth.

## Review Focus

1. **Malformed or tampered pagination cursor:** return `400 request.invalid_cursor`; never broaden the query or drop tenant scoping. Task 6 owns the regression tests.
2. **Bad conditional-update headers:** missing, weak, wildcard, malformed, or multiple `If-Match` values return `400`; one well-formed but stale strong ETag returns `412 concurrency.precondition_failed`. Task 7 owns the regression tests.
3. **Authenticated but unknown subject:** `GET /me/tenants` returns `200` with an empty tenant list; tenant-scoped routes return `404`. Task 4 owns the regression tests.
4. **Known resource ID used through another tenant path:** return `404` and never reveal that the ID exists elsewhere. Tasks 6 and 9 own integration and black-box tests.
5. **Audit failure or stale update:** the item mutation must roll back on audit failure; stale updates must create neither a new item version nor an audit row. Tasks 6 and 7 own transaction tests.

---

## File Structure

The implementation should converge on this structure. Keep files focused; do not collapse these responsibilities into one controller/service class.

```text
contracts/workspace-item/
  bsk.module.json                         # governed contract module
  openapi.yaml                            # canonical HTTP contract
  schemas/
    error-envelope.schema.json
    tenant-access-list.schema.json
    workspace-item.schema.json
    workspace-item-create.schema.json
    workspace-item-replace.schema.json
    workspace-item-list.schema.json

data/relational/postgres/
  migrations/
    V001__workspace_item_vertical.sql     # generic PostgreSQL platform schema for this vertical
  seed/
    workspace-item-conformance.sql        # deterministic conformance fixture only

packages/workspace-item/
  README.md
  bsk.module.json                         # neutral capability governance

apps/api-spring/src/main/java/com/businessstarterkit/api/
  platform/http/
    CorrelationIdFilter.java
    ApiExceptions.java
    ApiExceptionHandler.java
  security/
    BskSecurityProperties.java
    JwtDecoderConfig.java
    AudienceValidator.java
    JwtIdentity.java
    JwtIdentityResolver.java
  tenancy/
    IdentityStore.java
    MembershipStore.java
    TenantSummary.java
    JdbcIdentityStore.java
    JdbcMembershipStore.java
    TenantAccessService.java
  authorization/
    PermissionStore.java
    JdbcPermissionStore.java
    AuthorizedTenantActor.java
    AuthorizationGate.java
  audit/
    AuditEvent.java
    AuditAppender.java
    JdbcAuditAppender.java
  workspaceitem/
    WorkspaceItem.java
    WorkspaceItemStatus.java
    WorkspaceItemRepository.java
    PostgresWorkspaceItemRepository.java
    WorkspaceItemPage.java
    CursorPosition.java
    CursorCodec.java
    EntityTagCodec.java
    WorkspaceItemQueryService.java
    WorkspaceItemCommandService.java
    WorkspaceItemUseCases.java
    ItemsApiController.java
  me/
    MeApiController.java
  observability/
    ObservationConfig.java

apps/api-spring/src/test/java/com/businessstarterkit/api/
  support/PostgresIntegrationTestSupport.java
  platform/http/SecurityHttpContractTest.java
  security/JwtDecoderConfigTest.java
  tenancy/TenantAccessIntegrationTest.java
  audit/AuditAppenderIntegrationTest.java
  workspaceitem/WorkspaceItemCreateReadListIntegrationTest.java
  workspaceitem/WorkspaceItemUpdateIntegrationTest.java
  observability/ObservationInstrumentationTest.java

apps/api-spring/src/test/resources/
  sql/identity-fixture.sql

conformance/workspace-item/
  README.md
  bsk.module.json
  support/jwt.mjs
  test/workspace-item.conformance.test.mjs

apps/web/src/
  App.tsx
  auth/sessionToken.ts
  api/generated/schema.ts                # generated; ignored, never hand-edited
  api/bskApi.ts
  features/workspace-items/WorkspaceItemPage.tsx
  features/workspace-items/WorkspaceItemPage.test.tsx

apps/web/e2e/
  workspace-item.spec.ts
```

Existing files that will be modified across tasks include `package.json`, `package-lock.json`, `.gitignore`, `apps/api-spring/pom.xml`, `apps/api-spring/application.yml`, `apps/api-spring/Dockerfile`, `apps/api-spring/bsk.module.json`, `apps/web/package.json`, `apps/web/bsk.module.json`, `apps/web/vite.config.ts`, capability manifests/readmes under `packages/`, architecture tests, `infra/compose/docker-compose.vps.yml`, `.github/workflows/ci.yml`, `scripts/quality/run-all-tests.sh`, and the relevant strategy/readme documentation.

---

### Task 1: Canonical HTTP contract and reproducible code generation

**Files:**
- Create: `contracts/workspace-item/bsk.module.json`
- Create: `contracts/workspace-item/openapi.yaml`
- Create: `contracts/workspace-item/schemas/error-envelope.schema.json`
- Create: `contracts/workspace-item/schemas/tenant-access-list.schema.json`
- Create: `contracts/workspace-item/schemas/workspace-item.schema.json`
- Create: `contracts/workspace-item/schemas/workspace-item-create.schema.json`
- Create: `contracts/workspace-item/schemas/workspace-item-replace.schema.json`
- Create: `contracts/workspace-item/schemas/workspace-item-list.schema.json`
- Create: `scripts/contracts/test/workspace-item-contract.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `apps/api-spring/pom.xml`
- Modify: `apps/api-spring/bsk.module.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/bsk.module.json`
- Modify: `scripts/architecture/test/runtime-manifests.test.mjs`

**Interfaces:**
- Consumes: BSK module manifest schema `contracts/schemas/bsk-module.schema.json`.
- Produces: OpenAPI operations `listMyTenants`, `createItem`, `getItem`, `listItems`, `replaceItem`; generated Java interfaces/models under `com.businessstarterkit.contract.api` and `com.businessstarterkit.contract.model`; generated TypeScript path/schema types in `apps/web/src/api/generated/schema.ts`; capability id `http.contract.workspace-item`.

- [ ] **Step 1: Write failing contract tests**

Create Node tests named `contract exposes the approved operations and statuses` and `workspace item schemas reject invalid public payloads`. Assert at minimum:

```js
assert.equal(openapi.openapi, '3.1.0');
assert.equal(openapi.paths['/me/tenants'].get.operationId, 'listMyTenants');
assert.equal(openapi.paths['/tenants/{tenantId}/items'].post.operationId, 'createItem');
assert.equal(openapi.paths['/tenants/{tenantId}/items'].get.operationId, 'listItems');
assert.equal(openapi.paths['/tenants/{tenantId}/items/{itemId}'].get.operationId, 'getItem');
assert.equal(openapi.paths['/tenants/{tenantId}/items/{itemId}'].put.operationId, 'replaceItem');

assert.equal(limitSchema.default, 20);
assert.equal(limitSchema.maximum, 100);
assert.equal(ifMatch.required, true);
assert.ok(replaceResponses['412']);

assert.equal(validateItem({ name: '   ', status: 'ACTIVE' }), false);
assert.equal(validateItem({ name: 'x'.repeat(121), status: 'ACTIVE' }), false);
assert.equal(validateItem({ name: 'valid', status: 'DELETED' }), false);
```

Use the existing root Ajv dependency for JSON Schema and add only the small YAML parser needed to inspect `openapi.yaml`.

- [ ] **Step 2: Run the contract tests and confirm they fail**

Run: `node --test scripts/contracts/test/workspace-item-contract.test.mjs`

Expected: FAIL because the contract files do not exist.

- [ ] **Step 3: Author the canonical OpenAPI/JSON Schemas**

Define exactly these public semantics:

```text
GET  /me/tenants
POST /tenants/{tenantId}/items
GET  /tenants/{tenantId}/items
GET  /tenants/{tenantId}/items/{itemId}
PUT  /tenants/{tenantId}/items/{itemId}
```

Use bearer JWT security. Use UUID path parameters. Define `WorkspaceItem.status` as `ACTIVE|INACTIVE`, `name` max 120 and nonblank, nullable `description` max 2000, version minimum 1, list `limit` default 20/max 100, opaque cursor, required `If-Match`, response `ETag`, and the spec's 400/401/403/404/412 behavior.

Use these stable error codes in examples and runtime mapping:

```text
request.invalid
request.invalid_cursor
request.if_match_required
request.if_match_invalid
auth.unauthenticated
authorization.forbidden
resource.not_found
concurrency.precondition_failed
```

`GET /me/tenants` returns `{ "tenants": [...] }`; each entry has `id`, `name`, and lexicographically sorted `permissions`.

- [ ] **Step 4: Add the contract module manifest and code-generation plumbing**

Create `workspace-item-contract` as public/F1/Preview/Apache-2.0, kind `contract`, providing `http.contract.workspace-item`.

Configure OpenAPI Generator in `apps/api-spring/pom.xml` to generate only Spring Boot 3 server interfaces/models from the canonical file, with:

```text
apiPackage=com.businessstarterkit.contract.api
modelPackage=com.businessstarterkit.contract.model
interfaceOnly=true
useSpringBoot3=true
useBeanValidation=true
openApiNullable=false
generated output under target/generated-sources/openapi
```

Add `workspace-item-contract` as the only new required governed dependency of `api-spring` at this stage.

In `apps/web/package.json`, add a pinned `openapi-typescript` dev dependency and `generate:api` script that writes `src/api/generated/schema.ts`. Add `workspace-item-contract` as a required governed dependency of `web-react`. Ignore the generated TypeScript file/directory in git.

- [ ] **Step 5: Update runtime-manifest tests before changing expectations**

Change the test so non-Spring runtimes still require no governed modules, while `api-spring` and `web-react` are allowed/required to depend on `workspace-item-contract`. Keep all modules Preview.

- [ ] **Step 6: Run contract generation and architecture checks**

Run:

```bash
npm ci
npm run architecture:test
npm run architecture:check
node --test scripts/contracts/test/workspace-item-contract.test.mjs
cd apps/api-spring && mvn --batch-mode generate-sources
cd ../web && npm run generate:api
```

Expected: all tests/checks PASS; generated Java `MeApi`/`ItemsApi` and generated TS schema types exist only as build/generated artifacts.

- [ ] **Step 7: Commit**

```bash
git add contracts/workspace-item scripts/contracts package.json package-lock.json .gitignore   apps/api-spring/pom.xml apps/api-spring/bsk.module.json   apps/web/package.json apps/web/bsk.module.json   scripts/architecture/test/runtime-manifests.test.mjs
git commit -m "feat: define WorkspaceItem HTTP contract"
```

---

### Task 2: Canonical PostgreSQL adapter schema and migration wiring

**Files:**
- Create: `data/relational/postgres/migrations/V001__workspace_item_vertical.sql`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/support/PostgresIntegrationTestSupport.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/platform/PostgresMigrationTest.java`
- Modify: `data/README.md`
- Modify: `apps/api-spring/pom.xml`
- Modify: `apps/api-spring/src/main/resources/application.yml`
- Modify: `apps/api-spring/Dockerfile`
- Modify: `infra/compose/docker-compose.vps.yml`

**Interfaces:**
- Consumes: PostgreSQL 16.
- Produces: schema `platform` and tables `users`, `tenants`, `memberships`, `permissions`, `roles`, `role_permissions`, `membership_roles`, `workspace_items`, `audit_events`; Spring datasource ready for tenant-scoped JDBC repositories.

- [ ] **Step 1: Add Testcontainers/Flyway/JDBC test plumbing and write a failing migration test**

Replace the unused JPA starter with `spring-boot-starter-jdbc`; add Flyway PostgreSQL support and Spring Boot/Testcontainers PostgreSQL test dependencies.

Create a shared PostgreSQL 16 Testcontainers base/config and a test `migrationCreatesWorkspaceItemVerticalSchema` asserting these relations exist:

```java
assertThat(tableExists("platform", "users")).isTrue();
assertThat(tableExists("platform", "memberships")).isTrue();
assertThat(tableExists("platform", "permissions")).isTrue();
assertThat(tableExists("platform", "roles")).isTrue();
assertThat(tableExists("platform", "workspace_items")).isTrue();
assertThat(tableExists("platform", "audit_events")).isTrue();
assertThat(indexExists("platform", "workspace_items", "idx_workspace_items_tenant_created_id")).isTrue();
```

- [ ] **Step 2: Run the migration test and confirm it fails**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=PostgresMigrationTest test`

Expected: FAIL because the Flyway migration/schema does not exist.

- [ ] **Step 3: Create the provider-specific migration**

Define:

```text
platform.users(id uuid PK, issuer text, subject text, display_name text nullable,
               unique(issuer, subject))
platform.tenants(id uuid PK, slug text unique, name text, status text,
                 created_at timestamptz, updated_at timestamptz)
platform.memberships(id uuid PK, tenant_id FK, user_id FK,
                     unique(tenant_id, user_id))
platform.permissions(code text PK)
platform.roles(id uuid PK, tenant_id FK, name text,
               unique(tenant_id, name))
platform.role_permissions(role_id FK, permission_code FK,
                          PK(role_id, permission_code))
platform.membership_roles(membership_id FK, role_id FK,
                          PK(membership_id, role_id))
platform.workspace_items(id uuid PK, tenant_id uuid NOT NULL FK,
                         name varchar(120) NOT NULL,
                         description varchar(2000) NULL,
                         status varchar(16) CHECK ACTIVE/INACTIVE,
                         version bigint NOT NULL CHECK version > 0,
                         created_at timestamptz NOT NULL,
                         updated_at timestamptz NOT NULL)
platform.audit_events(id uuid PK, tenant_id uuid NOT NULL FK,
                      actor_user_id uuid NOT NULL FK,
                      action text NOT NULL, resource_type text NOT NULL,
                      resource_id text NOT NULL, metadata jsonb NOT NULL,
                      created_at timestamptz NOT NULL)
```

Create `idx_workspace_items_tenant_created_id` on `(tenant_id, created_at, id)`. Add supporting membership/role indexes needed by the authorization queries. Keep this generic PostgreSQL migration separate from the Supabase application-profile migration history.

- [ ] **Step 4: Package the root PostgreSQL migration into the Spring artifact without duplicating it**

Configure Maven resources so `data/relational/postgres/migrations` is copied to `classpath:db/migration` at build time. Configure Flyway to use `classpath:db/migration`; remove JPA/Hibernate DDL configuration.

Change the Spring Docker image build to use the repository root as build context and copy only `apps/api-spring` plus `data/relational/postgres/migrations` into the build stage. Update the `api-spring` Compose build stanza to:

```yaml
build:
  context: ../..
  dockerfile: apps/api-spring/Dockerfile
```

Do not change the other application build contexts.

- [ ] **Step 5: Run migration, Maven, architecture, and Compose validation**

Run:

```bash
cd apps/api-spring && mvn --batch-mode test
cd ../..
npm run infrastructure:test
docker build -f apps/api-spring/Dockerfile .
```

Expected: PASS; the image contains Flyway migrations and Compose validation still detects no unsafe/duplicate bindings.

- [ ] **Step 6: Commit**

```bash
git add data/relational/postgres data/README.md apps/api-spring infra/compose/docker-compose.vps.yml
git commit -m "feat: add PostgreSQL schema for WorkspaceItem vertical"
```

---

### Task 3: JWT authentication, correlation IDs, and shared HTTP errors

**Files:**
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/security/BskSecurityProperties.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/security/AudienceValidator.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/security/JwtDecoderConfig.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/security/JwtIdentity.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/security/JwtIdentityResolver.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/platform/http/CorrelationIdFilter.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/platform/http/ApiExceptions.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/platform/http/ApiExceptionHandler.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/security/JwtDecoderConfigTest.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/platform/http/SecurityHttpContractTest.java`
- Modify: `apps/api-spring/pom.xml`
- Modify: `apps/api-spring/src/main/resources/application.yml`
- Modify: `config/env/.env.local.example`
- Modify: `config/env/.env.dev.example`
- Modify: `config/env/.env.prod.example`
- Modify: `infra/compose/docker-compose.vps.yml`

**Interfaces:**
- Produces: `record JwtIdentity(String issuer, String subject)`; `JwtIdentityResolver.current()`; error exceptions `InvalidRequestException(code,message)`, `ForbiddenException`, `ResourceNotFoundException`, `PreconditionFailedException`; response header `X-Correlation-Id`.
- Security properties: `bsk.security.mode=oidc|local-hmac`, `issuer`, `audience`, optional `local-hmac-secret`.

- [ ] **Step 1: Write failing JWT validation tests**

Create tests proving a locally signed HS256 token is accepted only when all of these match:

```java
assertAccepted(validIssuer, validAudience, futureExp, nonBlankSub);
assertRejected(wrongIssuer, validAudience, futureExp, nonBlankSub);
assertRejected(validIssuer, wrongAudience, futureExp, nonBlankSub);
assertRejected(validIssuer, validAudience, pastExp, nonBlankSub);
assertRejected(validIssuer, validAudience, futureExp, "");
```

Use a 32-byte test HMAC key. Test the identity resolver returns both `iss` and `sub`.

- [ ] **Step 2: Write failing HTTP security/error tests**

Assert:

```java
GET("/me/tenants").withoutToken()
  -> status 401
  -> body.code == "auth.unauthenticated"
  -> body.correlationId is nonblank
  -> response X-Correlation-Id == body.correlationId

GET("/me/tenants").header("X-Correlation-Id", "bad\nvalue")
  -> server generates a safe replacement id
```

Also assert error JSON contains none of `stackTrace`, `SQLException`, `Authorization`, or the bearer token.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run:

```bash
cd apps/api-spring
mvn --batch-mode -Dtest=JwtDecoderConfigTest,SecurityHttpContractTest test
```

Expected: FAIL because security/error components do not exist.

- [ ] **Step 4: Implement JWT resource-server configuration**

Add Spring Security OAuth2 resource-server support.

`oidc` mode creates a decoder from the configured issuer and adds the audience validator. `local-hmac` mode uses the configured HS256 secret but applies the same issuer/audience/expiration/subject validation.

Fail startup if `local-hmac` is selected for `prod`. Never provide a production default secret.

The local/dev env templates may opt into `local-hmac` with an explicit placeholder secret; prod SHALL default to `oidc`. Pass these values through the Spring Compose service.

- [ ] **Step 5: Implement correlation and error mapping**

`CorrelationIdFilter` accepts only `[A-Za-z0-9._-]{1,128}`; otherwise generate a UUID. Put it in MDC for the request and always echo it as `X-Correlation-Id`.

Map security and application exceptions into the generated `ErrorEnvelope` model using the exact codes from Task 1. Configure Spring Security's authentication entry point to use the same envelope for `401`.

- [ ] **Step 6: Run focused and full Spring tests**

Run:

```bash
mvn --batch-mode -Dtest=JwtDecoderConfigTest,SecurityHttpContractTest test
mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api-spring config/env infra/compose/docker-compose.vps.yml
git commit -m "feat: add JWT security and HTTP error baseline"
```

---

### Task 4: Database-backed tenant discovery and permission authorization

**Files:**
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/IdentityStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/MembershipStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/TenantSummary.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/JdbcIdentityStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/JdbcMembershipStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/TenantAccessService.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/authorization/PermissionStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/authorization/JdbcPermissionStore.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/authorization/AuthorizedTenantActor.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/authorization/AuthorizationGate.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/me/MeApiController.java`
- Create: `apps/api-spring/src/test/resources/sql/identity-fixture.sql`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/tenancy/TenantAccessIntegrationTest.java`

**Interfaces:**
- `IdentityStore.findUserId(String issuer, String subject) -> Optional<UUID>`
- `MembershipStore.isMember(UUID userId, UUID tenantId) -> boolean`
- `MembershipStore.listTenants(UUID userId) -> List<TenantSummary>`
- `PermissionStore.findEffectivePermissions(UUID userId, UUID tenantId) -> Set<String>`
- `AuthorizationGate.require(JwtIdentity identity, UUID tenantId, String permission) -> AuthorizedTenantActor`
- `TenantAccessService.listFor(JwtIdentity identity) -> List<TenantAccess>`

- [ ] **Step 1: Write failing integration tests against real PostgreSQL**

Seed two tenants and users with these cases:

```text
admin-a  -> tenant A -> item:create,item:read,item:update
viewer-a -> tenant A -> item:read
admin-b  -> tenant B -> item:create,item:read,item:update
unknown  -> authenticated JWT subject with no platform.users row
```

Assert:

```java
listFor(adminA) == [tenantA with sorted create/read/update permissions]
listFor(unknown) == []

require(adminA, tenantA, "item:update") -> AuthorizedTenantActor(adminAUserId, tenantA)
require(viewerA, tenantA, "item:update") -> ForbiddenException
require(adminB, tenantA, "item:read") -> ResourceNotFoundException
require(unknown, tenantA, "item:read") -> ResourceNotFoundException
```

Add an HTTP assertion that `GET /me/tenants` for `unknown` returns `200 {"tenants":[]}`.

- [ ] **Step 2: Run the integration test and confirm failure**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=TenantAccessIntegrationTest test`

Expected: FAIL because tenancy/authorization stores/services are absent.

- [ ] **Step 3: Implement identity and membership JDBC stores**

Resolve platform users by the composite identity `(issuer, subject)`; do not assume `sub` is globally unique across issuers.

Keep membership SQL tenant explicit. `listTenants` returns only memberships for the resolved user.

- [ ] **Step 4: Implement permission resolution and the authorization gate**

Effective permissions are the union of permissions attached to the actor's tenant-scoped membership roles.

The gate order is fixed:

```text
resolve identity -> membership check -> permission check
unknown/non-member => 404
member missing permission => 403
authorized => AuthorizedTenantActor
```

No role name may appear in a controller/service authorization condition.

- [ ] **Step 5: Implement `MeApiController` from the generated contract**

Use `JwtIdentityResolver` + `TenantAccessService`. Sort permissions lexicographically before mapping to the generated response.

- [ ] **Step 6: Run focused, Spring, and architecture tests**

Run:

```bash
mvn --batch-mode -Dtest=TenantAccessIntegrationTest test
mvn --batch-mode test
cd ../..
npm run architecture:test
npm run architecture:check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api-spring/src/main/java apps/api-spring/src/test
git commit -m "feat: add tenant membership and permission authorization"
```

---

### Task 5: Append-only audit primitive and repository policy reconciliation

**Files:**
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/audit/AuditEvent.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/audit/AuditAppender.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/audit/JdbcAuditAppender.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/audit/AuditAppenderIntegrationTest.java`
- Modify: `docs/security/audit-logging-strategy.md`

**Interfaces:**
- `AuditAppender.append(AuditEvent event) -> void`
- `AuditEvent(UUID id, UUID tenantId, UUID actorUserId, String action, String resourceType, String resourceId, Map<String,Object> metadata, Instant createdAt)`

- [ ] **Step 1: Write a failing real-PostgreSQL audit test**

Assert one append creates exactly one immutable row with:

```java
assertThat(row.action()).isEqualTo("item.created");
assertThat(row.resourceType()).isEqualTo("WorkspaceItem");
assertThat(row.tenantId()).isEqualTo(TENANT_A);
assertThat(row.actorUserId()).isEqualTo(ADMIN_A);
assertThat(row.metadata()).containsEntry("version", 1);
assertThat(row.metadata().toString()).doesNotContain("token", "authorization", "password", "secret");
```

Do not provide update/delete methods on `AuditAppender`.

- [ ] **Step 2: Run the audit test and confirm failure**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=AuditAppenderIntegrationTest test`

Expected: FAIL because the audit appender does not exist.

- [ ] **Step 3: Implement the append-only JDBC adapter**

Insert metadata as JSONB. The item flows in this checkpoint SHALL send only controlled metadata (`version` and, for update, `previousVersion`), never request bodies or bearer credentials.

- [ ] **Step 4: Reconcile the audit strategy document**

Replace the blanket "audit writes must not block the primary request path" rule with the approved distinction:

```text
correctness-critical canonical audit record -> may be synchronous + transactional
downstream publication/export/indexing/high-volume fan-out -> async + durable
future outbox may decouple delivery without weakening atomic integrity
```

- [ ] **Step 5: Run audit and Spring tests**

Run:

```bash
mvn --batch-mode -Dtest=AuditAppenderIntegrationTest test
mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api-spring/src/main/java/com/businessstarterkit/api/audit   apps/api-spring/src/test/java/com/businessstarterkit/api/audit   docs/security/audit-logging-strategy.md
git commit -m "feat: add transactional audit primitive"
```

---

### Task 6: WorkspaceItem create/read/list with mandatory tenant scoping

**Files:**
- Create: `packages/workspace-item/README.md`
- Create: `packages/workspace-item/bsk.module.json`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItem.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemStatus.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemRepository.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/PostgresWorkspaceItemRepository.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemPage.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/CursorPosition.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/CursorCodec.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemQueryService.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemCommandService.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemUseCases.java`
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/ItemsApiController.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemCreateReadListIntegrationTest.java`
- Modify: `packages/tenancy/bsk.module.json`
- Modify: `packages/auth-rbac/bsk.module.json`
- Modify: `packages/audit/bsk.module.json`
- Modify: `apps/api-spring/bsk.module.json`
- Modify: `scripts/architecture/test/seed-manifests.test.mjs`
- Modify: `scripts/architecture/test/runtime-manifests.test.mjs`

**Interfaces:**
- `WorkspaceItemRepository.insert(WorkspaceItem item) -> WorkspaceItem`
- `WorkspaceItemRepository.find(UUID tenantId, UUID itemId) -> Optional<WorkspaceItem>`
- `WorkspaceItemRepository.list(UUID tenantId, Optional<CursorPosition> after, int fetchSize) -> List<WorkspaceItem>`
- `CursorCodec.encode(CursorPosition position) -> String`
- `CursorCodec.decode(String value) -> CursorPosition`
- `WorkspaceItemUseCases.create(JwtIdentity, UUID tenantId, CreateCommand) -> WorkspaceItem`
- `WorkspaceItemUseCases.get(JwtIdentity, UUID tenantId, UUID itemId) -> WorkspaceItem`
- `WorkspaceItemUseCases.list(JwtIdentity, UUID tenantId, int limit, Optional<String> cursor) -> WorkspaceItemPage`

- [ ] **Step 1: Write failing repository/service tests for tenant isolation and pagination**

Assert:

```java
repository.find(TENANT_A, itemA.id()) -> itemA
repository.find(TENANT_B, itemA.id()) -> Optional.empty()

list(TENANT_A, emptyCursor, 2) returns only tenant A rows
page1.nextCursor is present when > limit rows exist
page2 contains no page1 IDs
ordering == createdAt ASC, id ASC

decode("not-a-valid-cursor") -> InvalidRequestException("request.invalid_cursor")
decode(cursorWithUnknownVersion) -> InvalidRequestException("request.invalid_cursor")
```

The cursor format for this implementation is base64url-without-padding JSON:

```json
{"v":1,"createdAt":"<ISO-8601 instant>","id":"<uuid>"}
```

Clients still treat it as opaque.

- [ ] **Step 2: Write failing create/read HTTP and transaction tests**

Assert:

```text
admin-a POST tenant A -> 201 + body.version=1 + ETag "v1"
viewer-a POST tenant A -> 403
admin-b GET tenant A known itemA -> 404
admin-a GET tenant A itemA -> 200 + same strong ETag
audit row item.created exists after successful create
```

Override/mock `AuditAppender` to throw during create and assert both the item row and audit row count remain unchanged after the request fails. This pins Review Focus item 5.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=WorkspaceItemCreateReadListIntegrationTest test`

Expected: FAIL because item repositories/use cases/controllers are absent.

- [ ] **Step 4: Implement the tenant-scoped JDBC repository and cursor codec**

Do not extend `JpaRepository` or expose any unscoped `findById` API.

For listing, query `limit + 1` rows using:

```text
tenant_id = :tenantId
AND (created_at, id) > (:createdAt, :id)   # only when cursor is present
ORDER BY created_at ASC, id ASC
LIMIT :fetchSize
```

Construct `nextCursor` from the last returned row when an extra row proves another page exists.

- [ ] **Step 5: Implement query/use-case authorization**

`WorkspaceItemUseCases` calls `AuthorizationGate.require(..., "item:read")` before get/list and maps absence inside an authorized tenant to `resource.not_found`.

- [ ] **Step 6: Implement transactional create**

`WorkspaceItemUseCases` authorizes `item:create` before calling the transactional command service.

`WorkspaceItemCommandService.create(AuthorizedTenantActor actor, CreateCommand command)` is `@Transactional` and:

```text
creates UUID + version 1 + timestamps
inserts item with actor.tenantId
appends item.created with metadata {"version":1}
returns item
```

Audit failure must roll back the item insert.

- [ ] **Step 7: Implement `ItemsApiController` create/read/list mappings**

Implement the generated API interface. The path tenant is authoritative; ignore/reject any attempt to provide tenant identity through the body because the public create/replace schemas contain no `tenantId`.

Emit `ETag: "v<version>"` on create and individual read.

- [ ] **Step 8: Promote capability manifests from placeholders only after behavior exists**

Create `workspace-item` as public/F1/Preview/Apache-2.0 kind `capability`, required dependency `workspace-item-contract`, providing `workspace-item.cru`.

Update:
- tenancy provides `tenancy.membership`;
- auth-rbac provides `authorization.permission`;
- audit provides `audit.append`;
- api-spring requires `tenancy`, `auth-rbac`, `audit`, `workspace-item`, and `workspace-item-contract`, and requires their capability ids.

Update architecture tests so they assert these are no longer empty placeholders while still enforcing Preview/F1 and forbidden edge kinds.

- [ ] **Step 9: Run focused, full Spring, contract, and architecture checks**

Run:

```bash
cd apps/api-spring
mvn --batch-mode -Dtest=WorkspaceItemCreateReadListIntegrationTest test
mvn --batch-mode test
cd ../..
node --test scripts/contracts/test/workspace-item-contract.test.mjs
npm run architecture:test
npm run architecture:check
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages apps/api-spring scripts/architecture
git commit -m "feat: add tenant-scoped WorkspaceItem create read and list"
```

---

### Task 7: PUT optimistic concurrency with strong ETags

**Files:**
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/EntityTagCodec.java`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemUpdateIntegrationTest.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemRepository.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/PostgresWorkspaceItemRepository.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemCommandService.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemUseCases.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/ItemsApiController.java`

**Interfaces:**
- `EntityTagCodec.encode(long version) -> String`
- `EntityTagCodec.parseRequiredIfMatch(String header) -> long`
- `WorkspaceItemRepository.replace(UUID tenantId, UUID itemId, long expectedVersion, ReplaceCommand command, Instant updatedAt) -> ReplaceOutcome`
- `ReplaceOutcome` has exactly `UPDATED(item)`, `NOT_FOUND`, or `VERSION_MISMATCH`.

- [ ] **Step 1: Write failing ETag parser tests for Review Focus edge cases**

Assert:

```java
encode(1) == "\"v1\""
parseRequiredIfMatch("\"v7\"") == 7

parseRequiredIfMatch(null) -> request.if_match_required
parseRequiredIfMatch("") -> request.if_match_invalid
parseRequiredIfMatch("*") -> request.if_match_invalid
parseRequiredIfMatch("W/\"v1\"") -> request.if_match_invalid
parseRequiredIfMatch("\"v1\", \"v2\"") -> request.if_match_invalid
parseRequiredIfMatch("\"v0\"") -> request.if_match_invalid
```

A single strong tag may have surrounding optional whitespace after trimming.

- [ ] **Step 2: Write failing update integration tests**

Assert:

```text
admin-a PUT tenant A with current "v1" -> 200, version 2, ETag "v2", item.updated audit
viewer-a PUT tenant A -> 403
admin-b PUT tenant A -> 404
admin-a PUT known itemA through tenant B path -> 404
admin-a PUT with old "v1" after version 2 -> 412
after stale PUT -> item remains version 2 and audit count unchanged
missing/weak/wildcard/multiple If-Match -> 400
```

Also inject an `AuditAppender` failure after a successful conditional SQL update and assert the transaction rolls the item version/content back.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=WorkspaceItemUpdateIntegrationTest test`

Expected: FAIL.

- [ ] **Step 4: Implement the ETag codec and conditional SQL update**

The update SQL SHALL include:

```sql
WHERE tenant_id = :tenantId
  AND id = :itemId
  AND version = :expectedVersion
```

and increment `version = version + 1`.

If the conditional update returns no row, perform a tenant-scoped existence check inside the same transaction:
- exists in this tenant -> `VERSION_MISMATCH`;
- absent in this tenant -> `NOT_FOUND`.

Never query by item ID alone.

- [ ] **Step 5: Implement transactional replace and audit**

Authorize `item:update` before entering the mutation transaction.

On success append:

```json
{
  "previousVersion": <expectedVersion>,
  "version": <newVersion>
}
```

with action `item.updated` and resource type `WorkspaceItem`.

Map `VERSION_MISMATCH` to `412 concurrency.precondition_failed` and `NOT_FOUND` to `404 resource.not_found`.

- [ ] **Step 6: Map PUT through the generated controller**

Require the generated `If-Match` argument, parse it with `EntityTagCodec`, call the use case, return `200` and the new ETag.

- [ ] **Step 7: Run focused and full Spring tests**

Run:

```bash
mvn --batch-mode -Dtest=WorkspaceItemUpdateIntegrationTest test
mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem   apps/api-spring/src/test/java/com/businessstarterkit/api/workspaceitem
git commit -m "feat: add ETag optimistic concurrency for WorkspaceItem"
```

---

### Task 8: OpenTelemetry observations and structured safe logging

**Files:**
- Create: `apps/api-spring/src/main/java/com/businessstarterkit/api/observability/ObservationConfig.java`
- Create: `apps/api-spring/src/main/resources/logback-spring.xml`
- Create: `apps/api-spring/src/test/java/com/businessstarterkit/api/observability/ObservationInstrumentationTest.java`
- Modify: `apps/api-spring/pom.xml`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/tenancy/TenantAccessService.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/authorization/AuthorizationGate.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/audit/JdbcAuditAppender.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/PostgresWorkspaceItemRepository.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemCommandService.java`
- Modify: `apps/api-spring/src/main/java/com/businessstarterkit/api/workspaceitem/WorkspaceItemQueryService.java`

**Interfaces:**
- Produces observations/spans named `bsk.tenancy.resolve`, `bsk.authorization.check`, `bsk.workspaceitem.command`, `bsk.workspaceitem.query`, `bsk.persistence.workspaceitem`, `bsk.audit.append`.
- Logs include correlation id plus trace/span identifiers through MDC/structured JSON; secrets and bearer tokens are never logged.

- [ ] **Step 1: Write a failing observation test**

Using Micrometer's test observation registry, execute one authorized create and assert observations with the approved names are stopped successfully. Execute a denied permission check and assert `bsk.authorization.check` is still observed without recording raw token contents.

- [ ] **Step 2: Run the observation test and confirm failure**

Run: `cd apps/api-spring && mvn --batch-mode -Dtest=ObservationInstrumentationTest test`

Expected: FAIL because named observations are absent.

- [ ] **Step 3: Add the Micrometer OpenTelemetry bridge and observation aspect/config**

Use Spring/Micrometer-managed compatible versions. Enable `@Observed` through `ObservedAspect`; add the OpenTelemetry tracing bridge and optional OTLP exporter configuration without requiring a collector for tests/local startup.

Do not add high-cardinality tenant/user IDs as metric tags.

- [ ] **Step 4: Instrument the approved boundaries**

Apply stable low-cardinality observation names to tenancy resolution, permission decision, item command/query, workspace-item persistence, and audit append. Allow automatic HTTP instrumentation to cover the incoming request span.

- [ ] **Step 5: Configure structured JSON logging**

Use a pinned Logback JSON encoder compatible with Java 17. Include timestamp, level, logger, message, `correlationId`, `traceId`, and `spanId` from MDC. Do not log request Authorization headers, JWT claims, passwords, DB passwords, or raw audit payloads.

- [ ] **Step 6: Run observation and full Spring tests**

Run:

```bash
mvn --batch-mode -Dtest=ObservationInstrumentationTest test
mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api-spring
git commit -m "feat: add WorkspaceItem observability baseline"
```

---

### Task 9: Runtime-neutral black-box conformance and CI evidence

**Files:**
- Create: `conformance/workspace-item/README.md`
- Create: `conformance/workspace-item/bsk.module.json`
- Create: `conformance/workspace-item/support/jwt.mjs`
- Create: `conformance/workspace-item/test/workspace-item.conformance.test.mjs`
- Create: `data/relational/postgres/seed/workspace-item-conformance.sql`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/quality/run-all-tests.sh`

**Interfaces:**
- Inputs: `BSK_CONFORMANCE_BASE_URL`, `BSK_CONFORMANCE_ISSUER`, `BSK_CONFORMANCE_AUDIENCE`, `BSK_CONFORMANCE_HMAC_SECRET`.
- Produces: runtime-neutral command `npm run conformance:workspace-item`; governed conformance capability `conformance.workspace-item.http`.
- The suite only uses HTTP plus locally generated identity JWTs; it SHALL NOT import Spring classes or inspect Spring repositories.

- [ ] **Step 1: Write the conformance suite before CI wiring**

Use Node's built-in test runner and `fetch`. Generate HS256 JWTs with Node `crypto`; token claims contain identity only (`iss`, `aud`, `sub`, `iat`, `exp`).

Write black-box tests for:

```text
invalid/no token -> 401 shared envelope
unknown subject /me/tenants -> 200 empty
admin-a /me/tenants -> tenant A + sorted permissions
viewer-a create -> 403
admin-b accessing tenant A -> 404
admin-a create -> 201 + ETag "v1"
admin-a read -> 200 + ETag
known tenant-A item through tenant-B path -> 404
cursor limit=1 walks all tenant-A rows without duplicate IDs
malformed cursor -> 400 request.invalid_cursor
valid PUT -> 200 + incremented ETag
stale PUT -> 412 concurrency.precondition_failed
bad If-Match forms -> 400
```

Run tests serially so fixture-dependent mutation order is deterministic.

- [ ] **Step 2: Add the deterministic SQL fixture**

Use fixed UUIDs for tenant A/B, users, memberships, tenant-local roles, and the three permissions. Include an authenticated subject that is intentionally absent from `platform.users` only in JWT generation, not seed data.

The fixture is test data only and SHALL NOT be loaded by normal application startup.

- [ ] **Step 3: Run the suite against no server and confirm it fails**

Run:

```bash
BSK_CONFORMANCE_BASE_URL=http://127.0.0.1:8080 npm run conformance:workspace-item
```

Expected: FAIL with connection refused.

- [ ] **Step 4: Add the governed conformance manifest and root script**

Create module `workspace-item-conformance`, kind `conformance`, public/F1/Preview/Apache-2.0, required dependency only on `workspace-item-contract`, providing `conformance.workspace-item.http`.

Do not make it depend on `api-spring`; portability is the point.

- [ ] **Step 5: Add a CI job that boots the reference runtime and PostgreSQL**

The job SHALL:

```text
start PostgreSQL 16 service
set up Java 17 and Node 20
npm ci
start Spring in local-hmac mode against the CI database
wait for /actuator/health
apply data/relational/postgres/seed/workspace-item-conformance.sql
run npm run conformance:workspace-item
print Spring logs on failure
```

Use a fixed 32-byte CI-only HMAC secret, issuer `https://conformance.bsk.local`, audience `bsk-api`. No repository secret is required because this is deterministic test-only identity.

Add this job to the required `quality-gate` dependencies.

- [ ] **Step 6: Include contract/architecture checks in the local quality script**

Add `npm run contracts:test`, `npm run architecture:test`, and `npm run architecture:check` to `scripts/quality/run-all-tests.sh`. Do not make the normal local quality script silently start long-lived services for conformance; document the separate conformance command.

- [ ] **Step 7: Run the conformance suite against a local ephemeral stack**

Start PostgreSQL, run the Spring app with the same conformance auth settings, load the seed, then run:

```bash
npm run conformance:workspace-item
```

Expected: all black-box tests PASS.

- [ ] **Step 8: Run architecture and workspace tests**

Run:

```bash
npm run architecture:test
npm run architecture:check
npm test
cd apps/api-spring && mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add conformance data/relational/postgres/seed package.json package-lock.json   .github/workflows/ci.yml scripts/quality/run-all-tests.sh
git commit -m "test: add WorkspaceItem runtime conformance"
```

---

### Task 10: React reference client and browser critical-path test

**Files:**
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/auth/sessionToken.ts`
- Create: `apps/web/src/api/bskApi.ts`
- Create: `apps/web/src/features/workspace-items/WorkspaceItemPage.tsx`
- Create: `apps/web/src/features/workspace-items/WorkspaceItemPage.test.tsx`
- Create: `apps/web/e2e/workspace-item.spec.ts`
- Create: `apps/web/playwright.config.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/tsconfig.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- `SessionTokenStore.get() -> string | null`, `set(string)`, `clear()`; storage key `bsk.accessToken`; use `sessionStorage`, never localStorage.
- `BskApi.listMyTenants()`
- `BskApi.listItems(tenantId, limit?, cursor?)`
- `BskApi.getItem(tenantId, itemId) -> { item, etag }`
- `BskApi.createItem(tenantId, request) -> { item, etag }`
- `BskApi.replaceItem(tenantId, itemId, request, etag) -> { item, etag }`
- API base defaults to `/api`; Vite development proxy strips `/api` and forwards to `VITE_BSK_API_PROXY_TARGET` (default `http://127.0.0.1:8080`).

- [ ] **Step 1: Add Vitest/Testing Library/openapi-fetch/Playwright dependencies and write failing API-client tests**

Use the generated OpenAPI types through `openapi-fetch`, wrapped by `BskApi`.

Assert with a mocked `fetch`:

```ts
expect(replaceRequest.headers.get('If-Match')).toBe('"v3"');
expect(getResult.etag).toBe('"v3"');
expect(apiError.status).toBe(412);
expect(apiError.code).toBe('concurrency.precondition_failed');
```

The wrapper, not React components, owns HTTP header/error parsing.

- [ ] **Step 2: Write failing component tests**

Inject a fake `BskApi` and assert:

```text
startup loads /me/tenants and selects an available tenant
list renders only returned tenant items
create refreshes/appends the created item
edit first loads the individual item + ETag
save passes the stored ETag to replaceItem
412 shows "This item changed. Refresh before saving again." and does not silently retry
403/404 show a safe unavailable/forbidden state without guessing resource existence
```

- [ ] **Step 3: Run web tests and confirm failure**

Run: `npm --workspace @business-starter-kit/web test`

Expected: FAIL because the client/components do not exist.

- [ ] **Step 4: Implement session-token bootstrap**

Because external IdP/login is out of scope, the reference client SHALL use a replaceable token-store interface. For local/dev only, present a minimal "use access token" input that stores the provided token in `sessionStorage` for the browser session.

Do not compile an access token into Vite environment variables and do not persist it in localStorage.

For non-local/dev environments with no token, render an "authentication provider not configured" state rather than an insecure fallback.

- [ ] **Step 5: Implement the typed API wrapper**

Use generated contract types; keep `openapi-fetch` behind `BskApi`. Preserve ETag from response headers for individual create/get/update responses. Map the shared error envelope into a small `BskApiError`.

- [ ] **Step 6: Implement the minimum `WorkspaceItemPage`**

Support tenant selection, cursor-based next-page navigation, create, read/edit, and update. No tenant/user/role administration and no delete button.

On `412`, clear the editable stale state only after the user chooses refresh; never retry PUT automatically.

- [ ] **Step 7: Configure the Vite local API proxy**

Proxy `/api/*` to the Spring API and strip the `/api` prefix, matching the existing Caddy `handle_path /api/*` deployment convention. This keeps browser requests same-origin in local development and avoids adding a new CORS policy to the vertical.

- [ ] **Step 8: Run component tests and build**

Run:

```bash
npm --workspace @business-starter-kit/web test
npm --workspace @business-starter-kit/web run build
```

Expected: PASS.

- [ ] **Step 9: Add one full-browser happy-path + stale-update Playwright scenario**

Using the same running Spring/PostgreSQL fixture as Task 9:

```text
put admin-a JWT into sessionStorage before app startup
open React app
select tenant A
create item
open/edit item
perform one external API update using current ETag
attempt UI save with now-stale ETag
assert UI shows stale-update message and remote value is not overwritten
refresh item
save with fresh ETag successfully
```

This is the small E2E required by the spec; do not duplicate every conformance case in the browser.

- [ ] **Step 10: Extend the Golden Path CI job to run the web E2E**

After API conformance succeeds, start Vite, install only Chromium for Playwright, run the one E2E spec, and upload/print useful failure output. Keep normal `node-workspace-tests` responsible for unit/component tests and build.

- [ ] **Step 11: Run web unit/build and browser E2E locally**

Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/web .github/workflows/ci.yml package-lock.json
git commit -m "feat: add React WorkspaceItem reference flow"
```

---

### Task 11: Documentation, repository truth, and final quality gate

**Files:**
- Modify: `README.md`
- Modify: `apps/api-spring/README.md`
- Modify: `apps/web/README.md`
- Modify: `packages/tenancy/README.md`
- Modify: `packages/auth-rbac/README.md`
- Modify: `packages/audit/README.md`
- Modify: `docs/tenancy/multi-tenancy-strategy.md`
- Modify: `docs/security/rbac-strategy.md`
- Modify: `docs/architecture/architecture-overview.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: one documented clone-to-running-reference path and accurate Preview capability/runtime claims.
- Does not promote any module to GA.

- [ ] **Step 1: Write documentation assertions into existing architecture tests where machine-checkable**

Update metadata tests to assert:
- `workspace-item-contract` exists and remains Preview/F1;
- `workspace-item`, tenancy, auth-rbac, and audit provide their actual capability ids;
- `api-spring` requires the implemented capabilities;
- `web-react` requires only the public HTTP contract, not Spring/capability internals;
- `workspace-item-conformance` depends on the contract but not `api-spring`.

Run architecture tests first and confirm any stale expectations fail.

- [ ] **Step 2: Update the human-facing docs**

Document:
- first real Golden Path path `contract -> Spring -> capabilities -> PostgreSQL -> audit -> React`;
- `GET /me/tenants` identity/membership behavior;
- permission-not-role authorization;
- explicit tenant-scoped repository invariant;
- ETag/`If-Match` and `412`;
- cursor pagination;
- local-hmac test/dev auth vs OIDC production mode;
- generic PostgreSQL migration location;
- how to run conformance and the React reference flow;
- Preview status and what is still out of scope;
- DELETE as the next deliberately separate lifecycle checkpoint.

Remove/replace any documentation that still calls tenancy/RBAC/audit empty placeholders.

- [ ] **Step 3: Run the complete local static/unit/integration quality gate**

Run:

```bash
npm ci
npm run contracts:test
npm run architecture:test
npm run architecture:check
npm run infrastructure:test
npm test
npm run build --if-present
cd apps/api-spring && mvn --batch-mode test
```

Expected: PASS.

- [ ] **Step 4: Run the end-to-end Golden Path verification**

With ephemeral PostgreSQL + Spring + conformance seed + Vite running:

```bash
npm run conformance:workspace-item
npm --workspace @business-starter-kit/web run e2e
```

Expected: PASS.

- [ ] **Step 5: Verify Docker/Compose packaging**

Run:

```bash
docker build -f apps/api-spring/Dockerfile .
npm run infrastructure:test
```

Expected: image builds with Flyway migration resources and all Compose profiles still validate.

- [ ] **Step 6: Inspect the branch diff for scope violations**

Expected:
- no DELETE endpoint;
- no RLS;
- no ABAC;
- no external IdP/vendor SDK;
- no Node/FastAPI implementation of the vertical;
- no OpenFiscal logic;
- no role-name authorization checks;
- no unscoped WorkspaceItem repository lookup/update;
- no committed generated API client/server source;
- no GA promotion.

- [ ] **Step 7: Commit documentation/final wiring**

```bash
git add README.md CHANGELOG.md apps/api-spring/README.md apps/web/README.md   packages docs scripts/architecture
git commit -m "docs: document first Golden Path vertical"
```

- [ ] **Step 8: Push the feature branch and request whole-branch review; do not merge**

Push `feat/workspace-item-golden-path-vertical`, wait for fresh CI on the exact head SHA, then perform the selected execution workflow's final whole-branch review. Any merge remains a separate explicit user decision.
