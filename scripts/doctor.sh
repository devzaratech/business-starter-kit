#!/usr/bin/env bash
set -euo pipefail

echo "== System =="
hostname
date
lsb_release -a 2>/dev/null || true
uname -a

echo
echo "== Disk =="
df -h

echo
echo "== Memory =="
free -h

echo
echo "== Docker =="
docker --version
docker compose version
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "== Compose files =="
find . -maxdepth 3 -type f \( -name "compose.yml" -o -name "compose.yaml" -o -name "docker-compose.yml" -o -name "docker-compose.yaml" \) -print

echo
echo "== Ports =="
sudo ss -tulpn | grep -E ':(80|443|3000|5101|5173|8080|8081|5432|5433|6379|8000|9000)' || true

echo
echo "Doctor finished."
