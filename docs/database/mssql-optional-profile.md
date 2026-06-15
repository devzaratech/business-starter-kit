# MS SQL Server Optional Profile

MS SQL Server is an optional enterprise relational provider. It should not replace PostgreSQL as the default canonical database for the starter kit.

Use this profile when a product must integrate with Microsoft-centric enterprise environments, legacy systems, reporting databases or customer-managed SQL Server infrastructure.

## Design Guidelines

- Keep provider-specific SQL isolated.
- Avoid leaking T-SQL assumptions into domain logic.
- Use adapter packages or repository implementations for provider-specific behavior.
- Keep migrations explicit and provider-aware.
- Validate pagination, locking, JSON handling, date/time behavior and transaction isolation separately from PostgreSQL.

## Current Status

This repository documents MS SQL Server as an enterprise-ready extension point. It does not start MS SQL Server by default because the lean VPS profile should remain inexpensive and simple.
