#!/usr/bin/env bash
set -euo pipefail

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.108.0}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
  TTY_ARGS=(-it)
fi

exec docker run --rm "${TTY_ARGS[@]}" \
  --network host \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "${PROJECT_DIR}:${PROJECT_DIR}" \
  -w "${PROJECT_DIR}" \
  -e SUPABASE_TELEMETRY_DISABLED=1 \
  -e npm_config_update_notifier=false \
  -e npm_config_fund=false \
  -e npm_config_audit=false \
  "${NODE_IMAGE}" \
  npx -y "supabase@${SUPABASE_CLI_VERSION}" "$@"
