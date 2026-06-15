#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${ENV:-${1:-local}}"

./scripts/supabase/use-env.sh "$ENVIRONMENT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed or not available in PATH." >&2
  echo "Install it before running Supabase local profiles." >&2
  exit 127
fi

supabase start
