#!/usr/bin/env sh
set -eu

echo "[1/3] Backend unit tests"
docker compose exec backend npm test

echo "[2/3] API smoke tests"
docker compose exec backend node /app/scripts/api_smoke_test.js

echo "[3/3] Done"
