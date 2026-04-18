# MeridianCare Outpatient Operations

On-prem fullstack platform for clinic encounters, e-prescriptions, pharmacy/inventory operations, billing, credentialing, crawler ingestion, forecasting lifecycle, and backup/restore drills.

## Architecture Map
- `backend/`: Fastify API modules (`auth`, `patients`, `encounters`, `prescriptions`, `inventory`, `billing`, `credentialing`, `admin`, `sync_audit`, `users`, `clinics`, `overview`) with PostgreSQL persistence.
- `frontend/`: Angular 19 desktop-first role workspaces (Physician, Pharmacist, Billing, Inventory, Admin, Auditor).
- `backend/tests/unit_tests/`: Unit tests for core logic (security, discounts, allergy checks, state machine, masking, logging, services).
- `backend/tests/API_tests/`: No-mock HTTP acceptance tests covering all 70+ API endpoints.
- `frontend/src/app/**/*.spec.ts`: Angular unit tests for every component, page, and service.
- `frontend/tests/e2e/`: Playwright E2E tests covering all critical user flows.

## One-Click Startup (Docker)
```bash
docker compose up --build
```

- Frontend: http://localhost:14200
- Backend health: http://localhost:13000/health

## Local Startup (Non-Docker)
1. Ensure PostgreSQL is running locally and `DATABASE_URL` points to a valid `meridiancare-clinic` database.
2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```
3. Start backend (Terminal 1):
```bash
cd backend && npm run start
```
4. Start frontend (Terminal 2):
```bash
cd frontend && npm run start
```
5. Health check:
```bash
curl http://localhost:13000/health
```

---

## Test Suite Overview

| Suite | Location | Framework | Count |
|-------|----------|-----------|-------|
| Backend unit tests | `backend/tests/unit_tests/` | Vitest | 15 files |
| Backend API tests | `backend/tests/API_tests/` | Supertest (no-mock HTTP) | 9 modules |
| Frontend unit tests | `frontend/src/app/**/*.spec.ts` | Jasmine + Karma | 13 files |
| Frontend E2E tests | `frontend/tests/e2e/` | Playwright (playwright-core) | 7 suites |

**API endpoint coverage: 100%** — every route and HTTP method has at least one no-mock positive test and one failure/negative test.

**Overall coverage target: ≥95%** — unit + integration + E2E across backend and frontend.

---

## Running Tests

### Docker (recommended)

Run the full suite in one command:
```bash
./run_tests.sh
```

Individual suites in Docker:
```bash
# Backend unit tests
docker compose exec -T backend sh -lc 'npm test --silent'

# Backend API acceptance tests (all 70+ endpoints, 9 modules)
docker compose exec -T backend sh -lc 'npm run test:api --silent'

# Frontend unit tests (Karma/Jasmine, headless)
docker compose exec -T frontend sh -lc 'npm test --silent'

# Frontend E2E tests — original suite
docker compose exec -T frontend sh -lc 'API_BASE_URL=http://backend:3000 npm run test:e2e --silent'

# Frontend E2E tests — extended suite (frontend/tests/e2e/)
docker compose exec -T frontend sh -lc 'API_BASE_URL=http://backend:3000 npm run test:e2e:suite --silent'
```

### Local (requires PostgreSQL)

> Set `DATABASE_URL` in `backend/.env` before running API tests.

```bash
# Backend unit tests
cd backend && npm test --silent

# Backend API tests
cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/meridiancare-clinic npm run test:api --silent

# Frontend unit tests
cd frontend && npm test --silent

# Frontend E2E tests — original suite
cd frontend && E2E_FRONTEND_URL=http://localhost:4200 API_BASE_URL=http://localhost:13000 npm run test:e2e --silent

