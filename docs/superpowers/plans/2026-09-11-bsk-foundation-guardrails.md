# BSK Foundation Guardrails Implementation Plan

Status: active execution on `feat/bsk-golden-path-foundation`.

This repository copy records the approved execution baseline. The detailed working plan was prepared outside the repository and is being reconciled against the live repository before each task. The live repository is the source of truth for existing paths, versions, licenses, and CI commands.

Key execution corrections:

- Baseline: `chore/multi-env-hardening`.
- Initial governed modules: `core-domain`, `tenancy`, `auth-rbac`, `audit`.
- `event-bus` is deferred because it does not exist in the live repository.
- Existing quality commands are Maven tests, `npm test`, Docker Compose validation, and optional SonarQube.
- BSK core license: Apache-2.0.
- Architecture test fixtures must never be discovered by repository-wide production manifest scans.

Execution follows RED -> GREEN -> REFACTOR with focused commits.
