# Oracle Optional Profile

Oracle Database is an optional enterprise relational provider for customers that require Oracle-centric infrastructure, legacy integration or strict enterprise database standards.

Oracle should be treated as a dedicated enterprise profile, not as a default dependency of the starter kit.

## Design Guidelines

- Keep Oracle-specific SQL, sequences, schemas, indexes and data types isolated.
- Do not assume PostgreSQL SQL will run unchanged on Oracle.
- Validate date/time behavior, pagination, JSON support, transaction isolation and identifier casing explicitly.
- Review licensing, image distribution and infrastructure requirements before adding a runnable Oracle Compose profile.

## Current Status

This repository reserves the architecture path for Oracle support but does not include a runnable Oracle container profile by default. That keeps the initial VPS footprint lean and avoids misleading enterprise assumptions.
