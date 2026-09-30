# Cloudflare Profile

Use Cloudflare as an optional public edge layer for DNS, TLS, WAF and caching.

## Rules

- Keep origin IP addresses protected where possible.
- Use explicit DNS records per environment.
- Separate development, staging and production hostnames.
- Avoid changing DNS ownership during incidents without an approved rollback plan.

## Remaining client-IP trust risk

The current Caddy profiles copy `CF-Connecting-IP` into `X-Real-IP` and
`X-Forwarded-For`, while the origin can still be reached directly and DNS may
temporarily use `proxied=false`. A direct client can therefore supply an
untrusted value in these headers. The current applications do not use the
forwarded client IP for authorization, rate-limit identity, audit identity or
another security decision, so this is not presently an application security
boundary. Keep treating these headers as untrusted metadata until origin access
is restricted to trusted proxies and the proxy trust chain is configured and
tested.
