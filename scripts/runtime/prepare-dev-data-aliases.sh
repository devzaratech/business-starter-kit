#!/usr/bin/env bash
set -u

FAIL=0

CONFIG_JSON="/tmp/bsk-dev-compose-config.json"

docker compose \
  --env-file config/env/.env.dev \
  -f infra/compose/docker-compose.dev.yml \
  --profile apps \
  --profile php \
  config --format json > "$CONFIG_JSON" || {
    echo "FAIL: could not render dev compose config"
    exit 0
  }

DEV_INTERNAL_NETWORK="$(python3 - <<'PY'
import json
from pathlib import Path

cfg = json.loads(Path("/tmp/bsk-dev-compose-config.json").read_text())
networks = cfg.get("networks", {})

selected_key = None

for key in networks:
    if "internal" in key:
        selected_key = key
        break

if selected_key is None:
    for svc_name in ("api-spring", "api-node", "api-fastapi", "api-php", "web"):
        svc = cfg.get("services", {}).get(svc_name, {})
        svc_networks = svc.get("networks", {})
        if isinstance(svc_networks, list):
            for n in svc_networks:
                if "edge" not in n:
                    selected_key = n
                    break
        elif isinstance(svc_networks, dict):
            for n in svc_networks:
                if "edge" not in n:
                    selected_key = n
                    break
        if selected_key:
            break

if selected_key is None:
    raise SystemExit("")

net = networks.get(selected_key, {})
print(net.get("name") or selected_key)
PY
)"

if [ -z "$DEV_INTERNAL_NETWORK" ]; then
  echo "FAIL: could not detect DEV internal network"
  echo "VALIDATION_FAIL=1"
  exit 0
fi

echo "DEV_INTERNAL_NETWORK=$DEV_INTERNAL_NETWORK"

if ! docker network inspect "$DEV_INTERNAL_NETWORK" >/dev/null 2>&1; then
  echo "Creating network $DEV_INTERNAL_NETWORK..."
  docker network create "$DEV_INTERNAL_NETWORK" >/dev/null || FAIL=1
fi

connect_data() {
  container="$1"
  shift

  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "WARN: data container $container does not exist"
    return
  fi

  if docker inspect "$container" --format '{{json .NetworkSettings.Networks}}' | grep -q "\"$DEV_INTERNAL_NETWORK\""; then
    echo "OK: $container already connected to $DEV_INTERNAL_NETWORK"
    return
  fi

  args=()
  for alias in "$@"; do
    args+=(--alias "$alias")
  done

  echo "Connecting $container to $DEV_INTERNAL_NETWORK aliases: $*"
  if docker network connect "${args[@]}" "$DEV_INTERNAL_NETWORK" "$container"; then
    echo "OK: $container connected"
  else
    echo "FAIL: could not connect $container"
    FAIL=1
  fi
}

connect_data bsk-postgres postgres bsk-dev-postgres
connect_data bsk-redis redis bsk-dev-redis
connect_data bsk-seaweed-master seaweed-master bsk-dev-seaweed-master
connect_data bsk-seaweed-volume seaweed-volume bsk-dev-seaweed-volume
connect_data bsk-seaweed-filer seaweed-filer bsk-dev-seaweed-filer
connect_data bsk-seaweed-s3 seaweed-s3 bsk-dev-seaweed-s3

echo
echo "== $DEV_INTERNAL_NETWORK containers =="
docker network inspect "$DEV_INTERNAL_NETWORK" \
  --format '{{range $id, $c := .Containers}}{{$c.Name}} -> {{$c.IPv4Address}}{{println}}{{end}}' || true

echo
echo "VALIDATION_FAIL=$FAIL"
