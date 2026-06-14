# Tailscale Profile

Use this profile when administration services should be reachable only through a private Tailnet.

Recommended private-only services:

- PostgreSQL
- Redis
- n8n administration
- Supabase Studio
- Internal dashboards
- Object storage administration

Public exposure should be limited to the application frontend and public API gateway.
