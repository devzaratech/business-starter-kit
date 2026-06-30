#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ENVS=(local dev qa uat staging prod vps)

TMP_DIR="$(mktemp -d)"
PORTS_FILE="$TMP_DIR/ports.tsv"
CONTAINERS_FILE="$TMP_DIR/containers.tsv"
SERVICES_FILE="$TMP_DIR/services.tsv"

: > "$PORTS_FILE"
: > "$CONTAINERS_FILE"
: > "$SERVICES_FILE"

echo "== Business Starter Kit Environment / Port Matrix =="
echo

for ENV in "${ENVS[@]}"; do
  COMPOSE_FILE="infra/compose/docker-compose.${ENV}.yml"

  if [ ! -f "$COMPOSE_FILE" ]; then
    continue
  fi

  ENV_FILE="config/env/.env.${ENV}"
  if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="config/env/.env.${ENV}.example"
  fi

  if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE=".env.example"
  fi

  OUT="$TMP_DIR/${ENV}.yml"

  echo "---- $ENV ----"
  echo "compose: $COMPOSE_FILE"
  echo "envfile: $ENV_FILE"

  if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config > "$OUT" 2>"$TMP_DIR/${ENV}.err"; then
    echo "ERROR: docker compose config failed for $ENV"
    cat "$TMP_DIR/${ENV}.err"
    echo
    continue
  fi

  awk -v env="$ENV" '
    /^services:/ {in_services=1; next}
    /^(networks|volumes|secrets|configs):/ {in_services=0}
    in_services && /^  [A-Za-z0-9_-]+:/ {
      svc=$1
      gsub(":", "", svc)
      print env "\t" svc
    }
  ' "$OUT" >> "$SERVICES_FILE"

  awk -v env="$ENV" '
    /^  [A-Za-z0-9_-]+:/ {
      svc=$1
      gsub(":", "", svc)
    }
    /^[[:space:]]+container_name:/ {
      name=$2
      gsub("\"", "", name)
      print env "\t" svc "\t" name
    }
  ' "$OUT" >> "$CONTAINERS_FILE"

  awk -v env="$ENV" '
    /^  [A-Za-z0-9_-]+:/ {
      svc=$1
      gsub(":", "", svc)
      host_ip=""
      published=""
      target=""
      protocol=""
    }
    /^[[:space:]]+host_ip:/ {
      host_ip=$2
      gsub("\"", "", host_ip)
    }
    /^[[:space:]]+published:/ {
      published=$2
      gsub("\"", "", published)
    }
    /^[[:space:]]+target:/ {
      target=$2
      gsub("\"", "", target)
    }
    /^[[:space:]]+protocol:/ {
      protocol=$2
      gsub("\"", "", protocol)
      if (published != "") {
        if (host_ip == "") host_ip="0.0.0.0"
        print env "\t" svc "\t" host_ip "\t" published "\t" target "\t" protocol
      }
      host_ip=""
      published=""
      target=""
      protocol=""
    }
  ' "$OUT" >> "$PORTS_FILE"

  echo
done

echo
echo "== Services by environment =="
column -t -s $'\t' "$SERVICES_FILE" 2>/dev/null || cat "$SERVICES_FILE"

echo
echo "== Published ports =="
if [ -s "$PORTS_FILE" ]; then
  printf "ENV\tSERVICE\tHOST_IP\tHOST_PORT\tCONTAINER_PORT\tPROTO\n"
  column -t -s $'\t' "$PORTS_FILE" 2>/dev/null || cat "$PORTS_FILE"
else
  echo "No published ports detected."
fi

echo
echo "== Fixed container names =="
if [ -s "$CONTAINERS_FILE" ]; then
  printf "ENV\tSERVICE\tCONTAINER_NAME\n"
  column -t -s $'\t' "$CONTAINERS_FILE" 2>/dev/null || cat "$CONTAINERS_FILE"
else
  echo "No fixed container_name detected."
fi

echo
echo "== Duplicate published host ports across environments =="
if [ -s "$PORTS_FILE" ]; then
  awk -F'\t' '
    {
      key=$3 ":" $4 "/" $6
      count[key]++
      rows[key]=rows[key] "\n  - " $1 " / " $2 " -> " $3 ":" $4 " => " $5 "/" $6
    }
    END {
      found=0
      for (k in count) {
        if (count[k] > 1) {
          found=1
          print "DUPLICATE " k rows[k]
        }
      }
      if (!found) print "No duplicate published host ports detected."
    }
  ' "$PORTS_FILE"
else
  echo "No published ports detected."
fi

echo
echo "== Duplicate fixed container_name across environments =="
if [ -s "$CONTAINERS_FILE" ]; then
  awk -F'\t' '
    {
      key=$3
      count[key]++
      rows[key]=rows[key] "\n  - " $1 " / " $2 " -> " $3
    }
    END {
      found=0
      for (k in count) {
        if (count[k] > 1) {
          found=1
          print "DUPLICATE " k rows[k]
        }
      }
      if (!found) print "No duplicate fixed container names detected."
    }
  ' "$CONTAINERS_FILE"
else
  echo "No fixed container_name detected."
fi

echo
echo "== Public exposure warning =="
if [ -s "$PORTS_FILE" ]; then
  awk -F'\t' '
    $3 == "0.0.0.0" || $3 == "::" {
      print "PUBLIC_BIND " $1 " / " $2 " -> " $3 ":" $4 " => " $5 "/" $6
    }
  ' "$PORTS_FILE" || true
else
  echo "No published ports detected."
fi

echo
echo "== Recommended interpretation =="
echo "- 0.0.0.0:80 and 0.0.0.0:443 are expected only for the public reverse proxy."
echo "- Admin tools should bind to 127.0.0.1 only: n8n, Supabase Studio, Mailpit, SeaweedFS Master/Filer/S3, Postgres, Redis."
echo "- Duplicate container_name values mean those environments cannot run simultaneously on the same Docker host."
echo "- Duplicate host ports mean those environments cannot run simultaneously unless ports are parameterized per environment."

rm -rf "$TMP_DIR"
