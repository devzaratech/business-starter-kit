#!/usr/bin/env bash
set -euo pipefail

: "${CF_API_TOKEN:?Missing CF_API_TOKEN}"
: "${CF_ZONE_NAME:=devzaratech.xyz}"
: "${VPS_IP:?Missing VPS_IP}"

API="https://api.cloudflare.com/client/v4"

cf() {
  curl -sS \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "$@"
}

echo "Resolving Cloudflare Zone ID for ${CF_ZONE_NAME}..."

ZONE_ID="$(
  cf "${API}/zones?name=${CF_ZONE_NAME}" \
  | jq -r '.result[0].id // empty'
)"

if [[ -z "${ZONE_ID}" ]]; then
  echo "ERROR: Could not resolve zone id for ${CF_ZONE_NAME}" >&2
  exit 1
fi

echo "Zone ID: ${ZONE_ID}"
echo "VPS IP : ${VPS_IP}"
echo

UPSERT_RECORDS=(
  "bsk-dev"
  "bsk-qa"
  "bsk-uat"
  "bsk-staging"
  "bsk-prod"
)

for NAME in "${UPSERT_RECORDS[@]}"; do
  FQDN="${NAME}.${CF_ZONE_NAME}"

  echo "Upserting ${FQDN} -> ${VPS_IP}"

  RECORD_ID="$(
    cf "${API}/zones/${ZONE_ID}/dns_records?type=A&name=${FQDN}" \
    | jq -r '.result[0].id // empty'
  )"

  PAYLOAD="$(
    jq -n \
      --arg type "A" \
      --arg name "${FQDN}" \
      --arg content "${VPS_IP}" \
      --argjson ttl 1 \
      --argjson proxied false \
      '{
        type: $type,
        name: $name,
        content: $content,
        ttl: $ttl,
        proxied: $proxied
      }'
  )"

  if [[ -z "${RECORD_ID}" ]]; then
    RESPONSE="$(
      cf -X POST "${API}/zones/${ZONE_ID}/dns_records" \
        --data "${PAYLOAD}"
    )"
  else
    RESPONSE="$(
      cf -X PATCH "${API}/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
        --data "${PAYLOAD}"
    )"
  fi

  SUCCESS="$(echo "${RESPONSE}" | jq -r '.success')"

  if [[ "${SUCCESS}" != "true" ]]; then
    echo "ERROR updating ${FQDN}" >&2
    echo "${RESPONSE}" | jq '.' >&2
    exit 1
  fi

  echo "OK: ${FQDN}"
done

echo
echo "Current BSK DNS records:"
cf "${API}/zones/${ZONE_ID}/dns_records?type=A&name.contains=bsk" \
  | jq -r '.result[] | "\(.name)\t\(.type)\t\(.content)\tproxied=\(.proxied)\tttl=\(.ttl)"'
