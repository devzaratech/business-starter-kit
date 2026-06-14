#!/usr/bin/env bash
#
# Validate an environment file before using it at runtime.
#
# Checks:
#   1. The file exists.
#   2. A minimal core set of keys is present.
#   3. No placeholder values (change_me / change-me) remain in REAL env files.
#      (*.example files are allowed to contain placeholders.)
#
# Usage:
#   ./scripts/quality/validate-env.sh [path-to-env-file]
#
# Default: .env in the repository root.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  exit 1
fi

echo "Validating env file: $ENV_FILE"

# Minimal core keys every runtime needs. JWT secret accepts either spelling.
REQUIRED_KEYS=(
  "POSTGRES_DB"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
)

errors=0

for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    echo "  MISSING required key: ${key}"
    errors=$((errors + 1))
  fi
done

# Require some JWT secret to be present (either JWT_SECRET or JWT_* signing key).
if ! grep -qE "^JWT_SECRET=|^JWT_SIGNING_KEY=" "$ENV_FILE"; then
  echo "  MISSING a JWT secret (JWT_SECRET or JWT_SIGNING_KEY)"
  errors=$((errors + 1))
fi

# Placeholder check only for real (non-example) files.
case "$ENV_FILE" in
  *.example)
    echo "  (example file: placeholder values are allowed)"
    ;;
  *)
    if grep -qiE "change[_-]?me" "$ENV_FILE"; then
      echo "  PLACEHOLDER values still present (change_me / change-me):"
      grep -niE "change[_-]?me" "$ENV_FILE" | sed 's/^/    /'
      errors=$((errors + 1))
    fi
    ;;
esac

if [[ "$errors" -gt 0 ]]; then
  echo "Validation FAILED with ${errors} issue(s)."
  exit 1
fi

echo "Validation passed."
