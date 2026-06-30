#!/usr/bin/env bash
set -u

cd /opt/workspace/business-starter-kit || {
  echo "FAIL: repo path not found"
}

REQUESTED="${1:-all}"

if [ "$REQUESTED" = "all" ]; then
  ENVS="dev qa uat staging prod"
else
  ENVS="$REQUESTED"
fi

TMP_ROOT="/tmp/bsk-env-diagnose"
mkdir -p "$TMP_ROOT"

http_check() {
  name="$1"
  url="$2"
  tmp="$3"

  code="$(curl -k -sS --max-time 8 -o "$tmp/body.txt" -w "%{http_code}" "$url" 2>"$tmp/error.txt" || true)"
  err="$(cat "$tmp/error.txt" 2>/dev/null || true)"

  printf "%-34s %-60s -> HTTP %s" "$name" "$url" "$code"

  if [ -n "$err" ]; then
    printf " ERR: %s" "$err"
  fi

  printf "\n"
}

check_port() {
  name="$1"
  port="$2"

  if ss -ltnp 2>/dev/null | grep -E "127\.0\.0\.1:${port}|0\.0\.0\.0:${port}|\[::1\]:${port}|\[::\]:${port}" >/dev/null; then
    echo "OK: $name listening on VPS port $port"
  else
    echo "WARN: $name NOT listening on VPS port $port"
  fi
}

diagnose_env() {
  env="$1"

  COMPOSE="infra/compose/docker-compose.${env}.yml"

  if [ "$env" = "dev" ] && [ -f "config/env/.env.dev" ]; then
    ENVFILE="config/env/.env.dev"
  elif [ -f "config/env/.env.${env}" ]; then
    ENVFILE="config/env/.env.${env}"
  else
    ENVFILE="config/env/.env.${env}.example"
  fi

  DOMAIN="bsk-${env}.devzaratech.xyz"
  TMP="${TMP_ROOT}/${env}"
  mkdir -p "$TMP"

  echo
  echo "########################################################################"
  echo "== BSK ${env^^} Services Diagnosis =="
  echo "########################################################################"
  echo "PWD=$(pwd)"
  echo "DATE=$(date -Is)"
  echo "ENV=$env"
  echo "COMPOSE=$COMPOSE"
  echo "ENVFILE=$ENVFILE"
  echo "DOMAIN=$DOMAIN"
  echo

  echo "== 1. Required files =="
  for f in "$ENVFILE" "$COMPOSE" "infra/compose/docker-compose.edge.yml" "infra/caddy/Caddyfile.multi-env"; do
    if [ -f "$f" ]; then
      echo "OK: $f"
    else
      echo "FAIL: missing $f"
    fi
  done

  echo
  echo "== 2. Compose render ${env} apps/php =="
  if docker compose \
    --env-file "$ENVFILE" \
    -f "$COMPOSE" \
    --profile apps \
    --profile php \
    config --services > "$TMP/services.txt"; then
    echo "OK: compose renders"
    cat "$TMP/services.txt"
  else
    echo "FAIL: compose render failed"
  fi

  echo
  echo "== 3. Compose config JSON =="
  if docker compose \
    --env-file "$ENVFILE" \
    -f "$COMPOSE" \
    --profile apps \
    --profile php \
    config --format json > "$TMP/compose.json"; then
    echo "OK: compose JSON rendered"
  else
    echo "FAIL: compose JSON render failed"
  fi

  echo
  echo "== 4. ${env^^}-related containers =="
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}" \
    | grep -E "NAMES|bsk-edge|bsk-${env}-|^bsk-postgres|^bsk-redis|^bsk-n8n|^bsk-seaweed" || true

  echo
  echo "== 5. Containers not running / restarting / unhealthy / exited =="
  docker ps -a --format "{{.Names}}|{{.Status}}" \
    | grep -E "bsk-${env}-|bsk-edge|^bsk-postgres|^bsk-redis|^bsk-n8n|^bsk-seaweed" \
    | grep -Ei "Exited|Restarting|Created|Dead|unhealthy" || echo "OK: no obvious stopped/restarting/unhealthy ${env}-related containers"

  echo
  echo "== 6. Published localhost ports from Compose =="
  if [ -s "$TMP/compose.json" ]; then
    python3 - "$TMP/compose.json" > "$TMP/published-ports.tsv" <<'PY'
