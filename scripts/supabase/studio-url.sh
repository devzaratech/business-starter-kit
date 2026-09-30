#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="supabase/config.toml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Supabase config not found: $CONFIG_FILE" >&2
  exit 1
fi

PORT="$(awk '
  /^\[studio\]/ {inside=1; next}
  /^\[/ {inside=0}
  inside && $1 == "port" {
    gsub(/"/, "", $3)
    print $3
    exit
  }
' "$CONFIG_FILE")"

PORT="${PORT:-54323}"

echo "Supabase Studio: http://127.0.0.1:${PORT}"
