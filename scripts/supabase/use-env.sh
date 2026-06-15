#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${ENV:-${1:-local}}"
ENABLE_STUDIO_VALUE="${ENABLE_STUDIO:-}"
SOURCE_FILE="supabase/config/${ENVIRONMENT}.toml"
TARGET_FILE="supabase/config.toml"

usage() {
  cat <<USAGE
Usage: ENV=<local|dev|qa|uat|staging|prod> [ENABLE_STUDIO=yes|no] scripts/supabase/use-env.sh
       scripts/supabase/use-env.sh <local|dev|qa|uat|staging|prod>

Generates the active Supabase CLI config at supabase/config.toml from an environment profile.
USAGE
}

normalize_bool() {
  case "${1,,}" in
    yes|true|1|on|enabled|enable) echo "true" ;;
    no|false|0|off|disabled|disable) echo "false" ;;
    *) echo "Invalid boolean value for ENABLE_STUDIO: $1" >&2; exit 1 ;;
  esac
}

case "$ENVIRONMENT" in
  local|dev|qa|uat|staging|prod) ;;
  -h|--help|help) usage; exit 0 ;;
  *) echo "Unknown Supabase environment: $ENVIRONMENT" >&2; usage; exit 1 ;;
esac

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Missing Supabase environment profile: $SOURCE_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET_FILE")"
{
  echo "# Generated active Supabase CLI configuration."
  echo "# Source profile: ${SOURCE_FILE}"
  echo "# Do not edit manually; use Makefile Supabase commands instead."
  echo
  tail -n +5 "$SOURCE_FILE"
} > "$TARGET_FILE"

if [[ -n "$ENABLE_STUDIO_VALUE" ]]; then
  STUDIO_ENABLED="$(normalize_bool "$ENABLE_STUDIO_VALUE")"

  if [[ "$ENVIRONMENT" == "prod" && "$STUDIO_ENABLED" == "true" && "${CONFIRM_SUPABASE_PROD_STUDIO:-}" != "yes" ]]; then
    cat >&2 <<'ERROR'
Refusing to enable Supabase Studio for prod without explicit confirmation.

Re-run with:
  CONFIRM_SUPABASE_PROD_STUDIO=yes ENABLE_STUDIO=yes make supabase-use ENV=prod

Production Studio access must stay private behind Tailscale, SSH tunneling, VPN or Cloudflare Access.
ERROR
    exit 1
  fi

  tmp_file="$(mktemp)"
  awk -v value="$STUDIO_ENABLED" '
    /^\[studio\]/ { in_studio=1; print; next }
    /^\[/ && $0 !~ /^\[studio\]/ { in_studio=0; print; next }
    in_studio && /^enabled[[:space:]]*=/ { print "enabled = " value; next }
    { print }
  ' "$TARGET_FILE" > "$tmp_file"
  mv "$tmp_file" "$TARGET_FILE"
fi

if [[ "$ENVIRONMENT" == "prod" ]]; then
  echo "Active Supabase profile: prod"
  echo "Security reminder: Supabase Studio is disabled by default for prod. If enabled, keep it private."
else
  echo "Active Supabase profile: $ENVIRONMENT"
fi

./scripts/supabase/studio-url.sh || true
