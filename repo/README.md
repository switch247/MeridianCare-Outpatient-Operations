# MeridianCare Outpatient Operations

Fullstack monorepo under `/repo` implementing an on-prem clinic workflow platform with Angular frontend, Fastify backend, PostgreSQL persistence, RBAC, auditing, and Docker-based execution.

## Architecture
- `frontend/`: Angular desktop-focused UI with per-role workflows.
- `backend/`: Fastify REST API, validation and state-machine style transitions, audit/version snapshots, local auth.
- `tests/unit_tests`: unit-level test artifacts (mapped to backend vitest suite).
- `tests/API_tests`: API test artifacts and smoke scenarios.
- `docs/requirements_traceability.md`: requirement-to-test mapping.

## Run with Docker
```bash
docker compose up --build
```

- Frontend: http://localhost:14200
- Backend health: http://localhost:13000/health

## Run Tests
```bash
docker compose exec backend npm test
docker compose exec backend node /app/scripts/api_smoke_test.js
docker compose exec backend node /app/scripts/requirement_api_test.js
```
On Windows PowerShell you can also run:
```powershell
.\run_tests.ps1
```

## Security & Data Isolation
- Local username/password auth with bcrypt hashes, min length 12.
- Lockout after 5 failed attempts for 15 minutes.
- Session idle timeout at 20 minutes.
- RBAC route enforcement for Physician/Pharmacist/Billing/Inventory/Admin/Auditor.
- PHI encryption for sensitive patient identifiers.
- Immutable audit events + version increments on key clinical/credentialing records.
