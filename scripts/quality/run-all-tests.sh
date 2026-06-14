#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Running Spring Boot tests..."
(cd apps/api-spring && mvn --batch-mode test)

echo "Installing Node workspace dependencies..."
npm install

echo "Running Node workspace tests..."
npm test

echo "Validating Docker Compose files..."
for file in infra/compose/docker-compose.*.yml; do
  echo "Validating $file"
  docker compose -f "$file" config >/dev/null
done

echo "All local quality checks passed."
