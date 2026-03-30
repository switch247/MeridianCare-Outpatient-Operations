$ErrorActionPreference = 'Stop'
Write-Host "[1/2] Backend unit tests"
docker compose exec backend npm test
Write-Host "[2/3] API smoke tests"
docker compose exec backend node /app/scripts/api_smoke_test.js
Write-Host "[3/3] Requirement API tests"
docker compose exec backend node /app/scripts/requirement_api_test.js
Write-Host "Done"
