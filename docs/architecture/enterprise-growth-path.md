# Enterprise Growth Path

This is a roadmap, not a current implementation. It shows how a product built on
the starter kit can grow without architectural rewrites.

## Stages

### 1. Local Development
Docker Compose on a workstation. Lean infrastructure + apps via the `apps` profile.

### 2. Single VPS
One VPS running the lean Compose stack behind the reverse proxy with TLS. Suitable
for early customers and pilots.

### 3. Larger VPS
Scale vertically. Add backups, log retention, monitoring and off-host secret
storage. Keep host ports for internal services closed to the public.

### 4. Split Services
Move stateful services off the app host: managed/standalone PostgreSQL, dedicated
Redis, dedicated object storage. Run app containers separately from data services.

### 5. Managed Data Layer
Adopt a managed PostgreSQL and a managed S3-compatible object store. Because the
platform depends on contracts (storage, database), this is mostly configuration.

### 6. Cloud Deployment
Activate a cloud profile (AWS, Azure or GCP). Use managed containers, managed
cache, a managed secret store and a CDN/WAF at the edge.

### 7. Enterprise CI/CD
Promote artifacts across environments with protection rules, mandatory reviews,
SonarQube quality gates, dependency and image scanning, and audited deployments.

### 8. High Availability / Multi-Region
Run multiple replicas behind a load balancer, replicate the database, and add
multi-region routing and failover for critical tenants.

## Design Rules That Keep This Open

- Depend on contracts/adapters (storage, database, integrations), not SDKs.
- Keep secrets outside code and outside the repository.
- Keep tenant context and query filtering explicit from day one.
- Keep the same artifact promoted across environments.
- Avoid cloud-native lock-in until a cloud profile is deliberately chosen.
