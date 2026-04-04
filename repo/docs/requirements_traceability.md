# MeridianCare Requirements Traceability (Audit v2.0)

## Security Controls

- `SEC-01` 20-minute idle timeout + server-side revocation  
  Implementation: `backend/src/app.js` (`app.auth` checks `sessions.last_active_at`, revokes expired session, returns `401`, refreshes `last_active_at` on successful auth).

- `SEC-02` Clinic-scoped object mutation isolation  
  Implementation: `backend/src/routes/patients.js`, `backend/src/routes/encounters.js`, `backend/src/routes/prescriptions.js` (write/action SQL requires `clinic_id` from `request.user.clinic_id`).

- `SEC-03` Admin-only credentialing import  
  Implementation: `backend/src/routes/credentialing.js` (`opts.permit('admin')` + explicit role check in-handler; non-admin returns `403`).

- `SEC-04` Auth failure log scrubbing  
  Implementation: `backend/src/app.js` (JWT verify failure logs `JWT_VERIFICATION_FAILED` with request id only; no token fragments).

## Test Controls

- `TST-01` API smoke and acceptance chain pass  
  Implementation: `backend/tests/API_tests/run_all_api_tests.js` plus suites under `backend/tests/API_tests/`.

- `TST-02` Session hardening and security-negative tests  
  Implementation:
  - `backend/tests/unit_tests/session_hardening.test.js` (revocation + inactivity timeout).
  - `backend/tests/API_tests/object_isolation.test.js` (cross-clinic read/update/delete and prescription action denial).
  - `backend/tests/API_tests/admin_access.test.js` (non-admin denied admin/observability/model/session endpoints).
  - `backend/tests/unit_tests/logger_no_token.test.js` (no token leakage in auth logs).
