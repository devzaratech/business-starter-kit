# Changelog

All notable changes to this starter kit are documented here. This project follows
a pragmatic, incremental approach: small, coherent, well-described changes.

## [Unreleased] — Architecture review and improvement pass

### Fixed
- Repaired a dangling code fence at the end of the README documentation index.
- Pinned web application dependencies (React, Vite, TypeScript) to concrete
  versions instead of `latest`, restoring reproducible installs.

### Added
- Multi-stage Dockerfiles for all four application services (Spring Boot API,
  Node service, web app, worker) with non-root users where applicable.
- Application services and a Caddy reverse proxy in the VPS Compose stack under
  an opt-in `apps` profile (the lean infrastructure default is preserved).
- Healthchecks for PostgreSQL, Redis and the application services, with
  dependency-condition startup ordering.
- A long-running worker service with a heartbeat file (health-checkable).
- A declarative `Jenkinsfile` with environment selection, optional SonarQube,
  optional image build, optional deploy and a mandatory production approval gate.
- SonarQube support: `sonar-project.properties`, a graceful local scan script,
  and a self-activating optional job in GitHub Actions CI.
- Optional standalone Compose overlays for PostgREST and MongoDB.
- An environment-file validator (`scripts/quality/validate-env.sh`).
- New DX Make targets: `up-full`, `build-images`, `validate-env`, `quality`,
  `sonar`.
- Documentation: local development, secrets management, RBAC, audit logging,
  storage and database provider strategies, Supabase/PostgREST and MongoDB
  optional profiles, n8n and CMS/ERP integration strategies, troubleshooting,
  release strategy, enterprise growth path, and ADRs 0002 and 0003.

### Changed
- Reworked the README documentation index into categorized sections.
- Updated the VPS deployment doc and environment strategy doc to cover the
  `apps` profile, reverse proxy routing, healthchecks and env-file validation.
- Regenerated the repository structure snapshot and repository map.

### Notes / Not Validated Locally
- `mvn test`, `docker compose config` and full `npm install` could not be run in
  the authoring sandbox (no Maven/Docker; restricted npm registry). Node worker
  and web unit tests pass locally; all YAML and shell scripts were syntax- and
  parse-validated. The `Jenkinsfile` (Groovy) was written carefully but not
  executed against a live Jenkins.
- The committed `package-lock.json` should be refreshed with `npm install` in a
  normal environment after the web dependency pinning change.
