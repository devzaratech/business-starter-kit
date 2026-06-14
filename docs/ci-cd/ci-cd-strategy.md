# CI/CD Strategy

Business Starter Kit supports a progressive delivery model with separated environments:

```txt
feature branches -> local
integrated changes -> dev
test candidates -> qa
business validation -> uat
release rehearsal -> staging
live release -> prod
```

## Recommended Flow

| Stage | Trigger | Target | Required Gates |
|---|---|---|---|
| Pull Request | PR to `develop`, `release/*`, `uat/*` or `main` | None | Unit tests, build, Compose validation |
| Dev Deployment | Merge to `develop` | Dev | CI passed |
| QA Deployment | Release branch update | QA | CI passed, technical checklist |
| UAT Deployment | UAT branch update or manual approval | UAT | QA passed, business-ready notes |
| Staging Deployment | Merge to `main` | Staging | UAT accepted, release notes |
| Production Deployment | Version tag or manual approval | Prod | Staging validated, rollback plan |

## Environment Protection

Use your CI/CD provider's environment protection rules for sensitive targets:

- Dev may deploy automatically after CI.
- QA may deploy automatically or manually depending on team maturity.
- UAT should usually require product/business approval.
- Staging should require release owner approval.
- Prod must require explicit approval and a rollback plan.

## Deployment Rule

Never deploy untested code directly to production. Production deployments should promote a known artifact, image tag or commit SHA that already passed CI.
