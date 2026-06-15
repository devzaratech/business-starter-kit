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
ENV_FILE="${ENV_FILE:-config/env/.env.${TARGET_ENV}}"
EXAMPLE_ENV_FILE="config/env/.env.${TARGET_ENV}.example"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing runtime env file: $ENV_FILE" >&2
  echo "Create it from the template and replace every placeholder before deploying:" >&2
  echo "  cp $EXAMPLE_ENV_FILE $ENV_FILE" >&2
  echo "  nano $ENV_FILE" >&2
  exit 1
fi

case "$ENV_FILE" in
  *.example)
    if [[ "${ALLOW_EXAMPLE_ENV:-no}" != "yes" ]]; then
      echo "Refusing to deploy with example env file: $ENV_FILE" >&2
      echo "Use a real runtime env file, or set ALLOW_EXAMPLE_ENV=yes only for disposable local tests." >&2
      exit 1
    fi
    ;;
esac

./scripts/quality/validate-env.sh "$ENV_FILE"

echo "Restarting Business Starter Kit stack for environment: $TARGET_ENV"
echo "Compose file: $COMPOSE_FILE"
echo "Runtime env file: $ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull || true
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
