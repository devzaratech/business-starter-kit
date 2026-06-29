#!/usr/bin/env bash
set -euo pipefail

: "${CF_API_TOKEN:?Missing CF_API_TOKEN}"
: "${CF_ZONE_NAME:=devzaratech.xyz}"
: "${PROXIED:=true}"

API="https://api.cloudflare.com/client/v4"

cf() {
  curl -sS \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "$@"
}

ZONE_ID="$(
  cf "${API}/zones?name=${CF_ZONE_NAME}" \
  | jq -r '.result[0].id // empty'
)"

if [[ -z "${ZONE_ID}" ]]; then
  echo "ERROR: Could not resolve zone id for ${CF_ZONE_NAME}" >&2
  exit 1
fi

RECORDS=(
  "bsk-dev"
  "bsk-qa"
  "bsk-uat"
  "bsk-staging"
  "bsk-prod"
)

for NAME in "${RECORDS[@]}"; do
  FQDN="${NAME}.${CF_ZONE_NAME}"
  echo "Setting proxied=${PROXIED} for ${FQDN}"

  RECORD_ID="$(
    cf "${API}/zones/${ZONE_ID}/dns_records?type=A&name=${FQDN}" \
    | jq -r '.result[0].id // empty'
  )"

  if [[ -z "${RECORD_ID}" ]]; then
    echo "WARN: Missing record ${FQDN}, skipping"
    continue
  fi

  RESPONSE="$(
    cf -X PATCH "${API}/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
      --data "$(jq -n --argjson proxied "${PROXIED}" '{proxied: $proxied}')"
  )"

  SUCCESS="$(echo "${RESPONSE}" | jq -r '.success')"

  if [[ "${SUCCESS}" != "true" ]]; then
    echo "ERROR updating ${FQDN}" >&2
    echo "${RESPONSE}" | jq '.' >&2
    exit 1
  fi

  echo "OK: ${FQDN}"
done
