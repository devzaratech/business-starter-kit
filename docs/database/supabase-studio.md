# Supabase Studio

Business Starter Kit supports Supabase Studio through the Supabase CLI local development profile.

Supabase is intentionally kept at the repository root because it behaves as a PostgreSQL-based application platform profile with CLI conventions, migrations, policies, Edge Functions and Studio support. It is not just another database adapter.

## Commands

```bash
make supabase-start
make supabase-status
make supabase-studio
make supabase-db-reset
make supabase-stop
```

Default local Studio URL:

```txt
http://127.0.0.1:54323
```

## Security Rule

Supabase Studio is for local or private development access only. If it is used on a remote VPS, expose it through Tailscale, SSH tunneling or a private access layer. Do not publish Studio directly to the public internet.

## Relationship With PostgREST

`infra/compose/docker-compose.postgrest.yml` is a lightweight PostgREST-only profile.

`supabase/config.toml` is the Supabase CLI profile for the fuller local Supabase workflow, including Studio.
