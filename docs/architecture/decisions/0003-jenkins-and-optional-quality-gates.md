# ADR 0003: Jenkins Support and Optional Quality Gates

## Status

Accepted

## Context

The repository targeted GitHub Actions only and had no static-analysis gate.
Some teams run self-hosted Jenkins, and many will not have a SonarQube server
available initially. Forcing either tool would add friction without value for
those teams.

## Decision

- Add a declarative `Jenkinsfile` that mirrors the GitHub Actions baseline, with
  environment selection, optional image build, optional deploy and a mandatory
  manual approval gate for production.
- Add SonarQube configuration (`sonar-project.properties`) and a scan script that
  **skips gracefully** when SonarQube is not configured.
- Wire SonarQube into both CI runners as an optional, self-activating step that
  turns on only when `SONAR_HOST_URL` and `SONAR_TOKEN` are present.

## Consequences

- Teams can run delivery on GitHub Actions or Jenkins with the same model.
- The default pipeline passes without SonarQube; stricter quality gates can be
  adopted incrementally.
- Production deployments require explicit human approval on both runners.
