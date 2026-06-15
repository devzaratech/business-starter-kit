#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${SUPABASE_CONFIG_FILE:-supabase/config.toml}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing Supabase active config: $CONFIG_FILE" >&2
  echo "Run: make supabase-use ENV=local" >&2
  exit 1
fi

studio_value() {
  local key="$1"
  awk -v wanted="$key" '
    /^\[studio\]/ { in_studio=1; next }
    /^\[/ && $0 !~ /^\[studio\]/ { in_studio=0; next }
    in_studio && $1 == wanted { gsub(/[[:space:]"]/, "", $3); print $3; exit }
  ' "$CONFIG_FILE"
}

ENABLED="$(studio_value enabled || true)"
PORT="$(studio_value port || true)"

if [[ "$ENABLED" != "true" ]]; then
  echo "Supabase Studio: disabled in $CONFIG_FILE"
  exit 0
fi

if [[ -z "$PORT" ]]; then
  echo "Supabase Studio: enabled, but no port was found in $CONFIG_FILE" >&2
  exit 1
fi

echo "Supabase Studio: http://127.0.0.1:${PORT}"
