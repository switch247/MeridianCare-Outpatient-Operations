#!/usr/bin/env sh
set -eu

echo "[1/7] Backend unit tests"
docker compose exec backend npm test

echo "[2/7] API smoke tests"
docker compose exec backend node /app/tests/API_tests/api_smoke_test.js

echo "[3/7] Requirement API tests"
docker compose exec backend node /app/tests/API_tests/requirement_api_test.js

echo "[4/7] Clinical E2E"
docker compose exec backend node /app/frontend/tests/clinical_e2e_test.js

echo "[5/7] Pharmacy E2E"
docker compose exec backend node /app/frontend/tests/pharmacy_e2e_test.js

echo "[6/7] Billing E2E"
docker compose exec backend node /app/frontend/tests/billing_e2e_test.js

echo "[7/7] Ops E2E"
docker compose exec backend node /app/frontend/tests/ops_e2e_test.js

echo "Done"
