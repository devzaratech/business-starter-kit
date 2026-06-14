# Jenkins Strategy

The starter kit ships a declarative `Jenkinsfile` at the repository root so teams
that run self-hosted Jenkins can use the same delivery model as the GitHub
Actions baseline. Jenkins is **optional**: it is provided as an alternative CI/CD
runner, not a requirement.

## Goals

- Mirror the GitHub Actions pipeline (tests, build, Compose validation).
- Keep SonarQube and deployment **opt-in**, so a default run works on a minimal
  controller.
- Enforce a safe production path with an explicit manual approval gate.

## Pipeline Parameters

| Parameter | Type | Purpose |
|---|---|---|
| `ENVIRONMENT` | choice | Deployment target (`none`, `dev`, `qa`, `uat`, `staging`, `prod`). `none` = build + test only. |
| `RUN_SONAR` | boolean | Run SonarQube analysis (requires credentials). |
| `BUILD_IMAGES` | boolean | Build application Docker images. |
| `DEPLOY` | boolean | Deploy to the selected environment after a green build. |
| `IMAGE_TAG` | string | Container image tag / Git SHA to deploy. |

## Stages

1. **Checkout** – fetch the repository.
2. **Spring Boot API tests** – `mvn --batch-mode test`.
3. **Node, worker and web tests** – `npm install` + `npm test`.
4. **Docker Compose validation** – `docker compose config` for every environment file.
5. **SonarQube analysis** – only when `RUN_SONAR` is set; skips gracefully if SonarQube is not configured.
6. **Build images** – only when `BUILD_IMAGES` or `DEPLOY` is set.
7. **Production approval** – manual `input` gate, only for `ENVIRONMENT == prod`.
8. **Deploy** – promotes the selected `IMAGE_TAG` through `scripts/deploy/restart-compose.sh`.

## Required Agent Tooling

Configure these as Jenkins Global Tools or install them on the build agent:

- JDK 17
- Maven 3.9+
- Node.js 20+
- Docker CLI (only needed for `BUILD_IMAGES` / `DEPLOY`)

## Required Credentials

| Credential ID | Type | Used by |
|---|---|---|
| `sonar-token` | Secret text | SonarQube analysis |
| Deployment SSH / host config | As needed | Deploy stage (environment-specific) |

Set `SONAR_HOST_URL` as a global environment variable (Manage Jenkins →
System → Global properties) when SonarQube is available.

## Safety Rules

- Production deployments **always** require manual approval through the
  `input` step.
- Deployments promote an existing, already-tested `IMAGE_TAG`; the pipeline does
  not deploy untested code directly.
- Concurrent builds are disabled to avoid overlapping deployments.
- Real secrets must come from Jenkins credentials or the environment secret
  store, never from the repository.
