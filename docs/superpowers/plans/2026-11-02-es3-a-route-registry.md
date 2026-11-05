# ES3-A Route Registry Implementation Plan

**Goal:** Persist owned route claims and produce a deterministic offline shared-edge candidate. This implements only ES3-A of ADR 0008; no proxy or infrastructure activation.

**Architecture:** Use existing Node.js and Ajv. A separate `bsk.edge/v0alpha1` input embeds the unchanged ES1 declarations, canonical EdgeGateway/Deployment resources, DomainBindings with explicit deployment references, and explicit local host/zone/exposure admission records. One authoritative registry directory covers an entire installation and all its gateways, so exclusivity is not split across gateways. Logical upstream references do not accept addresses or proxy directives.

**Trust boundary:** Host/zone/deployment exposure catalogs and a synchronous authorization callback are supplied by a trusted local embedding application. Claimed identifiers and callback results are not authenticated credentials. PR3 must supply authenticated, project-scoped RBAC. Rebind is a distinct whole-hostname transaction with both owners and full replacement claims; ordinary claim/release cannot silently transfer a reserved hostname. Mixed public/private claims on one hostname are rejected to avoid catch-all exposure.

**Persistence:** Exclusive, immediate-failure file lock; generation CAS under the lock; complete state validation and checksum on every read; fsynced exclusive temporary file and atomic rename. Interrupted temporary writes never replace the committed snapshot. Crash-left locks are not automatically stolen; recovery requires a quiescent, operator-verified local directory. Windows power-loss directory durability is not claimed.

**Implementation sequence (TDD):**

1. Add a synthetic fixture for three projects and six `.test` hostnames and failing validation/planner tests in `scripts/edge/test/`; implement `contracts/schemas/bsk-edge-v0alpha1.schema.json` and `scripts/edge/lib/model.mjs` using canonical ES1 schema references and validator projection.
2. Add failing registry tests for CAS, ownership transfer, lock contention, corruption, interrupted persistence and unrelated route retention; implement `scripts/edge/lib/registry.mjs` with no infrastructure imports.
3. Add pure candidate/matching tests, including segment precedence, strip behavior, private exclusion, input reorder and mutation guards; implement `scripts/edge/lib/plan.mjs` and a typed `IngressDriver` boundary without an adapter.
4. Wire `edge:test` into the existing Linux/Windows architecture CI job; document usage, trust/recovery boundaries and ES3-B acceptance gaps. Run focused edge, declarations, non-Docker ES2 and architecture checks; review scope and open one PR.

**Review focus:** Cross-gateway hostname uniqueness, private catch-all exposure, implicit transfer after release, stale concurrent updates, and crash-left locks must all fail closed. ES1/ES2, legacy deployment, frontend, certificates and remote infrastructure are unchanged.
