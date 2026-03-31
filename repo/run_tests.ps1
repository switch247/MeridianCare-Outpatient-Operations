$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [string]$Label,
    [string]$Command
  )
  Write-Host $Label
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed with exit code ${LASTEXITCODE}: $Command"
  }
}

Invoke-Step "[1/7] Backend unit tests" "docker compose exec backend npm test"
Invoke-Step "[2/7] API smoke tests" "docker compose exec backend node /app/tests/API_tests/api_smoke_test.js"
Invoke-Step "[3/7] Requirement API tests" "docker compose exec backend node /app/tests/API_tests/requirement_api_test.js"
Invoke-Step "[4/7] Phase 2 clinical E2E" "docker compose exec backend node /app/tests/API_tests/phase2_clinical_e2e_test.js"
Invoke-Step "[5/7] Phase 3 pharmacy E2E" "docker compose exec backend node /app/tests/API_tests/phase3_pharmacy_e2e_test.js"
Invoke-Step "[6/7] Phase 4 billing E2E" "docker compose exec backend node /app/tests/API_tests/phase4_billing_e2e_test.js"
Invoke-Step "[7/7] Phase 5 ops E2E" "docker compose exec backend node /app/tests/API_tests/phase5_ops_e2e_test.js"

Write-Host "Done"
