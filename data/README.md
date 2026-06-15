# Data Provider Profiles

This folder documents and reserves provider-specific data-layer assets that do not belong in deployable applications or reusable packages.

Business Starter Kit keeps PostgreSQL as the canonical default database while preparing clean extension points for enterprise and specialized providers.

## Provider Groups

```txt
data/
├── relational/   # PostgreSQL, MS SQL Server, Oracle, MySQL/MariaDB
├── document/     # MongoDB and other document stores
├── cache/        # Redis and ephemeral stores
├── search/       # OpenSearch/Elasticsearch-compatible profiles
└── analytics/    # ClickHouse or analytical stores
```

## Design Rule

Do not couple business logic directly to a database vendor. Provider-specific SQL, migrations, indexes, drivers and runtime profiles must stay isolated behind adapters, repositories, migrations and documentation.

Supabase intentionally remains at the repository root because it behaves as a PostgreSQL-based application platform profile with CLI conventions, migrations, policies, functions and Studio support, not as a simple database adapter.
