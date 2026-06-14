#!/usr/bin/env bash
set -euo pipefail

if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "chore: initialize business starter kit structure"
