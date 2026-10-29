# Operations Dashboard — business vertical (planned)

**Status: documentation-only / Lab.** No implemented dashboard or business metric API exists in this folder yet.

## Intended minimum scope

A vendor-neutral business metrics catalog, sample ingestion API/events, time-series aggregations, date/tenant filters, refresh/freshness indication, authorized CSV export and lineage/source timestamps.

Use only synthetic events and sample KPIs. Keep business telemetry separate from BSK's own OpenTelemetry operational traces/metrics.

**Acceptance:** known fixture totals match aggregates; duplicate/late events behave as specified; users cannot query/export another tenant's metrics; missing or stale data is clearly indicated; UI/API/CI and disposable deployment function.

**Delivery sequence:** `VRT4`, after the shared API, frontend and ingestion conventions are stable.

See [Business Verticals & Solution Accelerators](../../docs/superpowers/specs/bsk-business-verticals.md).
