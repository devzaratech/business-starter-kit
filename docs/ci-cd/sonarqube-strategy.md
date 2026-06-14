# SonarQube Strategy

SonarQube provides static analysis and quality-gate enforcement. In this starter
kit it is **optional and self-activating**: pipelines run normally without it,
and analysis turns on automatically once the required configuration exists.

## Files

| File | Purpose |
|---|---|
| `sonar-project.properties` | Defines what to analyze (sources, tests, exclusions). No secrets. |
| `scripts/quality/run-sonar-scan.sh` | Runs analysis locally or in CI; skips gracefully when not configured. |
| `.github/workflows/ci.yml` (sonarqube job) | Optional CI analysis, activated by secrets/vars. |
| `Jenkinsfile` (SonarQube stage) | Optional Jenkins analysis behind the `RUN_SONAR` parameter. |

## Required Configuration

Analysis activates only when **both** values are present:

| Variable | Where to set it |
|---|---|
| `SONAR_HOST_URL` | GitHub Actions repository **variable**; Jenkins global env property. |
| `SONAR_TOKEN` | GitHub Actions repository **secret**; Jenkins `sonar-token` credential. |

If either is missing, the scan is skipped and the pipeline still passes.

## Running Locally

```bash
export SONAR_HOST_URL="https://sonar.example.com"
export SONAR_TOKEN="your-analysis-token"
./scripts/quality/run-sonar-scan.sh
```

The script uses the `sonar-scanner` CLI if installed, otherwise the official
`sonarsource/sonar-scanner-cli` Docker image.

## Quality Gate Expectations

Start with the built-in **Sonar way** quality gate, then tighten over time:

- No new blocker or critical issues on changed code.
- No new security hotspots left unreviewed.
- Maintain or improve coverage on new code once coverage reporting is enabled.
- No new code duplication above the configured threshold.

## Coverage

Coverage paths are pre-declared (commented) in `sonar-project.properties`.
Enable them per module as real code and tests are added:

- Java: JaCoCo XML report (`apps/api-spring/target/site/jacoco/jacoco.xml`).
- Node/Web: LCOV reports (`apps/**/coverage/lcov.info`).

## Why Optional

Forcing SonarQube from day one would block contributors who do not have a
SonarQube server. Making it self-activating keeps the default path frictionless
while letting teams enforce stricter gates as the platform matures.
