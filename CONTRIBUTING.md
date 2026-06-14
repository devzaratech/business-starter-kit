# Contributing

This is a private starter kit. Contributions must keep the repository sanitized and reusable.

## Rules

- Do not commit secrets.
- Do not commit customer data.
- Do not mention real customer names, domains or internal projects.
- Keep documentation in English.
- Keep platform modules generic.
- Keep product-specific logic inside examples or external product repositories.

## Commit Style

Use conventional commits when possible:

```txt
feat: add tenant context module
fix: correct storage provider configuration
docs: add deployment notes
chore: update repository structure
```


## Testing Policy

Every change that modifies reusable platform behavior must include or update tests. At minimum, contributors should run:

```bash
make test
```

Do not merge changes that bypass tenant isolation, RBAC, auditability, storage abstractions or deployment safety checks without explicit review.
