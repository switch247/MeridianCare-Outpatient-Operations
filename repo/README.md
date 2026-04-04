# MeridianCare Outpatient Operations

On-prem fullstack platform for clinic encounters, e-prescriptions, pharmacy/inventory operations, billing, credentialing, crawler ingestion, forecasting lifecycle, and backup/restore drills.

## Architecture Map
- `backend/`: Fastify API modules (`auth`, `patients`, `encounters`, `prescriptions`, `inventory`, `billing`, `credentialing`, `admin`, `sync_audit`) with PostgreSQL persistence.
- `frontend/`: Angular desktop-first role workspaces (Physician, Pharmacist, Billing, Inventory, Admin, Auditor).
- `backend/tests/unit_tests`: unit tests for core logic (security, discounts, allergy checks, state machine, masking, logging).
- `backend/tests/API_tests`: API and E2E acceptance tests by requirement/phase.

## One-Click Startup (Docker)
```bash
docker compose up --build
```

- Frontend: http://localhost:14200
- Backend health: http://localhost:13000/health

## Local Backend Startup (Non-Docker)
1. Create env from template:
```bash
cp .env.template .env
```
2. Start PostgreSQL locally and create database `meridiancare-clinic`.
3. Start backend:
```bash
cd backend
npm install
npm run start
```
4. Health check:
```bash
curl http://localhost:13000/health
```

## Verification (Docker)
Run full suite:

```bash
./run_tests.sh
```

Individual checks:
```bash
docker compose exec -T backend sh -lc 'npm test --silent'
docker compose exec -T backend sh -lc 'API_BASE_URL=http://localhost:3000 npm run test:api --silent'
docker compose exec -T frontend sh -lc 'npm test --silent'
docker compose exec -T frontend sh -lc 'API_BASE_URL=http://backend:3000 npm run test:e2e:all --silent'
```

## Security and Data Isolation
- Local username/password auth only; minimum password length 12; bcrypt hashing.
- Lockout policy: 5 failed attempts -> 15-minute lockout.
- Session idle timeout: 20 minutes with session revocation support.
- RBAC route checks for Physician/Pharmacist/Billing/Inventory/Admin/Auditor.
- PHI controls: encrypted sensitive identifiers and masked patient projections for non-clinical views.
- Audit immutability: encounter/prescription/credentialing edits emit append-only audit events with snapshots.
- Concurrency protections: optimistic version checks + transactional `SELECT ... FOR UPDATE` on dispense.
- Payments are manual records only (`cash/card/manual_ref`) with no external payment gateway integration.

## Seeded Local Users
- `physician@local` (`physician`)
- `pharmacist@local` (`pharmacist`)
- `billing@local` (`billing`)
- `inventory@local` (`inventory`)
- `admin@local` (`admin`)
- `auditor@local` (`auditor`)

Seed password is read from `SEED_PASSWORD` in `.env`.
