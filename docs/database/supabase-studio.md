# Supabase Studio

Business Starter Kit supports Supabase Studio through Supabase CLI environment profiles.

Supabase is intentionally kept at the repository root because it behaves as a PostgreSQL-based application platform profile with CLI conventions, migrations, policies, Edge Functions and Studio support. It is not just another database adapter.

## Environment Profiles

The active Supabase CLI configuration lives at:

```txt
supabase/config.toml
```

Do not edit that file manually for environment switching. It is generated from one of these source profiles:

```txt
supabase/config/local.toml
supabase/config/dev.toml
supabase/config/qa.toml
supabase/config/uat.toml
supabase/config/staging.toml
supabase/config/prod.toml
```

## Commands

```bash
make supabase-use ENV=dev
make supabase-start ENV=dev
make supabase-status
make supabase-studio
make supabase-db-reset ENV=dev
make supabase-stop
```

`make supabase-start ENV=<env>` selects the right profile, generates `supabase/config.toml`, starts the Supabase CLI stack and prints the Studio URL when Studio is enabled.

## Studio Port Matrix

| Environment | API | DB | Studio | Inbucket UI | SMTP | POP3 | Studio Default |
|---|---:|---:|---:|---:|---:|---:|---|
| Local | 54321 | 54322 | 54323 | 54324 | 54325 | 54326 | Enabled |
| Dev | 55121 | 55122 | 55123 | 55124 | 55125 | 55126 | Enabled |
| QA | 55221 | 55222 | 55223 | 55224 | 55225 | 55226 | Enabled |
| UAT | 55321 | 55322 | 55323 | 55324 | 55325 | 55326 | Enabled |
| Staging | 55421 | 55422 | 55423 | 55424 | 55425 | 55426 | Disabled |
| Prod | 55521 | 55522 | 55523 | 55524 | 55525 | 55526 | Disabled |

## Enabling or Disabling Studio

Studio can be enabled or disabled without manually editing TOML files.

For non-production environments:

```bash
make supabase-studio-enable ENV=dev
make supabase-studio-disable ENV=dev
```

For production, enabling Studio requires explicit confirmation:

```bash
CONFIRM_SUPABASE_PROD_STUDIO=yes make supabase-studio-enable ENV=prod
```

Disable production Studio with:

```bash
make supabase-studio-disable ENV=prod
```

If the Supabase CLI stack is already running, restart it for the configuration change to take effect:

```bash
make supabase-stop
make supabase-start ENV=prod
```

You can also start production with Studio enabled for a controlled private session:

```bash
CONFIRM_SUPABASE_PROD_STUDIO=yes ENABLE_STUDIO=yes make supabase-start ENV=prod
```

## Security Rule

Supabase Studio is for local or private administrative access only. If it is used on a remote VPS, expose it through Tailscale, SSH tunneling, VPN or a private access layer such as Cloudflare Access.

Do not publish Studio directly to the public internet.

Production Studio is disabled by default. Enabling it should be treated as a temporary administrative operation.

## Relationship With PostgREST

`infra/compose/docker-compose.postgrest.yml` is a lightweight PostgREST-only profile.

`supabase/config.toml` is the generated active Supabase CLI profile for the fuller Supabase workflow, including Studio when enabled.
