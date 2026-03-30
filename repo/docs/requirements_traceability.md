# Requirements Traceability Matrix

| Req | Coverage |
|---|---|
| 1, 41 | Angular desktop-first role workflow UI (`frontend/src/app/app.component.*`) |
| 2-8 | Encounter + ICD + sign + prescription hard-stop override endpoints (`backend/src/app.js`) |
| 9-12 | Pharmacy queue/action state transitions (`backend/src/app.js`) |
| 13-17 | Billing cart pricing order, invoice/payment, shipping template API (`backend/src/app.js`) |
| 18-20 | Inventory items/movements, low-stock signal in response (`backend/src/app.js`) |
| 21-23 | Credentialing onboard + batch import with row-level validation errors (`backend/src/app.js`) |
| 24-27 | Fastify REST + PostgreSQL schema as local system of record (`backend/src/app.js`, `backend/src/db/schema.sql`) |
| 28-31 | Local auth policies, lockout/timeout, PHI encryption (`backend/src/services/security.js`, `backend/src/utils/crypto.js`) |
| 32 | Immutable audit event + snapshots on key edits (`backend/src/lib/audit.js`) |
| 33-35 | collect->parse->store queue job APIs, retry/backoff (`backend/src/app.js`, `crawler_jobs`) |
| 36-37 | Model version register/deploy/rollback/drift fields (`backend/src/app.js`, `model_versions`) |
| 38 | KPI endpoint + structured logs from Fastify logger (`backend/src/app.js`) |
| 39 | Nightly backup endpoint + restore drill records (`backend/src/app.js`, `backup_drills`) |
| 40 | On-prem dockerized local stack (`docker-compose.yml`) |

## Tests
- Unit tests: `backend/tests/unit/discounts.test.js`, `backend/tests/unit/security.test.js`
- API smoke flow: `backend/scripts/api_smoke_test.js`
- Docker execution: `docker compose up -d --build`, `docker compose exec backend npm test`, `docker compose exec backend node /app/scripts/api_smoke_test.js`
