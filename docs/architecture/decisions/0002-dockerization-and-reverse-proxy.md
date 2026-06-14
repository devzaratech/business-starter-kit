# ADR 0002: Dockerization and Reverse Proxy

## Status

Accepted

## Context

The initial repository could start shared infrastructure with Docker Compose, but
the application services (Spring Boot API, Node service, web app, worker) had no
container build path and were not part of the Compose stack. A starter kit that
cannot run its own applications is incomplete.

## Decision

- Add multi-stage Dockerfiles for all four application services.
- Add the application services and a Caddy reverse proxy to the VPS Compose file
  under an opt-in `apps` profile, so the lean infrastructure default is preserved.
- Add healthchecks to PostgreSQL, Redis and the application services, and use
  dependency conditions for ordered startup.
- Make the worker a long-running service with a heartbeat file so it can be
  health-checked.

## Consequences

- `make up` keeps starting only infrastructure (lean, cheap).
- `make up-full` (or `--profile apps`) runs the complete stack behind one entry
  point on port 80.
- The reverse proxy provides a single routing layer and a clear place to enable
  TLS for production.
- Containers run as non-root users where applicable.
