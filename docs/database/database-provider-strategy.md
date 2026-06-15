# Database Provider Strategy

PostgreSQL is the canonical relational database. Other engines are optional
profiles selected per use case, never required defaults.

## Providers

| Provider | Role |
|---|---|
| PostgreSQL | Canonical source of truth (default). |
| Supabase / PostgREST | Optional acceleration profile over Postgres. |
| MongoDB | Optional profile for document-shaped or schema-flexible data. |

## Principles

- Keep the canonical relational model in PostgreSQL.
- Use migrations for all schema changes; never mutate production schema by hand.
- Keep tenant filtering enforced at the data layer, not only in application code.
- Treat Supabase/PostgREST as an interface over Postgres, not a separate source
  of truth.
- Use MongoDB only for data that is genuinely document-shaped; do not split the
  canonical relational model across engines without a clear reason.

## Migrations

- Relational migrations: keep ordered, versioned SQL (see `supabase/migrations`).
- For the Spring Boot service, a migration tool (Flyway or Liquibase) should be
  added before the schema becomes non-trivial.

## Connection Management

- Use a connection pool sized to the host.
- Use separate database users/roles per service with least privilege.
- Never reuse production credentials in lower environments.

See also: [Supabase / PostgREST Optional Profile](supabase-postgrest-profile.md)
and [MongoDB Optional Profile](mongodb-optional-profile.md).


## Repository Layout

Provider-specific data assets belong under `data/` by category. Supabase is intentionally kept at the repository root because the Supabase CLI expects and manages a `supabase/` project folder with configuration, migrations, functions, policies and Studio support.

See also:

- [Supabase Studio](supabase-studio.md)
- [MS SQL Server Optional Profile](mssql-optional-profile.md)
- [Oracle Optional Profile](oracle-optional-profile.md)
