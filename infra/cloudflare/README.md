# Cloudflare Profile

Use Cloudflare as an optional public edge layer for DNS, TLS, WAF and caching.

## Rules

- Keep origin IP addresses protected where possible.
- Use explicit DNS records per environment.
- Separate development, staging and production hostnames.
- Avoid changing DNS ownership during incidents without an approved rollback plan.
