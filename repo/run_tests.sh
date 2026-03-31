#!/usr/bin/env sh
set -eu

echo "[1/7] Backend unit tests"
docker compose exec backend npm test

echo "[2/7] API smoke tests"
docker compose exec backend node /app/tests/API_tests/api_smoke_test.js

echo "[3/7] Requirement API tests"
docker compose exec backend node /app/tests/API_tests/requirement_api_test.js

echo "[4/7] Phase 2 clinical E2E"
docker compose exec backend node /app/tests/API_tests/phase2_clinical_e2e_test.js

echo "[5/7] Phase 3 pharmacy E2E"
docker compose exec backend node /app/tests/API_tests/phase3_pharmacy_e2e_test.js

echo "[6/7] Phase 4 billing E2E"
docker compose exec backend node /app/tests/API_tests/phase4_billing_e2e_test.js

echo "[7/7] Phase 5 ops E2E"
docker compose exec backend node /app/tests/API_tests/phase5_ops_e2e_test.js

echo "Done"
