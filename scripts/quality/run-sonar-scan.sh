#!/usr/bin/env bash
#
# Run a SonarQube analysis for the repository.
#
# This script activates ONLY when SonarQube is configured. If SONAR_HOST_URL or
# SONAR_TOKEN are missing, it exits successfully with a clear message so it can
# be wired into CI/CD pipelines without breaking the default (Sonar-less) flow.
#
# Required environment variables when enabled:
#   SONAR_HOST_URL   URL of the SonarQube server (e.g. https://sonar.example.com)
#   SONAR_TOKEN      Authentication token with analysis permission
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${SONAR_HOST_URL:-}" || -z "${SONAR_TOKEN:-}" ]]; then
  echo "SonarQube is not configured (SONAR_HOST_URL / SONAR_TOKEN not set)."
  echo "Skipping SonarQube analysis."
  exit 0
fi

echo "Running SonarQube analysis against: ${SONAR_HOST_URL}"

if command -v sonar-scanner >/dev/null 2>&1; then
  sonar-scanner \
    -Dsonar.host.url="${SONAR_HOST_URL}" \
    -Dsonar.token="${SONAR_TOKEN}"
else
  echo "sonar-scanner CLI not found; falling back to the official Docker image."
  docker run --rm \
    -e SONAR_HOST_URL="${SONAR_HOST_URL}" \
    -e SONAR_TOKEN="${SONAR_TOKEN}" \
    -v "${ROOT_DIR}:/usr/src" \
    sonarsource/sonar-scanner-cli:latest
fi

echo "SonarQube analysis submitted."
