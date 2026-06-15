#!/usr/bin/env bash
set -euo pipefail

FORBIDDEN_PATTERNS=(
  "real_customer_name"
  "production_password"
  "secret_access_key_value"
  "private_key_value"
  "net-control-tower"
  "netployee"
  "logistics-control-tower"
)

echo "Running basic sanitization checks..."

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if grep -RIn --exclude-dir=.git --exclude='check-sanitization.sh' "$pattern" .; then
    echo "Potential forbidden pattern found: $pattern"
    exit 1
  fi
done

echo "Sanitization checks passed."
