# Storage Provider Strategy

Application code depends on a storage **contract**, never on a provider SDK
directly. The reusable abstraction lives in `packages/storage`.

## Supported Providers

| Provider | Use case |
|---|---|
| SeaweedFS (S3-compatible) | Default lean VPS storage. |
| AWS S3 | AWS cloud profile. |
| Azure Blob Storage | Azure cloud profile. |
| Google Cloud Storage | GCP cloud profile. |

## Contract

A storage adapter should expose, at minimum:

- `put(bucket, key, stream, metadata)`
- `get(bucket, key)`
- `delete(bucket, key)`
- `exists(bucket, key)`
- `signedUrl(bucket, key, ttl)`

## Rules

- Prefer S3-compatible semantics so providers stay interchangeable.
- Never hardcode a local filesystem path as the only storage backend.
- Buckets are environment- and tenant-aware; never share a bucket across
  environments.
- Generate signed URLs for client access instead of exposing credentials.

## Migration Path

Because the default (SeaweedFS) already speaks the S3 protocol, moving to a
managed object store is mostly a configuration change (endpoint, region,
credentials), not a code rewrite.
