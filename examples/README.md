# Business vertical examples

These are **future business solution accelerators**, separate from the BSK platform kernel and deployment engines. They must depend on public Golden Path contracts, never the other way around.

**Implementation status (28 October 2026): documentation-only / Lab.** The four folders presently contain README files and `.gitkeep` markers only; no deployable business application has been verified.

| Example | Intended first workflow | Status |
|---|---|---|
| [CRM Lite](crm-lite/README.md) | Organization → company/contact → lead → opportunity | Planned / documentation-only |
| [ERP Lite](erp-lite/README.md) | Receive stock → reserve/fulfill order | Planned / documentation-only |
| [Operations Dashboard](operations-dashboard/README.md) | Import synthetic metrics → aggregate → filter/export | Planned / documentation-only |
| [CMS-backed Portal](cms-backed-portal/README.md) | Draft → editorial approval → publish | Planned / documentation-only |

**Delivery priority:** CRM Lite first, then CMS-backed Portal and Operations Dashboard when dependencies are ready, then ERP Lite. Follow the [verticals specification](../docs/superpowers/specs/bsk-business-verticals.md) and [master plan](../docs/superpowers/plans/2026-10-28-bsk-agent-master-plan.md). Each implementation needs real code, tenant-safety tests, a project-specific CI pipeline, deployment/backup evidence and truthful maturity labels.

Use only synthetic/sanitized demo data. Never commit customer/proprietary workflows or credentials. These examples must remain optional for users of BSK itself.
