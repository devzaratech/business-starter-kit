# MongoDB Optional Profile

MongoDB is an **optional** profile for document-shaped or schema-flexible data.
It does not replace PostgreSQL as the canonical relational store.

## When to Use It

- Genuinely document-oriented data (flexible shapes, nested structures).
- High-write event/telemetry capture where a document model fits naturally.
- Content or configuration blobs that do not need relational integrity.

## When Not to Use It

- For the canonical relational model (tenants, users, roles, audit) — that stays
  in PostgreSQL.
- As a way to avoid designing a schema; document stores still need discipline.

## Local Profile

An optional overlay is provided:

```bash
docker compose -f infra/compose/docker-compose.mongodb.yml up -d
```

This starts a single MongoDB instance with a persistent volume, intended for
local development and experimentation only.

## Rules

- Keep tenant identifiers on every document and filter by tenant on every query.
- Do not split a single consistent transaction across PostgreSQL and MongoDB.
- Treat MongoDB collections as another adapter behind a contract, the same way
  storage and integrations are abstracted.
