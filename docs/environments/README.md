# Environment Strategy

Business Starter Kit supports six execution contexts:

- Local: developer workstation environment.
- Dev: shared development environment for integrated but unstable changes.
- QA: technical validation environment for automated and manual quality checks.
- UAT: business validation environment for product owners, stakeholders and selected users.
- Staging: production-like environment used to rehearse releases before going live.
- Prod: live production environment used by real customers.

The platform separates runtime configuration from application code. Each environment must use isolated databases, storage buckets, secrets, domains, logs and deployment policies.
