# Quality Gates

Quality gates protect the starter kit from becoming a fragile demo project.

## Minimum Gate for Pull Requests

A pull request is not ready to merge until:

- Spring Boot unit tests pass.
- NodeJS, worker and web tests pass.
- Docker Compose configuration validates.
- No production secrets are committed.
- Documentation is updated when architecture or operations change.

## Recommended Future Gates

- Static analysis.
- Dependency vulnerability scanning.
- Container image scanning.
- OpenAPI contract validation.
- Database migration dry-run.
- Basic end-to-end smoke test.
- Backup and restore rehearsal for production releases.

## Production Gate

A production deployment requires:

- A tested artifact or immutable image tag.
- Staging validation.
- Rollback plan.
- Database migration plan.
- Operational monitoring checklist.
