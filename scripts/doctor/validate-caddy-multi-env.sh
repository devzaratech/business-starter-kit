#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

ENVS=(dev qa uat staging prod)
SERVICES=(web api-spring api-node api-fastapi api-php)
TMP_DIR="$(mktemp -d)"

FAIL=0

echo "== Validate Caddy multi-env readiness =="
echo

if [ ! -f "infra/caddy/Caddyfile.multi-env" ]; then
  echo "FAIL: infra/caddy/Caddyfile.multi-env does not exist"
  exit 1
fi

echo "== 1. Render Compose with apps/php profiles =="
for env in "${ENVS[@]}"; do
  file="infra/compose/docker-compose.${env}.yml"
  envfile="config/env/.env.${env}.example"
  [ "$env" = "dev" ] && envfile="config/env/.env.dev"

  if [ ! -f "$file" ]; then
    echo "WARN: missing $file"
    continue
  fi

  if [ ! -f "$envfile" ]; then
    echo "FAIL: missing env file $envfile"
    FAIL=1
    continue
  fi

  out="$TMP_DIR/${env}.yml"

  echo "Rendering $env..."
  if ! docker compose \
    --env-file "$envfile" \
    -f "$file" \
    --profile apps \
    --profile php \
    config > "$out"; then
    echo "FAIL: compose config failed for $env"
    FAIL=1
  fi
done

echo
echo "== 2. Check expected container names for Caddy upstreams =="
for env in "${ENVS[@]}"; do
  out="$TMP_DIR/${env}.yml"
  [ -f "$out" ] || continue

  echo "-- $env --"

  for svc in "${SERVICES[@]}"; do
    expected="container_name: bsk-${env}-${svc}"

    if grep -qF "$expected" "$out"; then
      echo "OK: bsk-${env}-${svc}"
    else
      echo "WARN: missing bsk-${env}-${svc}"
      echo "      Caddy route to bsk-${env}-${svc} will fail unless that service is intentionally disabled."
    fi
  done
done

echo
echo "== 3. Check reverse-proxy public port bindings =="
for env in "${ENVS[@]}"; do
  out="$TMP_DIR/${env}.yml"
  [ -f "$out" ] || continue

  if grep -q "container_name: bsk-${env}-reverse-proxy" "$out"; then
    echo "-- $env reverse-proxy exists --"

    awk '
      /reverse-proxy:/ {in_rp=1}
      in_rp && /^  [A-Za-z0-9_-]+:/ && $1 != "reverse-proxy:" {in_rp=0}
      in_rp && /published:/ {print "  " $0}
      in_rp && /target:/ {print "  " $0}
      in_rp && /host_ip:/ {print "  " $0}
    ' "$out"
  fi
done

echo
echo "NOTE:"
echo "For true multi-env on one VPS, only ONE Caddy should bind 0.0.0.0:80 and 0.0.0.0:443."
echo "The other environments should expose app containers only through Docker networks."

echo
echo "== 4. Check for shared edge network reference =="
for env in "${ENVS[@]}"; do
  out="$TMP_DIR/${env}.yml"
  [ -f "$out" ] || continue

  if grep -q "bsk-edge" "$out"; then
    echo "OK: $env references bsk-edge"
  else
    echo "WARN: $env does not reference bsk-edge"
    echo "      Caddy multi-env may not resolve bsk-${env}-api-* containers unless they share a Docker network."
  fi
done

echo
echo "== 5. Validate Caddyfile.multi-env syntax =="
if docker run --rm \
  -v "$ROOT_DIR/infra/caddy/Caddyfile.multi-env:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile; then
  echo "OK: Caddyfile.multi-env syntax is valid"
else
  echo "FAIL: Caddyfile.multi-env syntax invalid"
  FAIL=1
fi

echo
echo "== 6. Check Caddyfile upstream names =="
for env in "${ENVS[@]}"; do
  for svc in "${SERVICES[@]}"; do
    name="bsk-${env}-${svc}"
    if grep -qF "$name" infra/caddy/Caddyfile.multi-env; then
      echo "OK: Caddyfile references $name"
    else
      echo "WARN: Caddyfile does not reference $name"
    fi
  done
done

rm -rf "$TMP_DIR"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "DONE: validation completed. Review WARN lines before activating multi-env Caddy."
else
  echo "DONE WITH FAILURES"
  exit 1
fi
