#!/usr/bin/env bash
set -u

cd /opt/workspace/business-starter-kit || {
  echo "FAIL: repo path not found"
}

ENVFILE="config/env/.env.dev"
COMPOSE="infra/compose/docker-compose.dev.yml"
TMP="/tmp/bsk-dev-diagnose"
mkdir -p "$TMP"

echo "== BSK DEV Services Diagnosis =="
echo "PWD=$(pwd)"
echo "DATE=$(date -Is)"
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
echo "== 2. Compose render DEV apps/php =="
if docker compose \
  --env-file "$ENVFILE" \
  -f "$COMPOSE" \
  --profile apps \
  --profile php \
  config --services > "$TMP/dev-services.txt"; then
  echo "OK: compose renders"
  cat "$TMP/dev-services.txt"
else
  echo "FAIL: compose render failed"
fi

echo
echo "== 3. DEV-related containers =="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}" \
  | grep -E "NAMES|bsk-edge|bsk-dev|bsk-postgres|bsk-redis|bsk-n8n|bsk-seaweed|bsk-web|bsk-api" || true

echo
echo "== 4. Containers not running / restarting / exited =="
docker ps -a --format "{{.Names}}|{{.Status}}" \
  | grep -E "bsk-dev|bsk-edge|bsk-postgres|bsk-redis|bsk-n8n|bsk-seaweed|bsk-web|bsk-api" \
  | grep -Ei "Exited|Restarting|Created|Dead" || echo "OK: no obvious stopped/restarting DEV-related containers"

echo
echo "== 5. Published localhost ports on VPS =="
check_port() {
  name="$1"
  port="$2"

  if ss -ltnp 2>/dev/null | grep -E "127\.0\.0\.1:${port}|0\.0\.0\.0:${port}|\[::1\]:${port}|\[::\]:${port}" >/dev/null; then
    echo "OK: $name listening on VPS port $port"
    ss -ltnp 2>/dev/null | grep -E "127\.0\.0\.1:${port}|0\.0\.0\.0:${port}|\[::1\]:${port}|\[::\]:${port}" || true
  else
    echo "WARN: $name NOT listening on VPS port $port"
  fi
}

check_port "DEV n8n" 15678
check_port "DEV Postgres" 15432
check_port "DEV Redis" 16379
check_port "DEV Seaweed S3" 18333
check_port "DEV Seaweed Filer" 18888
check_port "DEV Seaweed Master" 19333
check_port "DEV Supabase API" 15121
check_port "DEV Supabase DB" 15122
check_port "DEV Supabase Studio" 15123
check_port "DEV Supabase Mailpit" 15124

echo
echo "== 6. HTTP checks from VPS localhost =="
http_check() {
  name="$1"
  url="$2"

  code="$(curl -k -sS -o "$TMP/body.txt" -w "%{http_code}" "$url" 2>"$TMP/error.txt" || true)"
  err="$(cat "$TMP/error.txt" 2>/dev/null || true)"

  printf "%-28s %-45s -> HTTP %s" "$name" "$url" "$code"

  if [ -n "$err" ]; then
    printf " ERR: %s" "$err"
  fi

  printf "\n"
}

http_check "n8n" "http://127.0.0.1:15678/"
http_check "Seaweed S3" "http://127.0.0.1:18333/"
http_check "Seaweed Filer" "http://127.0.0.1:18888/"
http_check "Seaweed Master" "http://127.0.0.1:19333/"
http_check "Supabase API" "http://127.0.0.1:15121/"
http_check "Supabase Studio" "http://127.0.0.1:15123/"
http_check "Supabase Mailpit" "http://127.0.0.1:15124/"

echo
echo "== 7. Edge network =="
if docker network inspect bsk-edge >/dev/null 2>&1; then
  echo "OK: bsk-edge exists"
  docker network inspect bsk-edge \
    --format '{{range $id, $c := .Containers}}{{$c.Name}} -> {{$c.IPv4Address}}{{println}}{{end}}' || true
else
  echo "FAIL: bsk-edge network does not exist"
fi

echo
echo "== 8. Internal edge HTTP checks =="
edge_check() {
  name="$1"
  url="$2"

  echo "-- $name: $url"
  docker run --rm --network bsk-edge curlimages/curl:8.10.1 -sS -i --max-time 8 "$url" 2>&1 | head -40 || true
  echo
}

edge_check "web" "http://bsk-dev-web:80/"
edge_check "api-node" "http://bsk-dev-api-node:3001/health"
edge_check "api-spring" "http://bsk-dev-api-spring:8080/actuator/health"
edge_check "api-fastapi" "http://bsk-dev-api-fastapi:8000/health"
edge_check "api-php" "http://bsk-dev-api-php:8000/health"

echo
echo "== 9. Public DEV checks through edge Caddy =="
http_check "DEV public web" "https://bsk-dev.devzaratech.xyz/"
http_check "DEV public spring" "https://bsk-dev.devzaratech.xyz/api/actuator/health"
http_check "DEV public node" "https://bsk-dev.devzaratech.xyz/api/node/health"
http_check "DEV public python" "https://bsk-dev.devzaratech.xyz/api/python/health"
http_check "DEV public php" "https://bsk-dev.devzaratech.xyz/api/php/health"

echo
echo "== 10. Recent logs for suspicious DEV containers =="
for c in \
  bsk-dev-web \
  bsk-dev-api-spring \
  bsk-dev-api-node \
  bsk-dev-api-fastapi \
  bsk-dev-api-php \
  bsk-dev-worker \
  bsk-dev-n8n \
  bsk-dev-postgres \
  bsk-dev-redis \
  bsk-dev-seaweed-master \
  bsk-dev-seaweed-filer \
  bsk-dev-seaweed-s3 \
  bsk-edge-reverse-proxy
do
  if docker inspect "$c" >/dev/null 2>&1; then
    status="$(docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null || true)"
    restart="$(docker inspect "$c" --format '{{.RestartCount}}' 2>/dev/null || true)"
    echo
    echo "---- $c status=$status restart_count=$restart ----"
    docker logs --tail=40 "$c" 2>&1 || true
  fi
done

echo
echo "== Diagnosis complete =="
