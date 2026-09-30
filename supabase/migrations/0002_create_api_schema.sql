-- Create the API schema expected by Supabase/PostgREST.
-- This schema is intended for explicit API-facing views, functions and RPCs.

create schema if not exists api;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema api to anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema api to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema api to service_role;
    grant all privileges on schema api to service_role;
  end if;

  if exists (select 1 from pg_roles where rolname = 'postgres') then
    grant all privileges on schema api to postgres;
  end if;
end
$$;

create or replace function api.health()
returns json
language sql
stable
as $$
  select json_build_object(
    'service', 'supabase-postgrest',
    'schema', 'api',
    'status', 'ok'
  );
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function api.health() to anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function api.health() to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function api.health() to service_role;
  end if;
end
$$;
