# PostgREST Profile

Use this directory for PostgREST configuration notes and schema exposure rules.

Recommended approach:

- Expose only explicit API schemas.
- Avoid exposing internal platform tables directly.
- Use database views or RPC functions when necessary.
- Keep tenant filtering enforced at the database layer.
