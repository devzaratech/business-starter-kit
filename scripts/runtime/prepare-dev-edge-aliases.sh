#!/usr/bin/env bash
set -u

FAIL=0

docker network inspect bsk-edge >/dev/null 2>&1 || docker network create bsk-edge >/dev/null

connect_alias_if_container_exists() {
  container="$1"
  alias="$2"

  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "WARN: container $container does not exist; alias $alias not attached"
    return
  fi

  if docker inspect "$container" --format '{{json .NetworkSettings.Networks}}' | grep -q '"bsk-edge"'; then
    echo "OK: $container already connected to bsk-edge"
    return
  fi

  echo "Connecting $container to bsk-edge as $alias..."
  if docker network connect --alias "$alias" bsk-edge "$container"; then
    echo "OK: $container -> $alias"
  else
    echo "FAIL: could not connect $container to bsk-edge"
    FAIL=1
  fi
}

connect_alias_if_container_exists bsk-web bsk-dev-web
connect_alias_if_container_exists bsk-api-spring bsk-dev-api-spring
connect_alias_if_container_exists bsk-api-node bsk-dev-api-node
connect_alias_if_container_exists bsk-api-fastapi bsk-dev-api-fastapi
connect_alias_if_container_exists bsk-api-php bsk-dev-api-php

echo
echo "== bsk-edge containers =="
docker network inspect bsk-edge --format '{{range $id, $c := .Containers}}{{$c.Name}} -> {{$c.IPv4Address}}{{println}}{{end}}' || true

echo
echo "VALIDATION_FAIL=$FAIL"
