# ADR 0001: CI/CD and Testing Baseline

## Status

Accepted

## Context

Business Starter Kit is intended to be reused across multiple business SaaS products. Without automated tests and delivery gates, each product would inherit operational fragility.

## Decision

The starter kit includes CI/CD and unit testing scaffolding from the first repository version.

The baseline includes:

- GitHub Actions workflows for CI, deploy and release candidate validation.
- Unit tests for Spring Boot, NodeJS, worker and web packages.
- Docker Compose validation in CI.
- Environment-aware deployment scripts.
- Documentation for quality gates and testing strategy.

## Consequences

- Products created from this starter kit start with quality automation by default.
- Deployment can begin cheaply on VPS/Docker while keeping a path toward enterprise-grade release controls.
- Future modules must include tests when they add reusable business or platform behavior.
