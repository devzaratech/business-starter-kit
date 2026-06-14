# Release Strategy

Releases promote a known, tested artifact through environments. The same build is
promoted; environment differences come from configuration, not code forks.

## Versioning

Use Semantic Versioning: `MAJOR.MINOR.PATCH`.

- `MAJOR` – incompatible changes.
- `MINOR` – backward-compatible features.
- `PATCH` – backward-compatible fixes.

## Branch and Tag Model

```txt
feature/*  -> develop  -> release/*  -> main
                                         └─ tag vX.Y.Z
```

| Branch / Tag | Meaning |
|---|---|
| `develop` | Integrated, possibly unstable changes (Dev). |
| `release/*` | Stabilization candidate (QA/UAT). |
| `main` | Release-ready (Staging). |
| `vX.Y.Z` tag | Production release candidate. |

## Release Flow

1. Cut a `release/*` branch from `develop`.
2. Stabilize through QA and UAT; only fixes go onto the release branch.
3. Merge to `main` and rehearse on Staging.
4. Tag `vX.Y.Z`. The release workflow validates the candidate.
5. Deploy the tagged artifact to Production with approval and a rollback plan.

## Production Release Checklist

- Tested, immutable artifact / image tag.
- Staging validation completed.
- Database migration plan (and rollback).
- Rollback plan for the deployment itself.
- Monitoring and on-call ready.
- Release notes written.

## Rollback

Prefer redeploying the previous known-good image tag. Never hotfix directly in
production without recording the change and back-porting it to the proper branch.