# Frontend E2E tests — extended suite
cd frontend && E2E_FRONTEND_URL=http://localhost:4200 API_BASE_URL=http://localhost:13000 npm run test:e2e:suite --silent
```

---

## API Endpoint Coverage Map

All 70+ endpoints have no-mock HTTP tests in `backend/tests/API_tests/`.

| Module | Route | Method | Test File(s) |
|--------|-------|--------|--------------|
| Auth | `/api/auth/login` | POST | smoke, requirement |
| Auth | `/api/auth/me` | GET | smoke |
| Auth | `/api/auth/logout` | POST | *(session revocation tested in security.test.js)* |
| Auth | `/api/auth/sessions` | GET | comprehensive_coverage |
| Auth | `/api/auth/unlock/:id` | POST | comprehensive_coverage |
| Clinics | `/api/clinics` | GET | comprehensive_coverage |
| Clinics | `/api/clinics` | POST | comprehensive_coverage (409 enforcement) |
| Clinics | `/api/clinics/:id` | PUT | comprehensive_coverage |
| Clinics | `/api/clinics/:id` | DELETE | comprehensive_coverage (validation) |
| Patients | `/api/patients` | POST | smoke, requirement |
| Patients | `/api/patients` | GET | requirement |
| Patients | `/api/patients/:id` | GET | comprehensive_coverage |
| Patients | `/api/patients/:id` | PUT | comprehensive_coverage |
| Patients | `/api/patients/:id` | DELETE | comprehensive_coverage |
| Patients | `/api/icd` | GET | requirement |
| Encounters | `/api/encounters` | POST | smoke, requirement |
| Encounters | `/api/encounters` | GET | comprehensive_coverage, route_isolation |
| Encounters | `/api/encounters/:id` | GET | comprehensive_coverage |
| Encounters | `/api/encounters/:id/sign` | POST | smoke, requirement |
| Prescriptions | `/api/prescriptions` | POST | smoke, requirement |
| Pharmacy | `/api/pharmacy/queue` | GET | route_isolation |
| Pharmacy | `/api/pharmacy/:id/action` | POST | smoke (approve, dispense) |
| Pharmacy | `/api/pharmacy/:id/movements` | GET | comprehensive_coverage |
| Pharmacy | `/api/pharmacy/:id/return` | POST | comprehensive_coverage |
| Billing | `/api/billing/price` | POST | smoke, billing_uat |
| Billing | `/api/invoices` | POST | smoke, billing_uat |
| Billing | `/api/invoices` | GET | billing_uat |
| Billing | `/api/invoices/:id` | GET | billing_uat |
| Billing | `/api/invoices/:id/payment` | POST | smoke, billing_uat |
| Billing | `/api/invoices/:id/cancel` | POST | billing_uat |
| Billing | `/api/shipping/templates` | GET | requirement |
| Inventory | `/api/inventory/items` | POST | smoke |
| Inventory | `/api/inventory/items` | GET | route_isolation |
| Inventory | `/api/inventory/movements` | POST | smoke |
| Inventory | `/api/inventory/alerts/low-stock` | GET | comprehensive_coverage |
| Inventory | `/api/inventory/reports/variance` | GET | comprehensive_coverage |
| Admin | `/api/admin/users` | POST | object_isolation |
| Admin | `/api/admin/forecasts` | GET | comprehensive_coverage |
| Admin | `/api/admin/recommendations` | GET | comprehensive_coverage |
| Admin | `/api/admin/backups/nightly` | POST | adversary_hard_gate |
| Admin | `/api/admin/backup` | POST | adversary_hard_gate |
| Admin | `/api/admin/backups/nightly` | GET | comprehensive_coverage |
| Admin | `/api/admin/backups/restore-drill` | POST | comprehensive_coverage |
| Admin | `/api/admin/backups/restore-drill` | GET | comprehensive_coverage |
| Crawler | `/api/crawler/run` | POST | requirement |
| Crawler | `/api/crawler/queue` | GET | requirement |
| Crawler | `/api/crawler/process-next` | POST | comprehensive_coverage |
| Crawler | `/api/crawler/:id/retry` | POST | comprehensive_coverage |
| Crawler | `/api/crawler/nodes` | GET | comprehensive_coverage |
| Crawler | `/api/crawler/scale` | POST | comprehensive_coverage |
| Models | `/api/models/register` | POST | requirement |
| Models | `/api/models/drift` | GET | requirement |
| Models | `/api/models/:id/rollback` | POST | requirement |
| Observability | `/api/observability/kpis` | GET | overview |
| Observability | `/api/observability/exceptions` | POST | comprehensive_coverage |
| Observability | `/api/observability/exceptions` | GET | comprehensive_coverage |
| Credentialing | `/api/credentialing` | GET | comprehensive_coverage |
| Credentialing | `/api/credentialing/onboard` | POST | comprehensive_coverage |
| Credentialing | `/api/credentialing/import` | POST | requirement, smoke |
| Credentialing | `/api/credentialing/export` | GET | comprehensive_coverage |
| Organizations | `/api/organizations` | GET | comprehensive_coverage |
| Organizations | `/api/organizations` | POST | comprehensive_coverage |
| Organizations | `/api/organizations/:id` | PUT | comprehensive_coverage |
| Organizations | `/api/organizations/:id` | DELETE | comprehensive_coverage |
| Overview | `/api/overview` | GET | overview |
| Sync/Audit | `/api/sync/enqueue` | POST | comprehensive_coverage |
| Sync/Audit | `/api/sync/status` | GET | comprehensive_coverage |
| Sync/Audit | `/api/audit` | GET | comprehensive_coverage |
| Users | `/api/users` | POST | comprehensive_coverage |
| Users | `/api/users` | GET | comprehensive_coverage |
| Users | `/api/users/:id` | GET | comprehensive_coverage |
| Users | `/api/users/:id` | PUT | comprehensive_coverage |
| Users | `/api/users/:id` | DELETE | comprehensive_coverage |
| Health | `/health` | GET | smoke |

---

## Frontend Unit Test Coverage

All 13 spec files in `frontend/src/app/`:

| File | Component / Service |
|------|---------------------|
| `app.component.spec.ts` | Root AppComponent |
| `services/auth.service.spec.ts` | AuthService (login, session validation) |
| `services/api.service.spec.ts` | ApiService (token, HTTP, all endpoints) |
| `services/role-guard.service.spec.ts` | RoleGuard (RBAC redirect logic) |
| `pages/home-page.component.spec.ts` | HomePageComponent (KPIs, overview) |
| `pages/admin-ops-page.component.spec.ts` | AdminOpsPageComponent (crawler, models, alerts, backups) |
| `pages/credentialing-page.component.spec.ts` | CredentialingPageComponent (orgs, import, export) |
| `pages/inventory-page.component.spec.ts` | InventoryPageComponent (items, movements, alerts) |
| `pages/invoices-page.component.spec.ts` | InvoicesPageComponent (billing CRUD) |
| `pages/my-clinic.component.spec.ts` | MyClinicComponent (clinic load, edit, save) |
| `pages/pharmacist-queue-page.component.spec.ts` | PharmacistQueuePageComponent (approve, dispense, void, return) |
| `pages/physician-encounter-page.component.spec.ts` | PhysicianEncounterPageComponent (encounter, ICD, prescription) |
| `pages/user-management.component.spec.ts` | UserManagementComponent (user CRUD) |

---

## Frontend E2E Test Coverage

7 test suites in `frontend/tests/e2e/` (Playwright, playwright-core):

| Suite | File | Scenarios |
|-------|------|-----------|
| Authentication | `auth.test.js` | Login (all roles), logout, wrong password, unknown user, form validation |
| RBAC | `rbac.test.js` | Per-role nav links, cross-role redirect, unauthenticated redirect |
| Physician | `physician.test.js` | Encounter workbench, ICD typeahead, diagnosis guard, prescription fields |
| Pharmacist | `pharmacist.test.js` | Queue load, row select, approve/dispense/void buttons, void-after-dispense guard |
| Billing | `billing.test.js` | Invoice list, new invoice modal, price calculator, cancel, access denial |
| Inventory | `inventory.test.js` | Item list, create form, movement panel, low stock, variance report |
| Admin | `admin.test.js` | Crawler queue, exception alerts, model registration, backup, user management |

---

## Security and Data Isolation
- Local username/password auth only; minimum password length 12; bcrypt hashing.
- Lockout policy: 5 failed attempts → 15-minute lockout.
- Session idle timeout: 20 minutes with session revocation support.
- RBAC route checks for Physician/Pharmacist/Billing/Inventory/Admin/Auditor.
- PHI controls: encrypted sensitive identifiers and masked patient projections for non-clinical views.
- Audit immutability: encounter/prescription/credentialing edits emit append-only audit events with snapshots.
- Concurrency protections: optimistic version checks + transactional `SELECT ... FOR UPDATE` on dispense.
- Payments are manual records only (`cash/card/manual_ref`) with no external payment gateway integration.
- Clinic-level data isolation: every multi-tenant route enforces `clinic_id` scoping.

## Seeded Local Users
- `physician@local` (`physician`)
- `pharmacist@local` (`pharmacist`)
- `billing@local` (`billing`)
- `inventory@local` (`inventory`)
- `admin@local` (`admin`)
- `auditor@local` (`auditor`)

Seed password is read from `SEED_PASSWORD` in `.env`.
