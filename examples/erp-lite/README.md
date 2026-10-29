# ERP Lite — business vertical (planned)

**Status: documentation-only / Lab.** No runnable ERP implementation exists in this folder yet.

## Intended minimum scope

One bounded workflow: products/warehouses, stock receipts, sales orders and stock reservation/fulfillment. Domain invariants include non-negative inventory, transactional consistency, idempotent commands and correct concurrent reservations. Tenant-safe access and audit are mandatory.

**Non-goals:** production accounting, taxation, official electronic invoices, payroll and SAP replacements. Those would require separate business and legal specifications.

**Acceptance:** concurrent reservations cannot oversell; duplicate events/commands do not adjust stock twice; stock ledger reconciles; unauthorized tenants cannot see orders; DB migrations and recovery are tested. Project-specific CI and resource budget.

**Delivery sequence:** `VRT5`, after CRM transaction/auth patterns and deployment pathways are proven.

See [Business Verticals & Solution Accelerators](../../docs/superpowers/specs/bsk-business-verticals.md).
