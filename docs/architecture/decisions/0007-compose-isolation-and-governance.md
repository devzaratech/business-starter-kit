# ADR 0007: Owned Compose scopes and observable resource governance

## Status

Proposed for PR0 / ES0 review, 2026-10-29. Extends the direction of ADR 0002;
does not change the legacy Compose topology in this PR.

## Context

Compose currently has fixed names, one shared edge bridge and no resource
admission. Distinct environment overlays do not demonstrate multiple projects
or protect foreign persistent data. Docker is a privileged, shared-kernel target.

## Proposed decision

PR2's opt-in Compose driver uses a stable Compose project per installation,
project and environment; deployment generations are owned labels inside that
scope. Derive a bounded name from the scoped immutable identity with a digest
suffix and a collision registry; never truncate slugs alone or use global
`container_name`. Service identity is stable across updates. Label installation,
project, environment, service, deployment and managed-by on managed resources.

Use private data networks and separate ingress networks per project/environment.
Only admitted HTTP endpoints and the shared gateway join ingress. Databases,
caches and workers have no ingress attachment or default public port. No Docker
socket, host networking, privileged mode or arbitrary host bind mounts in service
declarations. Labels help ownership checks but do not protect against host root.
Gateway compromise can reach attached HTTP endpoints; project auth still matters.

Implement request/limit admission using [canonical units and policy](../es0/canonical-contracts.md),
reserving system/edge/control-plane/build headroom and rollout overlap. Keep a
transactional allocation ledger. Render tested `cpus`, `mem_limit`, `pids_limit`
(or equivalent compatible fields), inspect runtime/cgroup values and record
unsupported capabilities. Do not promise CPU scheduling reservations, hard
volume quotas or hostile-tenant isolation from Compose alone.

`down` preserves data. `destroy` requires separately authorized ownership checks
against the persisted inventory and actual labels; foreign/unlabeled resources
are refused. Never issue global prune. Shared gateway/certificates have their own
installation lifetime and cannot be torn down by project lifecycle.

## Alternatives

One Compose file per fixed tier is simple but cannot separate arbitrary projects.
Separate VMs provide stronger hostile-workload isolation at higher cost and
remain the appropriate option where that trust boundary is required. Mandatory
Kubernetes is deferred; its policies must be tested as a distinct driver.

## Consequences, migration and acceptance

Adopt new driver scopes alongside legacy files; do not rename or adopt live
volumes automatically. Inventory and explicit volume mapping, backup/restore and
an operator-reviewed migration are required before existing workloads move.
Rollback restores the old driver mapping and artifact; it never deletes volumes.

ES2 must prove two independent projects, denied lateral data access, unaffected
project B after A stops, rejected foreign deletion and actual CPU/memory limits
under a pinned disposable Linux Docker/Compose/cgroup matrix. ES3 expands to
three projects and six domains. Compose config success is not runtime evidence.

References checked 2026-10-29: Docker documents [project naming](https://docs.docker.com/compose/how-tos/project-name/)
as an isolation mechanism and [service controls](https://docs.docker.com/reference/compose-file/services/)
for resource limits. The ownership/admission policy above is BSK's proposal;
platform guarantees still require runtime verification.
