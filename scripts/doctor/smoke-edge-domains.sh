#!/usr/bin/env bash
set -u

DOMAINS="
dev:bsk-dev.devzaratech.xyz
qa:bsk-qa.devzaratech.xyz
uat:bsk-uat.devzaratech.xyz
staging:bsk-staging.devzaratech.xyz
prod:bsk-prod.devzaratech.xyz
"

PATHS="
/
 /api/actuator/health
 /api/node/health
 /api/python/health
 /api/php/health
"

echo "== BSK Edge Domain Smoke Test =="

for item in $DOMAINS; do
  env="${item%%:*}"
  domain="${item#*:}"

  echo
  echo "---- $env / $domain ----"

  for path in $PATHS; do
    url="https://${domain}${path}"
    code="$(curl -k -sS -o /tmp/bsk-smoke-body.txt -w "%{http_code}" "$url" 2>/tmp/bsk-smoke-error.txt || true)"

    if [ -s /tmp/bsk-smoke-error.txt ]; then
      err="$(cat /tmp/bsk-smoke-error.txt)"
    else
      err=""
    fi

    printf "%-30s -> HTTP %s" "$path" "$code"

    if [ -n "$err" ]; then
      printf "  ERR: %s" "$err"
    fi

    printf "\n"
  done
done
