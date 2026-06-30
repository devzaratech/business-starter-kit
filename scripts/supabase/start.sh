#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-dev}"
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cd "$ROOT_DIR"

./scripts/supabase/use-env.sh "$ENVIRONMENT"

echo "Starting Supabase local profile through Dockerized Supabase CLI..."
./scripts/supabase/supabase-cli.sh start
