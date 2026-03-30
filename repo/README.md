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

docker compose exec backend node /app/scripts/api_smoke_test.js
docker compose exec backend node /app/scripts/requirement_api_test.js
## Run Tests (Docker-only)
All commands are intended to run via Docker Compose. Example:

```bash
docker compose exec backend npm test
```
The repository is designed to run within the provided Docker environment; local (host) run commands are not supported or tested.

## Security & Data Isolation
- Local username/password auth with bcrypt hashes, min length 12.
- Lockout after 5 failed attempts for 15 minutes.
- Session idle timeout at 20 minutes.
- RBAC route enforcement for Physician/Pharmacist/Billing/Inventory/Admin/Auditor.
- PHI encryption for sensitive patient identifiers.
- Immutable audit events + version increments on key clinical/credentialing records.

## Seeded Users (local development)

The backend seeder creates one user per role for convenience. By default the seeded accounts are:

- username: `physician@local` — role: `physician`
- username: `pharmacist@local` — role: `pharmacist`
- username: `billing@local` — role: `billing`
- username: `inventory@local` — role: `inventory`
- username: `admin@local` — role: `admin`
- username: `auditor@local` — role: `auditor`

Default password: `Password!123`

You can override the seeded password by setting the `SEED_PASSWORD` environment variable before starting the backend. The seeder runs automatically after the server starts (non-blocking) when the database is initialized.

Frontend: open the `User Management` page (Admin role) to create/edit users. Use the seeded admin account to log in and manage users.
