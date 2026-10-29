# CMS-backed Portal — business vertical (planned)

**Status: documentation-only / Lab.** No implemented portal or CMS integration exists in this folder yet.

## Intended minimum scope

Public content listing and detail pages, authenticated editorial workflow with roles, drafts, review and publication. WordPress REST is the first **optional** CMS adapter; a mock adapter keeps CI runnable without WordPress. WordPress may use MariaDB/MySQL separately from the platform PostgreSQL.

**Acceptance:** a synthetic article progresses draft → review → publish with correct permissions, safe content rendering, audited approvals and integration tests; disabling WordPress or any AI draft feature does not break BSK. Publishing with IA requires explicit editorial approval.

**Delivery sequence:** `VRT3`, once PR10 optional CMS service profile is usable and shared web/API contracts are stable.

See [Business Verticals & Solution Accelerators](../../docs/superpowers/specs/bsk-business-verticals.md).
