# Supabase Profile

This directory contains the optional Supabase/PostgREST platform profile.

Supabase is treated as an acceleration layer, not as the only possible backend model. PostgreSQL remains the canonical relational database.

## Contents

- `config.toml`: generated active Supabase CLI configuration. Do not edit manually for environment switching.
- `config/`: source Supabase CLI profiles for `local`, `dev`, `qa`, `uat`, `staging` and `prod`.
- `migrations/`: SQL migrations.
- `policies/`: Row-Level Security policies.
- `functions/`: Edge Function placeholders.
- `postgrest/`: PostgREST configuration notes.
- `seed.sql`: local development seed data.

## Environment Switching

Use Makefile commands instead of editing `supabase/config.toml` directly:

```bash
make supabase-use ENV=dev
make supabase-start ENV=dev
make supabase-studio
```

Studio can be toggled per environment:

```bash
make supabase-studio-enable ENV=dev
make supabase-studio-disable ENV=dev
```

Production requires explicit confirmation before Studio can be enabled:

```bash
CONFIRM_SUPABASE_PROD_STUDIO=yes make supabase-studio-enable ENV=prod
```

## Rule

Supabase and PostgREST are optional provider profiles. Do not couple business logic directly to Supabase-specific runtime behavior unless the product intentionally chooses that profile.

Supabase Studio must stay private. Use Tailscale, SSH tunneling, VPN or another private access layer for remote administrative access.
