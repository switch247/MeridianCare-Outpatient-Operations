(# MeridianCare — Phase‑1 Design Summary)

Overview
- Purpose: lightweight outpatient operations UI + API for clinic, users, patients, encounters, prescriptions, inventory and billing with strong auth/session handling, centralized logging, and audit events correlated by request id.
- Stack: Node.js Fastify backend, PostgreSQL (schema in `backend/src/db/schema.sql`), Vitest tests; Angular frontend (standalone components), pino-based centralized logger.

Architecture
- Backend
	- Fastify app entry: `backend/src/app.js` — registers logger plugin, `auth` decorator, and route modules under `backend/src/routes/`.
	- Routes: modular files (e.g., `auth.js`, `users.js`, `clinics.js`, `patients.js`, `inventory.js`, `billing.js`, `prescriptions.js`) implementing REST endpoints and forwarding `request.requestId` to services and `writeAudit()` where applicable.
	- Services layer: `backend/src/services/*` contains business logic (users, discounts, security, etc.). Sessions are validated against the `sessions` table; JWT `jti` is used for revocation/inactivity checks.
	- DB: `backend/src/db/schema.sql` defines tables for users, sessions, clinics, audits, inventory, invoices, patients, encounters, and related indices.
	- Seeder: `backend/src/db/seed.js` is idempotent and seeds a single clinic and one user per role.

- Frontend
	- Angular standalone components in `frontend/src/app/pages/` (user-management, my-clinic, inventory, invoices, etc.).
	- Central `ApiService` at `frontend/src/app/services/api.service.ts` exposes concise endpoints matching backend routes (e.g., `/api/users`, `/api/clinics`, `/api/inventory`, `/api/invoices`).
	- Layout: `frontend/src/app/app.component.html` provides a sticky sidebar/topbar, and fallback SCSS ensures usable UI without Tailwind.

Auth & Sessions
- Token acceptance: backend accepts JWT from `Authorization: Bearer`, `session` cookie, request body `token`, or query `token`.
- Sessions: JWT `jti` maps to `sessions` table entries; middleware enforces inactivity TTLs and kiosk-specific TTLs and updates `last_active` on requests.
- RBAC: `permit(permission)` pre-handler validates role permissions via `can(role, permission)` helpers.

Logging & Auditing
- Central logger: `backend/src/lib/logger.js` wraps pino, sanitizes PHI, attaches `request.requestId` and ensures console fallbacks for visibility.
- `writeAudit()` persists audit events and includes `_correlationId` in `event_data` so logs and DB events can be correlated.

Frontend UX
- User management: table + modal (clinic_id read-only; modal hides clinic on edit), My Clinic page for admin edits, Inventory and Invoices simple tables and placeholder modals.
- Auth UX: login persists token via `ApiService.persistToken()`; `GET /api/auth/me` used to populate `currentUser`.

Testing & Gaps
- Existing: backend unit tests (Vitest) for core routes/services; seeder used during startup in dev.
- Gaps and next steps: full audit hook coverage verification, add audit correlation tests, auth/session unit tests, Tailwind build and UI polish, Phase‑1 README and run documentation.

Files of interest
- Backend: `backend/src/app.js`, `backend/src/lib/logger.js`, `backend/src/lib/audit.js`, `backend/src/db/seed.js`, `backend/src/routes/*.js`, `backend/src/services/*.js`.
- Frontend: `frontend/src/app/app.component.*`, `frontend/src/app/services/api.service.ts`, `frontend/src/app/pages/*.component.ts`, `frontend/src/styles.scss`.

Run notes
- Backend dev: from `repo/backend` run `npm install` then `npm run start` (or use docker-compose). Seeder logs seeded users (default password `Password!123` unless `SEED_PASSWORD` is set).
- Frontend dev: from `repo/frontend` run `npm install` then `npm run start`. If Tailwind not built, fallback styles keep UI usable.