import json
import sys

path = sys.argv[1]
cfg = json.load(open(path))

for svc_name, svc in sorted(cfg.get("services", {}).items()):
    for p in svc.get("ports", []) or []:
        if isinstance(p, dict):
            host_ip = p.get("host_ip") or p.get("hostIP") or ""
            published = p.get("published") or ""
            target = p.get("target") or ""
            proto = p.get("protocol") or "tcp"
            if published:
                print(f"{svc_name}\t{host_ip}\t{published}\t{target}\t{proto}")
PY

    if [ -s "$TMP/published-ports.tsv" ]; then
      printf "%-22s %-12s %-10s %-10s %-8s\n" "SERVICE" "HOST_IP" "HOST_PORT" "TARGET" "PROTO"
      cat "$TMP/published-ports.tsv" | while IFS=$'\t' read -r svc host_ip host_port target proto; do
        printf "%-22s %-12s %-10s %-10s %-8s\n" "$svc" "${host_ip:-127.0.0.1}" "$host_port" "$target" "$proto"
      done
    else
      echo "WARN: no published ports found in compose JSON"
    fi
  else
    echo "WARN: no compose JSON available"
  fi

  echo
  echo "== 7. VPS port listeners for Compose-published ports =="
  if [ -s "$TMP/published-ports.tsv" ]; then
    cat "$TMP/published-ports.tsv" | while IFS=$'\t' read -r svc host_ip host_port target proto; do
      check_port "${env^^} $svc" "$host_port"
    done
  else
    echo "WARN: no published ports to check"
  fi

  echo
  echo "== 8. HTTP checks from VPS localhost for known admin HTTP services =="
  if [ -s "$TMP/published-ports.tsv" ]; then
    cat "$TMP/published-ports.tsv" | while IFS=$'\t' read -r svc host_ip host_port target proto; do
      case "$svc" in
        n8n|seaweed-s3|seaweed-filer|seaweed-master)
          http_check "${env^^} $svc" "http://127.0.0.1:${host_port}/" "$TMP"
          ;;
      esac
    done
  fi

  echo
  echo "== 9. Supabase profile ports =="
  python3 - "$env" > "$TMP/supabase-ports.tsv" <<'PY'
import sys
from pathlib import Path

env = sys.argv[1]
candidates = [
    Path(f"supabase/config/{env}.toml"),
    Path(f"supabase/config.{env}.toml"),
    Path(f"supabase/{env}.config.toml"),
]

try:
    import tomllib
except Exception:
    tomllib = None

path = next((p for p in candidates if p.exists()), None)

if path is None:
    print(f"WARN\tNo Supabase config found for {env}")
    raise SystemExit(0)

if tomllib is None:
    print(f"WARN\tPython tomllib unavailable; cannot parse {path}")
    raise SystemExit(0)

data = tomllib.loads(path.read_text())

def nested(obj, *keys):
    cur = obj
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur

items = [
    ("supabase-api", nested(data, "api", "port")),
    ("supabase-db", nested(data, "db", "port")),
    ("supabase-db-shadow", nested(data, "db", "shadow_port")),
    ("supabase-studio", nested(data, "studio", "port")),
    ("supabase-mailpit", nested(data, "inbucket", "port") or nested(data, "mailpit", "port")),
    ("supabase-smtp", nested(data, "inbucket", "smtp_port") or nested(data, "mailpit", "smtp_port")),
    ("supabase-pop3", nested(data, "inbucket", "pop3_port") or nested(data, "mailpit", "pop3_port")),
    ("supabase-analytics", nested(data, "analytics", "port")),
    ("supabase-pooler", nested(data, "db", "pooler", "port")),
]

