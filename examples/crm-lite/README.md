# CRM Lite — business vertical (planned)

**Status: documentation-only / Lab.** No runnable CRM implementation exists in this folder yet.

## Intended first vertical

Build the first **end-to-end reference product** on top of BSK's Golden Path: organization and membership, companies, contacts, leads, opportunities, stages and an auditable change history.

**Proposed MVP:** Spring Boot, PostgreSQL/Flyway, OpenAPI, React + TypeScript, OIDC/RBAC, tenant-safe CRUD; Angular as a separate UI after the API contract is stable. Own CI/CD and resource policies per project.

**Acceptance:** create company/contact/lead/opportunity from UI, update stage, search by tenant; prevent cross-tenant API access and unauthorized writes; run migration, integration and E2E tests; deploy an immutable OCI image on disposable Compose, verify health, backup/restore and traces.

**Delivery sequence:** `VRT1` domain/API followed by `VRT2` UI and deployment, **after** shared contracts/Golden Path/CI are ready. Do not claim readiness from scaffolding alone.

See [Business Verticals & Solution Accelerators](../../docs/superpowers/specs/bsk-business-verticals.md).
