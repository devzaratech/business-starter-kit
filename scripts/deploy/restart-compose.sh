#!/usr/bin/env bash
set -euo pipefail

TARGET_ENV="${1:-}"

if [[ -z "$TARGET_ENV" ]]; then
  echo "Usage: ./scripts/deploy/restart-compose.sh <local|dev|qa|uat|staging|prod>" >&2
  exit 1
fi

case "$TARGET_ENV" in
  local|dev|qa|uat|staging|prod)
    ;;
  *)
    echo "Unsupported environment: $TARGET_ENV" >&2
    exit 1
    ;;
esac

COMPOSE_FILE="infra/compose/docker-compose.${TARGET_ENV}.yml"
if [[ "$TARGET_ENV" == "local" ]]; then
  COMPOSE_FILE="infra/compose/docker-compose.local.yml"
fi

ENV_FILE="config/env/.env.${TARGET_ENV}.example"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment template: $ENV_FILE" >&2
  exit 1
fi

echo "Restarting Business Starter Kit stack for environment: $TARGET_ENV"
echo "Compose file: $COMPOSE_FILE"
echo "Environment template: $ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
