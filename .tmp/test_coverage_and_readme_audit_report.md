# Test Coverage Audit

## Scope, Method, and Project Type
- Static inspection only (no execution).
- Inspected only: backend route definitions, test files, `repo/README.md`, `repo/run_tests.sh`, minimal config files.
- Project type declaration found: `fullstack` in `repo/README.md:3`.

## Backend Endpoint Inventory
Source of truth: `repo/backend/src/app.js:184-185`, `repo/backend/src/routes/*.js` (`fastify.<method>(<path>)`).

Total endpoints discovered: **75**
- Route endpoints in `src/routes`: 73
- App-level health endpoints in `src/app.js`: 2

## API Test Mapping Table
Legend:
- `true no-mock HTTP`: via Supertest + real app bootstrap in `repo/backend/tests/API_tests/helper.js:createApiContext` (`buildApp`, `supertest(app.server)`, `seedRun`) and no route/service/controller mocking in API test files.
- `HTTP with mocking`: HTTP request issued, but dependencies mocked/stubbed.
- `unit-only / indirect`: no direct HTTP request to that endpoint.

| Endpoint | Covered | Test Type | Test Files | Evidence |
|---|---|---|---|---|
| GET /health | yes | true no-mock HTTP | `api_smoke_test.js` | `runApiSmoke` calls `api.get('/health')` (`repo/backend/tests/API_tests/api_smoke_test.js:10`) |
| GET /api/health | no | unit-only / indirect | none | endpoint declared in `repo/backend/src/app.js:185`; no test call found |
| POST /api/auth/login | yes | true no-mock HTTP | `helper.js`, `adversary_hard_gate.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | `loginAs`/direct login calls (`repo/backend/tests/API_tests/helper.js:33`, `.../route_isolation_matrix.test.js:53`) |
| GET /api/auth/me | yes | true no-mock HTTP | `api_smoke_test.js` | `runApiSmoke` (`repo/backend/tests/API_tests/api_smoke_test.js:14-17`) |
| POST /api/auth/logout | yes | HTTP with mocking | `session_hardening.test.js` | `app.inject` + `vi.mock('../../src/db')` (`repo/backend/tests/unit_tests/session_hardening.test.js:1,24`) |
| GET /api/auth/sessions | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | positive/forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:365`, `.../admin_access.test.js:9`) |
| POST /api/auth/unlock/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | unlock checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:380`) |
| POST /api/clinics | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | duplicate clinic check (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:427`) |
| GET /api/clinics | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | admin/auditor/physician checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:414-424`) |
| PUT /api/clinics/:id | yes* | true no-mock HTTP | `comprehensive_coverage.test.js` | guarded by `if (clinicGet.body && clinicGet.body.id)` (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:435`) |
| DELETE /api/clinics/:id | yes* | true no-mock HTTP | `comprehensive_coverage.test.js` | guarded by same conditional (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:448,452`) |
| POST /api/admin/users | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `object_isolation.test.js`, `admin_access.test.js` | admin create + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:380`, `.../admin_access.test.js:8`) |
| POST /api/crawler/run | yes | true no-mock HTTP | `requirement_api_test.js`, `admin_crawler_obs_api_test.js`, `comprehensive_coverage.test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/admin_crawler_obs_api_test.js:12`) |
| GET /api/crawler/queue | yes | true no-mock HTTP | `requirement_api_test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/requirement_api_test.js:151`) |
| POST /api/crawler/process-next | yes | true no-mock HTTP | `admin_crawler_obs_api_test.js`, `comprehensive_coverage.test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:530`) |
| POST /api/crawler/:id/retry | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | explicit id + miss checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:549,555`) |
| GET /api/crawler/nodes | yes | true no-mock HTTP | `admin_crawler_obs_api_test.js`, `comprehensive_coverage.test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/admin_crawler_obs_api_test.js:24`) |
| POST /api/crawler/scale | yes | true no-mock HTTP | `admin_crawler_obs_api_test.js`, `comprehensive_coverage.test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/admin_crawler_obs_api_test.js:29`) |
| POST /api/models/register | yes | true no-mock HTTP | `requirement_api_test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/requirement_api_test.js:155`) |
| GET /api/models/drift | yes | true no-mock HTTP | `requirement_api_test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/requirement_api_test.js:169`) |
| GET /api/admin/forecasts | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | positive + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:202-207`) |
| GET /api/admin/recommendations | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | positive + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:210-215`) |
| POST /api/models/:id/rollback | yes | true no-mock HTTP | `requirement_api_test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/requirement_api_test.js:173`) |
| GET /api/observability/kpis | yes | true no-mock HTTP | `overview_endpoint_test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | explicit calls (`repo/backend/tests/API_tests/overview_endpoint_test.js:33`) |
| POST /api/observability/exceptions | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | positive + bad request (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:218,228`) |
| GET /api/observability/exceptions | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_crawler_obs_api_test.js`, `admin_access.test.js` | list check (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:232`) |
| POST /api/admin/backups/nightly | yes | true no-mock HTTP | `admin_access.test.js` | forbidden-path check (`repo/backend/tests/API_tests/admin_access.test.js:24`) |
| POST /api/admin/backup | yes | true no-mock HTTP | `adversary_hard_gate.test.js` | backup artifact test (`repo/backend/tests/API_tests/adversary_hard_gate.test.js:159`) |
| GET /api/admin/backups/nightly | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | list check (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:242`) |
| POST /api/admin/backups/restore-drill | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | create + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:247,261`) |
| GET /api/admin/backups/restore-drill | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `admin_access.test.js` | list + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:255`) |
| POST /api/billing/price | yes | true no-mock HTTP | `api_smoke_test.js`, `billing_uat.test.js`, `requirement_api_test.js` | explicit calls (`repo/backend/tests/API_tests/billing_uat.test.js:24`) |
| POST /api/invoices | yes | true no-mock HTTP | `api_smoke_test.js`, `billing_uat.test.js`, `requirement_api_test.js`, `adversary_hard_gate.test.js` | explicit calls (`repo/backend/tests/API_tests/billing_uat.test.js:38`) |
| GET /api/invoices | yes | true no-mock HTTP | `billing_uat.test.js` | list check (`repo/backend/tests/API_tests/billing_uat.test.js:49`) |
| GET /api/invoices/:id | yes | true no-mock HTTP | `billing_uat.test.js`, `adversary_hard_gate.test.js` | detail check (`repo/backend/tests/API_tests/billing_uat.test.js:55`) |
| POST /api/invoices/:id/payment | yes | true no-mock HTTP | `api_smoke_test.js`, `billing_uat.test.js`, `requirement_api_test.js` | payment checks (`repo/backend/tests/API_tests/billing_uat.test.js:60`) |
| POST /api/invoices/:id/cancel | yes | true no-mock HTTP | `billing_uat.test.js` | cancel checks (`repo/backend/tests/API_tests/billing_uat.test.js:76`) |
| GET /api/shipping/templates | yes | true no-mock HTTP | `billing_uat.test.js`, `requirement_api_test.js` | explicit calls (`repo/backend/tests/API_tests/billing_uat.test.js:119`) |
| GET /api/credentialing | yes | true no-mock HTTP | `credentialing_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/credentialing_api_test.js:12`) |
| POST /api/credentialing/onboard | yes | true no-mock HTTP | `credentialing_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/credentialing_api_test.js:17`) |
| POST /api/credentialing/import | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js` | explicit calls (`repo/backend/tests/API_tests/requirement_api_test.js:137`) |
| GET /api/credentialing/export | yes | true no-mock HTTP | `credentialing_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/credentialing_api_test.js:27`) |
| GET /api/organizations | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | list check (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:321`) |
| POST /api/organizations | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | create + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:326,340`) |
| PUT /api/organizations/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | update + miss checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:344,352`) |
| DELETE /api/organizations/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | delete + repeat delete (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:356,360`) |
| GET /api/encounters | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | list checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:98`) |
| GET /api/encounters/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | detail checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:112`) |
| POST /api/encounters | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js`, `adversary_hard_gate.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | explicit calls (`repo/backend/tests/API_tests/api_smoke_test.js:28`) |
| POST /api/encounters/:id/sign | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js`, `comprehensive_coverage.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | explicit calls (`repo/backend/tests/API_tests/api_smoke_test.js:37`) |
| GET /api/inventory/items | yes | true no-mock HTTP | `inventory_api_test.js`, `route_isolation_matrix.test.js` | list checks (`repo/backend/tests/API_tests/inventory_api_test.js:22`) |
| POST /api/inventory/items | yes | true no-mock HTTP | `api_smoke_test.js`, `inventory_api_test.js`, `requirement_api_test.js`, `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | explicit calls (`repo/backend/tests/API_tests/inventory_api_test.js:13`) |
| POST /api/inventory/movements | yes | true no-mock HTTP | `api_smoke_test.js`, `inventory_api_test.js`, `requirement_api_test.js`, `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | explicit calls (`repo/backend/tests/API_tests/inventory_api_test.js:28`) |
| GET /api/inventory/alerts/low-stock | yes | true no-mock HTTP | `inventory_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:562`) |
| GET /api/inventory/reports/variance | yes | true no-mock HTTP | `inventory_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:571`) |
| GET /api/overview | yes | true no-mock HTTP | `overview_endpoint_test.js`, `adversary_hard_gate.test.js` | explicit calls (`repo/backend/tests/API_tests/overview_endpoint_test.js:9`) |
| POST /api/patients | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js`, `adversary_hard_gate.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/api_smoke_test.js:21`) |
| GET /api/patients | yes | true no-mock HTTP | `requirement_api_test.js`, `adversary_hard_gate.test.js`, `route_isolation_matrix.test.js` | list checks (`repo/backend/tests/API_tests/requirement_api_test.js:21`) |
| GET /api/patients/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | detail checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:49`) |
| PUT /api/patients/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | update checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:58`) |
| DELETE /api/patients/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js` | delete checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:66`) |
| GET /api/icd | yes | true no-mock HTTP | `requirement_api_test.js` | query path call (`repo/backend/tests/API_tests/requirement_api_test.js:30`) |
| POST /api/prescriptions | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js`, `adversary_hard_gate.test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/api_smoke_test.js:43`) |
| GET /api/pharmacy/queue | yes | true no-mock HTTP | `route_isolation_matrix.test.js` | queue isolation check (`repo/backend/tests/API_tests/route_isolation_matrix.test.js:184`) |
| POST /api/pharmacy/:id/action | yes | true no-mock HTTP | `api_smoke_test.js`, `requirement_api_test.js`, `object_isolation.test.js`, `route_isolation_matrix.test.js`, `comprehensive_coverage.test.js` | approve/dispense/deny checks (`repo/backend/tests/API_tests/api_smoke_test.js:83,88`) |
| GET /api/pharmacy/:id/movements | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | movements checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:187`) |
| POST /api/pharmacy/:id/return | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | return + invalid return (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:196,204`) |
| POST /api/sync/enqueue | yes | true no-mock HTTP | `sync_audit_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/sync_audit_api_test.js:12`) |
| GET /api/sync/status | yes | true no-mock HTTP | `sync_audit_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/sync_audit_api_test.js:20`) |
| GET /api/audit | yes | true no-mock HTTP | `sync_audit_api_test.js`, `comprehensive_coverage.test.js` | explicit calls (`repo/backend/tests/API_tests/sync_audit_api_test.js:25`) |
| POST /api/users | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | create + bad payload (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:466,476`) |
| GET /api/users | yes | true no-mock HTTP | `comprehensive_coverage.test.js` | list + forbidden checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:480,485`) |
| GET /api/users/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | detail + miss checks (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:489,494`) |
| PUT /api/users/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | update check (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:498`) |
| DELETE /api/users/:id | yes | true no-mock HTTP | `comprehensive_coverage.test.js`, `route_isolation_matrix.test.js` | delete + repeat delete (`repo/backend/tests/API_tests/comprehensive_coverage.test.js:505,512`) |

`yes*` indicates conditional execution branch; static inspection cannot guarantee branch satisfaction in all runs.

## API Test Classification

### 1) True No-Mock HTTP
- `repo/backend/tests/API_tests/*.js` (all route-exercising files), orchestrated by `run_all_api_tests.js`.
- Evidence of real app bootstrap and HTTP transport:
  - `repo/backend/tests/API_tests/helper.js:15-29` (`buildApp`, `app.ready`, DB seeding, `supertest(app.server)`).
  - API modules call concrete HTTP methods/paths (e.g., `runApiSmoke`, `runComprehensiveCoverage`).

### 2) HTTP with Mocking
- `repo/backend/tests/unit_tests/session_hardening.test.js` (`vi.mock('../../src/db')` + `app.inject`) for `/api/auth/logout` and `/api/patients`.
- `repo/backend/tests/unit_tests/patients.spec.js` (`vi.mock('../../src/db')`, `vi.mock('../../src/utils/crypto')` + `app.inject`).
- `repo/backend/tests/unit_tests/admin_auth.test.js`, `auth_negative.test.js` (`vi.mock('../../src/db')` + `app.inject`).

### 3) Non-HTTP (unit/integration without HTTP)
- Backend pure unit tests: `allergy.spec.js`, `crawler.spec.js`, `discounts.test.js`, `invoice_state_machine.spec.js`, `prescription_state_machine.spec.js`, `security.test.js`, `audit.spec.js`, `clinics.service.spec.js`, `users.service.spec.js`, `logger.spec.js`.
- Frontend unit tests (`*.spec.ts`) with Angular TestBed/Jasmine/Karma.
- Frontend E2E browser tests (`repo/frontend/tests/e2e/*.js`) are UI-driven, not direct backend API assertions.

## Mock Detection (Strict)
- `vi.mock('../../src/db', ...)`
  - `repo/backend/tests/unit_tests/audit.spec.js:2`
  - `repo/backend/tests/unit_tests/admin_auth.test.js:1`
  - `repo/backend/tests/unit_tests/auth_negative.test.js:1`
  - `repo/backend/tests/unit_tests/clinics.service.spec.js:1`
  - `repo/backend/tests/unit_tests/patients.spec.js:4`
  - `repo/backend/tests/unit_tests/session_hardening.test.js:1`
  - `repo/backend/tests/unit_tests/users.service.spec.js:1`
- `vi.mock('../../src/utils/crypto', ...)`
  - `repo/backend/tests/unit_tests/patients.spec.js:5`
- `vi.mock('../../src/services/security', ...)`
  - `repo/backend/tests/unit_tests/users.service.spec.js:2`
- `vi.spyOn(...).mockImplementation(...)`
  - `repo/backend/tests/unit_tests/logger.spec.js:26,45`
  - `repo/backend/tests/unit_tests/logger_no_token.test.js:17`

## Coverage Summary
- Total endpoints: **75**
- Endpoints with HTTP tests (any HTTP): **74**
- Endpoints with true no-mock HTTP tests: **73**
- HTTP coverage: **98.67%** (74/75)
- True API coverage: **97.33%** (73/75)

Uncovered or downgraded:
- `GET /api/health`: no evidence of any direct test request.
- `POST /api/auth/logout`: tested only in mocked HTTP unit test (`session_hardening.test.js`), not in no-mock API suite.

## Unit Test Summary

### Backend Unit Tests
- Unit test files detected: `repo/backend/tests/unit_tests/*.js` (15 files).
- Controllers/routes covered (mostly mocked HTTP): auth/admin/patients logging/auth middleware behaviors (`admin_auth.test.js`, `auth_negative.test.js`, `patients.spec.js`, `session_hardening.test.js`, `logger_no_token.test.js`).
- Services/modules covered:
  - `security`, `discounts`, `allergy`, `crawler`, `invoice_state_machine`, `prescription_state_machine`, `clinics`, `users`, `audit`, logger.
- Repositories/data layer:
  - no isolated repository layer tests (direct DB mock usage instead).
- Auth/guards/middleware:
  - partial coverage through `app.inject` tests (auth negative, session hardening, admin auth).

Important backend modules not unit-tested (or weakly unit-tested):
- `repo/backend/src/services/forecasting.js` (no direct unit test file found).
- Route modules lacking dedicated unit-level tests (covered via API tests instead): `billing.js`, `credentialing.js`, `inventory.js`, `overview.js`, `sync_audit.js`, `users.js`, `clinics.js`, `encounters.js`, `prescriptions.js`, `admin.js`.

### Frontend Unit Tests (STRICT REQUIREMENT)
- Frontend test files present: multiple `*.spec.ts` under `repo/frontend/src/app` (e.g., `app.component.spec.ts`, page/service specs).
- Framework/tools detected:
  - Jasmine + Karma: `repo/frontend/karma.conf.cjs:4-8,13,16`
  - Angular TestBed usage: e.g., `repo/frontend/src/app/app.component.spec.ts:25-26`
- Evidence tests import/render actual frontend components/modules:
  - `imports: [AppComponent]` (`app.component.spec.ts:26`)
  - `imports: [InvoicesPageComponent]` (`pages/invoices-page.component.spec.ts:30`)
  - similar pattern across page specs.
- Covered components/modules:
  - Root app, all routed page components, `ApiService`, `AuthService`, `RoleGuard`.
- Important frontend modules not directly unit-tested:
  - `repo/frontend/src/app/app.routes.ts`
  - `repo/frontend/src/app/app.config.ts`

**Mandatory Verdict: Frontend unit tests: PRESENT**

Cross-layer observation:
- Testing is comparatively balanced: substantial backend API coverage and broad frontend component/service unit coverage.
- Remaining imbalance: missing no-mock API test for `/api/auth/logout` and no direct test for `/api/health`.

## API Observability Check
Strong:
- Most API tests show explicit endpoint, payload, and status assertions (e.g., `billing_uat.test.js`, `comprehensive_coverage.test.js`, `requirement_api_test.js`).

Weak:
- Some negative matrices assert only status, with minimal response-body assertions:
  - `repo/backend/tests/API_tests/admin_access.test.js` (looped 403 checks).
  - parts of `route_isolation_matrix.test.js` and `comprehensive_coverage.test.js` use broad status sets.

## Test Quality & Sufficiency
- Success paths: strong (core workflows across encounters, Rx, inventory, billing, admin, credentialing).
- Failure paths: strong (forbidden/validation/conflict cases widely present).
- Edge cases: moderate-to-strong (state transitions, version conflicts, cross-clinic isolation, hard-stop override).
- Validation/auth/permissions: strong, especially RBAC and isolation.
- Integration boundaries: strong backend API-level coverage.
- Assertion depth:
  - good in major suites, but some tests remain status-heavy and permissive (`assert.ok([400,403,404])`).

`run_tests.sh` check:
- Docker-based orchestration: **yes** (`repo/run_tests.sh:4`).
- Local dependency/runtime install present: **flag**
  - installs Chromium at runtime via `apk add` (`repo/run_tests.sh:67`), introducing network/runtime dependency.

## End-to-End Expectations (Fullstack)
- Fullstack E2E expectation: FE↔BE testing present via Playwright suites (`repo/frontend/tests/e2e/*.js`) and backend API acceptance tests.
- Partial compensation quality: strong backend API suite + broad frontend unit coverage.

## Tests Check
- Static evidence indicates substantial test implementation quality.
- Critical static gaps remain:
  - no direct test for `GET /api/health`
  - no true no-mock API test for `POST /api/auth/logout`
  - conditional execution risk for clinic PUT/DELETE in comprehensive suite.

## Test Coverage Score (0–100)
**92/100**

## Score Rationale
- + High endpoint coverage and broad no-mock API coverage.
- + Strong negative/security/isolation scenarios.
- + Frontend unit tests are clearly present and component-linked.
- - One endpoint fully untested (`/api/health`).
- - One endpoint lacks no-mock API coverage (`/api/auth/logout`).
- - Some status-only/permissive assertions reduce rigor.

## Key Gaps
1. Add direct no-mock API test for `POST /api/auth/logout` in API suite.
2. Add direct test for `GET /api/health`.
3. Remove conditional uncertainty for clinic PUT/DELETE by deterministically creating/selecting a clinic fixture.
4. Strengthen response-body assertions in negative/matrix tests.

## Confidence & Assumptions
- Confidence: **high** for static route/test mapping.
- Assumptions:
  - route declarations in current files are authoritative endpoint surface.
  - no dynamic route registration outside inspected files.
  - conditional branches marked `yes*` may not execute in all runtime states.

---

# README Audit

## Target File
- Found at required location: `repo/README.md` (pass for location gate).

## Hard Gate Evaluation

### 1) Formatting
- Markdown structure is generally readable (headings/tables/code blocks present).
- Minor encoding artifacts exist (`â€”`, `â‰¥`) affecting presentation quality.

### 2) Startup Instructions (Backend/Fullstack)
Requirement: must include `docker-compose up`.
- README provides `docker compose up --build` (`repo/README.md:15`), not the required literal `docker-compose up`.
- **Hard Gate: FAIL**

### 3) Access Method
- Provides URL + ports:
  - frontend `http://localhost:14200` (`repo/README.md:18`)
  - backend health `http://localhost:13000/health` (`repo/README.md:19`)
- **Pass**

### 4) Verification Method
- Provides health verification via curl (`repo/README.md:38`).
- Does not provide a concise user-facing UI validation flow in startup section (only test commands later).
- **Partial / weak**

### 5) Environment Rules (STRICT)
Forbidden in README: runtime installs/manual local setup (`npm install`, `pip install`, manual DB setup, etc.), must be Docker-contained.
- Violations found:
  - `npm install` instructions (`repo/README.md:25-26`)
  - local PostgreSQL dependency instructions (`repo/README.md:22-23`, `92-95`)
- **Hard Gate: FAIL**

### 6) Demo Credentials (Auth Conditional)
- Auth is present; README provides role accounts and seed password reference:
  - users/roles (`repo/README.md:240-246`)
  - password default (`repo/README.md:248`)
- **Pass**

## Engineering Quality
- Tech stack clarity: good (Fastify + Angular + PostgreSQL + test stack).
- Architecture explanation: good high-level module map.
- Testing instructions: extensive.
- Security/roles/workflows: reasonably documented.
- Presentation quality: acceptable but with encoding artifacts and over-assertive claims.

## High Priority Issues
1. Hard-gate violation: Docker startup command does not meet required literal (`docker-compose up`) (`repo/README.md:15`).
2. Hard-gate violation: README includes non-Docker local setup and runtime installs (`repo/README.md:21-27`, `92-103`).
3. Claims mismatch risk: README states no-mock coverage for all endpoints while static audit found no test for `GET /api/health` and no no-mock test for `POST /api/auth/logout` (`repo/README.md:53`, route/test evidence above).

## Medium Priority Issues
1. Verification guidance is mostly infrastructure/test-command oriented; explicit manual UI flow is weak in startup verification section.
2. Some statements are absolute (“all 70+ endpoints ... no-mock”) but static evidence includes exceptions.

## Low Priority Issues
1. Encoding/character artifacts reduce readability (`â€”`, `â‰¥`).

## Hard Gate Failures
1. Missing required startup literal `docker-compose up`.
2. Presence of forbidden local dependency and runtime install instructions (`npm install`, local DB setup).

## README Verdict
**FAIL**

## Final Verdicts
- **Test Coverage Audit Verdict:** **PARTIAL PASS** (high but not complete; strict gaps remain).
- **README Audit Verdict:** **FAIL** (hard-gate violations).
