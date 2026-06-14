-- Initial platform schema placeholder.
-- Keep this file generic and sanitized.

create schema if not exists platform;

create table if not exists platform.tenants (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.audit_events (
  id uuid primary key,
  tenant_id uuid references platform.tenants(id),
  actor_user_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
