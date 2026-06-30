#!/usr/bin/env bash
set -u

ENV_NAME="${1:-}"

if [ -z "$ENV_NAME" ]; then
  echo "Usage: $0 <dev|qa|uat|staging|prod>"
  exit 0
fi

SRC="supabase/config/${ENV_NAME}.toml"
DST="supabase/config.toml"

if [ ! -f "$SRC" ]; then
  echo "FAIL: missing $SRC"
  exit 0
fi

mkdir -p /tmp/bsk-supabase-config-backups

if [ -f "$DST" ]; then
  cp "$DST" "/tmp/bsk-supabase-config-backups/config.toml.$(date +%Y%m%d-%H%M%S).bak"
fi

cp "$SRC" "$DST"

echo "OK: copied $SRC -> $DST"
echo
grep -nE 'project_id|^\[api\]|^\[db\]|^\[studio\]|^\[inbucket\]|^\[local_smtp\]|port =|shadow_port|smtp_port|pop3_port' "$DST" || true
