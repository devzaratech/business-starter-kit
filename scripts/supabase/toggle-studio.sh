#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"
ENVIRONMENT="${ENV:-${2:-local}}"

case "$ACTION" in
  enable) export ENABLE_STUDIO=yes ;;
  disable) export ENABLE_STUDIO=no ;;
  *)
    echo "Usage: scripts/supabase/toggle-studio.sh <enable|disable> [environment]" >&2
    exit 1
    ;;
esac

./scripts/supabase/use-env.sh "$ENVIRONMENT"

cat <<MSG
Supabase Studio has been ${ACTION}d in the generated active config.

If the Supabase stack is already running, restart it for the change to apply:
  make supabase-stop
  make supabase-start ENV=${ENVIRONMENT}
MSG
