# Security Baseline

Security must be part of the starter kit from the beginning.

## Baseline Controls

- No secrets in Git.
- Environment-specific configuration.
- Strong password and token generation.
- TLS for public endpoints.
- Private networking for internal services.
- Least-privilege credentials.
- RBAC for application access.
- Audit logs for sensitive operations.
- Backup and restore testing.
- Dependency scanning before production releases.

## Recommended Security Events to Audit

- Login success
- Login failure
- Password reset request
- Role assignment
- Permission change
- Tenant switch
- Data export
- File upload
- File download
- API key creation
- API key revocation
- Integration credential update
