#!/usr/bin/env bash
# One-shot deploy to the production droplet over SSH (no GitHub secrets needed).
# Usage:  bash deploy.sh
# Requires: ssh access to the server (key already authorized).
set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@152.42.240.101}"
REMOTE_DIR="${DEPLOY_PATH:-/root/rideshare-backend}"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"

echo "==> Packing project (excluding node_modules/.git/build)"
TMP_TGZ="$(mktemp -t oqyol-XXXX.tgz)"
tar czf "$TMP_TGZ" \
  --exclude=node_modules --exclude=.git --exclude=.idea --exclude=build --exclude=.DS_Store \
  .env src prisma package.json package-lock.json Dockerfile docker-compose.yml prisma.config.js README.md

echo "==> Uploading to $SERVER:$REMOTE_DIR"
ssh $SSH_OPTS "$SERVER" "mkdir -p '$REMOTE_DIR'"
scp $SSH_OPTS "$TMP_TGZ" "$SERVER:$REMOTE_DIR/_deploy.tgz"
rm -f "$TMP_TGZ"

echo "==> Extracting + rebuilding stack"
ssh $SSH_OPTS "$SERVER" "cd '$REMOTE_DIR' && tar xzf _deploy.tgz && rm _deploy.tgz \
  && docker compose up -d --build \
  && docker compose exec -T api npx prisma db push \
  && docker image prune -f"

echo "==> Health check"
curl -s --max-time 15 "http://${SERVER#*@}:3000/api/health" && echo
echo "==> Done."
