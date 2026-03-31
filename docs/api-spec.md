(# MeridianCare — Phase‑1 API Specification (summary))

Base URL: `/api`

Authentication
- All protected endpoints require a valid JWT. The backend accepts tokens from: `Authorization: Bearer <token>`, cookie `session`, request body `token`, or query string `?token=`.

Common headers
- `Authorization: Bearer <token>` — preferred for frontend
- `Content-Type: application/json`

Endpoints (implemented / scaffolded)
- Auth
	- POST `/api/auth/login` — body: `{ username, password }`. Returns `{ token, role, user }`.
	- GET `/api/auth/me` — returns current `user` profile.

- Users
	- GET `/api/users` — list users (requires `users:read` via RBAC).
	- POST `/api/users` — create user `{ username, password, role }`.
	- PUT `/api/users/:id` — update user (does not accept `clinic_id` from UI edits).
	- DELETE `/api/users/:id` — delete user.

- Clinics
	- GET `/api/clinics` — list clinics (requires `credentialing:read`).
	- PUT `/api/clinics/:id` — update clinic (requires `credentialing:write`).

- Inventory
	- GET `/api/inventory` — list inventory items.
	- POST `/api/inventory` — create item.
	- PUT `/api/inventory/:id` — update item.
	- DELETE `/api/inventory/:id` — delete item.

- Invoices / Billing
	- GET `/api/invoices` — list invoices.
	- POST `/api/invoices` — create invoice.
	- DELETE `/api/invoices/:id` — delete invoice.
	- POST `/api/billing/price` — calculate billing price (payload: cart lines + rules).

- Patients & Encounters (high-level)
	- POST `/api/patients` — create patient.
	- POST `/api/encounters` — create encounter.
	- POST `/api/encounters/:id/sign` — sign encounter.

Audit & Observability
- Audit events are written by `writeAudit()` (backend) and include `_correlationId` set to `request.requestId` when available.
- KPI endpoints used by frontend stubs: `/api/observability/kpis` and `/api/sync/status`.

Errors
- Standard JSON error shape used across endpoints, e.g. `{ error: true, msg: 'Not authorized' }` or HTTP 4xx/5xx with details under `error`.

Notes
- RBAC enforced via `permit(permission)` pre-handler; ensure JWT contains `role` and `jti` for session checks.
- If backend routes for inventory/invoices are missing in your deployment, the frontend will 404 — mocking or temporary backend handlers can be added under `backend/src/routes/`.

Files to inspect for exact shapes and validations
- `backend/src/routes/*.js` and `backend/src/services/*.js` for parameter expectations
- `frontend/src/app/services/api.service.ts` for client-side payloads and endpoints

