# Supabase / PostgREST Optional Profile

Supabase and PostgREST are treated as an **acceleration layer over PostgreSQL**,
not as a replacement for it. PostgreSQL remains the canonical database.

## When to Use It

- You want an instant REST API over the database for simple CRUD.
- You want Row-Level Security (RLS) to enforce tenant isolation at the data layer.
- You want to move quickly on a prototype without writing a full API tier first.

## When Not to Use It

- For complex business rules requiring strong consistency and auditability — keep
  those in the Spring Boot core API.
- As the only authorization mechanism for sensitive operations.

## Repository Assets

| Path | Purpose |
|---|---|
| `supabase/migrations/` | Versioned SQL migrations. |
| `supabase/policies/` | Row-Level Security policy definitions. |
| `supabase/functions/` | Optional Edge Function placeholders. |
| `supabase/postgrest/` | PostgREST configuration notes. |

## Local Profile

A self-contained Postgres + PostgREST overlay is provided:

```bash
docker compose -f infra/compose/docker-compose.postgrest.yml up -d
```

PostgREST is exposed for the explicit API schema only.

## Rules

- Expose only explicit API schemas; never expose internal platform tables directly.
- Enforce tenant filtering with RLS, not client-side filtering alone.
- Use database views or RPC functions to shape the public API surface.