print(f"CONFIG\t{path}")
for name, port in items:
    if port:
        print(f"{name}\t{port}")
PY

  cat "$TMP/supabase-ports.tsv" || true

  echo
  echo "== 10. Supabase VPS port listeners =="
  if grep -q '^supabase-' "$TMP/supabase-ports.tsv" 2>/dev/null; then
    grep '^supabase-' "$TMP/supabase-ports.tsv" | while IFS=$'\t' read -r name port; do
      check_port "${env^^} $name" "$port"
    done
  else
    echo "WARN: no Supabase ports parsed for $env"
  fi

  echo
  echo "== 11. Supabase HTTP checks =="
  if grep -q '^supabase-' "$TMP/supabase-ports.tsv" 2>/dev/null; then
    grep -E '^supabase-(api|studio|mailpit)' "$TMP/supabase-ports.tsv" | while IFS=$'\t' read -r name port; do
      http_check "${env^^} $name" "http://127.0.0.1:${port}/" "$TMP"
    done
  else
    echo "WARN: no Supabase HTTP ports to check"
  fi

  echo
  echo "== 12. Edge network membership =="
  if docker network inspect bsk-edge >/dev/null 2>&1; then
    docker network inspect bsk-edge \
      --format '{{range $id, $c := .Containers}}{{$c.Name}} -> {{$c.IPv4Address}}{{println}}{{end}}' \
      | grep -E "bsk-edge|bsk-${env}-" || true
  else
    echo "FAIL: bsk-edge network does not exist"
  fi

  echo
  echo "== 13. Internal edge HTTP checks =="
  edge_check() {
    name="$1"
    url="$2"

    echo "-- ${env^^} $name: $url"
    docker run --rm --network bsk-edge curlimages/curl:8.10.1 -sS -i --max-time 8 "$url" 2>&1 | head -30 || true
    echo
  }

  edge_check "web" "http://bsk-${env}-web:80/"
  edge_check "api-node" "http://bsk-${env}-api-node:3001/health"
  edge_check "api-spring" "http://bsk-${env}-api-spring:8080/actuator/health"
  edge_check "api-fastapi" "http://bsk-${env}-api-fastapi:8000/health"
  edge_check "api-php" "http://bsk-${env}-api-php:8000/health"

  echo
  echo "== 14. Public checks through edge Caddy =="
  http_check "${env^^} public web" "https://${DOMAIN}/" "$TMP"
  http_check "${env^^} public spring" "https://${DOMAIN}/api/actuator/health" "$TMP"
  http_check "${env^^} public node" "https://${DOMAIN}/api/node/health" "$TMP"
  http_check "${env^^} public python" "https://${DOMAIN}/api/python/health" "$TMP"
  http_check "${env^^} public php" "https://${DOMAIN}/api/php/health" "$TMP"

  echo
  echo "== 15. Recent logs for suspicious ${env^^} containers =="
  docker ps -a --format "{{.Names}}|{{.Status}}" \
    | grep -E "bsk-${env}-" \
    | grep -Ei "Exited|Restarting|Created|Dead|unhealthy" \
    | cut -d'|' -f1 \
    | while read -r c; do
      [ -z "$c" ] && continue
      status="$(docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null || true)"
      restart="$(docker inspect "$c" --format '{{.RestartCount}}' 2>/dev/null || true)"
      echo
      echo "---- $c status=$status restart_count=$restart ----"
      docker logs --tail=60 "$c" 2>&1 || true
    done

  echo
  echo "== ${env^^} diagnosis complete =="
}

for env in $ENVS; do
  diagnose_env "$env"
done

echo
echo "########################################################################"
echo "== All requested diagnostics complete =="
echo "########################################################################"
