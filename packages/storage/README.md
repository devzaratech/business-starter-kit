# Storage Package

Storage abstraction layer for local, S3-compatible and cloud object storage providers.

Initial providers:

- SeaweedFS S3-compatible storage
- AWS S3
- Azure Blob Storage
- Google Cloud Storage

Application code should depend on storage contracts, not on provider-specific SDKs directly.
