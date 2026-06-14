# CI/CD

Business Starter Kit treats CI/CD as a platform capability. Every product created from this starter kit should inherit automated tests, quality gates, deployment separation and environment-specific release controls.

## Included Capabilities

- Pull request validation.
- Unit test execution for Spring Boot, NodeJS, worker and web packages.
- Docker Compose validation.
- Manual environment-aware deployment workflow.
- Release candidate validation for version tags.
- Environment protection model for Dev, QA, UAT, Staging and Prod.

## CI/CD Principle

The same codebase must be promoted across environments. Environment-specific behavior must come from configuration, secrets and infrastructure profiles, not from code forks.
