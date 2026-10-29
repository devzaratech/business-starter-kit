# ADR 0009: Project-scoped immutable delivery and evidence-based recovery

## Status

Proposed for PR0 / ES0 review, 2026-10-29. ADRs 0001/0003 remain the legacy CI
baseline; this does not claim delivery safety from their scaffolding.

## Context

Current CI exercises metadata and minimal runtime tests. Deploy uses mutable
tags and SSH restart without independent project authorization, trusted-host
pinning, observed rollout or tested data recovery. Telemetry packages are empty.

## Proposed decision

Keep SourceProvider, PipelineProvider and OCI registry at the edges. GitHub
Actions is first; Jenkins is an optional later adapter with the same acceptance
contract, not a required kernel. No default pipeline can deploy another project.
Bind source repository identity, commit, pipeline run, policy/test results, image
digest and provenance to a release. Promote that digest between environments
without rebuilding. Record skipped checks explicitly. Approval is a verified,
target-bound record and not a workflow boolean or environment name convention.

CI submits scoped operations to the same control plane as the CLI. Revalidate
caller/project/environment permissions, plan generation, digest availability,
signature policy when active, and approval before any privileged work. Reject
replayed webhooks and conflicting idempotency payloads. Serialize same-environment
deployments; bound build concurrency/time, logs and queues. Separate untrusted
build runners and their credentials from runtime workers. Pin SSH trust before
any SSH adapter is admitted; never interpolate inputs into shell source.

Correlate source/run/artifact/release/operation/deployment/health evidence. Kernel
emits telemetry contracts through ports; runtime instrumentation and optional
OpenTelemetry Collector/backends remain replaceable outer modules. Filter secrets,
bound cardinality, retention and bytes, and scope telemetry reads by project.
Loss of telemetry must be visible and must not fabricate rollout health.

Driver success requires observed readiness, digest and route checks. Roll back
to a previously verified artifact/config where safe; incompatible data migrations
require explicit expand/contract and recovery plans. Backup evidence requires
restoration and integrity verification into a separate disposable target.
Control-plane state also needs backup/restore; running apps survive its outage.
Define measured RPO/RTO for the tested profile rather than claiming HA.

## Alternatives and consequences

Mutable tags and in-place rebuilds are simple but cannot prove artifact promotion.
A mandatory CI vendor or observability distribution breaks replaceability.
Always reverting images on failed health is unsafe after irreversible migrations.
The proposed approach adds lineage and storage/queue work, staged in PR3/PR5/PR7.

ES4 proves project isolation, same digest across two environments, approval and
replay denial. ES5 injects health, worker, gateway and corrupt-backup failures and
demonstrates trace correlation, redaction and safe restore. ES6 repeats the
full non-business Golden Path twice. No container or deployment is run in ES0.

Compatibility: retain existing workflows, but do not reuse them as safe project
delivery without the listed corrections. Rollback of delivery code does not
reverse database migrations; keep lineage and previous digests/configs.

References checked 2026-10-29: [GitHub secure workflow use](https://docs.github.com/en/actions/reference/security/secure-use)
informs input/credential boundaries; [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
is an optional telemetry transport, not a required kernel component.
