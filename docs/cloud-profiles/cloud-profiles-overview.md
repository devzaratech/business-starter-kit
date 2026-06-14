# Cloud Profiles Overview

Cloud profiles are optional deployment paths for growing beyond the lean VPS model.

## Supported Profiles

- VPS with Docker Compose
- AWS
- Azure
- GCP

## Design Rule

The platform must not require cloud-native infrastructure to run. Cloud profiles should be optional upgrades.

## Migration Philosophy

Start with simple infrastructure, but avoid architectural decisions that block future migration.

Examples:

- Use S3-compatible storage contracts.
- Avoid hardcoded local filesystem storage.
- Keep secrets outside the source code.
- Keep infrastructure definitions separated by provider.
- Use provider adapters instead of provider-specific logic in the core.
