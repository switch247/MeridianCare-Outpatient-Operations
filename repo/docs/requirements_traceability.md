# Requirements Traceability Matrix (1-41)

| Req | Implementation evidence | Acceptance test evidence |
|---|---|---|
| 1 | `frontend/src/app/app.component.html` | Manual desktop flow + `backend/tests/API_tests/requirement_api_test.js` |
| 2 | `backend/src/routes/encounters.js`, `frontend/src/app/pages/physician-encounter-page.component.ts` | `backend/tests/API_tests/phase2_clinical_e2e_test.js` |
| 3 | `backend/src/routes/patients.js`, `backend/src/db/schema.sql` (`icd_catalog`) | `backend/tests/API_tests/phase2_clinical_e2e_test.js` |
| 4 | `backend/src/routes/encounters.js` (`sign` guard) | `backend/tests/API_tests/requirement_api_test.js` |
| 5 | `backend/src/routes/prescriptions.js` | `backend/tests/API_tests/phase2_clinical_e2e_test.js` |
| 6 | `backend/src/services/allergy.js` | `backend/tests/unit_tests/allergy.spec.js` |
| 7 | `backend/src/routes/prescriptions.js` hard-stop 409 | `backend/tests/API_tests/api_smoke_test.js` |
| 8 | `backend/src/routes/prescriptions.js` override reason + reauth | `backend/tests/API_tests/requirement_api_test.js` |
| 9 | `backend/src/routes/prescriptions.js` queue projection | `backend/tests/API_tests/phase3_pharmacy_e2e_test.js` |
| 10 | `backend/src/routes/prescriptions.js` actions | `backend/tests/API_tests/api_smoke_test.js` |
| 11 | `backend/src/routes/prescriptions.js` void guard | `backend/tests/API_tests/api_smoke_test.js` |
| 12 | `backend/src/services/prescription_state_machine.js` partial dispense | `backend/tests/API_tests/phase3_pharmacy_e2e_test.js` |
| 13 | `backend/src/routes/billing.js`, `frontend/src/app/pages/invoices-page.component.ts` | `backend/tests/API_tests/phase4_billing_e2e_test.js` |
| 14 | `backend/src/services/discounts.js` | `backend/tests/unit_tests/discounts.test.js` |
| 15 | `backend/src/services/discounts.js` fixed order | `backend/tests/unit_tests/discounts.test.js` |
| 16 | `backend/src/routes/billing.js` invoice state transitions (unpaid->paid/cancelled) | `backend/tests/API_tests/phase4_billing_e2e_test.js` |
| 17 | `backend/src/routes/billing.js`, `backend/src/db/schema.sql` (`shipping_templates` + ZIP validation) | `backend/tests/API_tests/phase4_billing_e2e_test.js` |
| 18 | `backend/src/routes/inventory.js` movements | `backend/tests/API_tests/requirement_api_test.js` |
| 19 | `backend/src/routes/inventory.js`, `backend/src/routes/prescriptions.js` | `backend/tests/API_tests/phase3_pharmacy_e2e_test.js` |
| 20 | `backend/src/routes/inventory.js` alerts/variance | `backend/tests/API_tests/requirement_api_test.js` |
| 21 | `backend/src/routes/credentialing.js` | `backend/tests/API_tests/requirement_api_test.js` |
| 22 | `backend/src/routes/credentialing.js` import errors | `backend/tests/API_tests/api_smoke_test.js` |
| 23 | `backend/src/routes/credentialing.js` expiry validator | `backend/tests/API_tests/requirement_api_test.js` |
| 24 | `backend/src/app.js` route modules | `backend/tests/API_tests/api_smoke_test.js` |
| 25 | `backend/src/routes/sync_audit.js` offline queue/status | `backend/tests/API_tests/api_smoke_test.js` |
| 26 | `backend/src/routes/*` guards + version checks | `backend/tests/API_tests/requirement_api_test.js` |
| 27 | `backend/src/db/schema.sql` | Docker DB-backed API tests (`run_tests.ps1`) |
| 28 | `backend/src/routes/auth.js`, `backend/src/services/security.js` | `backend/tests/unit_tests/security.test.js` |
| 29 | `backend/src/routes/auth.js` lockout | `backend/tests/API_tests/requirement_api_test.js` |
| 30 | `backend/src/app.js` session inactivity enforcement | `backend/tests/API_tests/requirement_api_test.js` |
| 31 | `backend/src/utils/crypto.js`, `backend/src/routes/patients.js` masking | `backend/tests/unit_tests/patients.spec.js` |
| 32 | `backend/src/lib/audit.js`, audited route writes | `backend/tests/unit_tests/audit.spec.js` |
| 33 | `backend/src/routes/admin.js` crawler run/queue/process-next collect->parse->store | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 34 | `backend/src/services/crawler.js`, `backend/src/routes/admin.js` retry scheduling | `backend/tests/unit_tests/crawler.spec.js` |
| 35 | `backend/src/routes/admin.js` node-aware processing (`node_id`) | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 36 | `backend/src/routes/admin.js` model register + baseline checks | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 37 | `backend/src/routes/admin.js` deploy/rollback/drift endpoints | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 38 | `backend/src/lib/logger.js`, `backend/src/routes/admin.js` (`/api/observability/*`) | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 39 | `backend/src/routes/admin.js` (`/api/admin/backups/nightly`, `/restore-drill`) | `backend/tests/API_tests/phase5_ops_e2e_test.js` |
| 40 | `docker-compose.yml` local-only services | `docker compose up --build` |
| 41 | `frontend/src/app/app.component.scss`, role workflow pages | Manual desktop validation + Angular build |

## One-command validation
- Startup: `docker compose up --build`
- Full verification: `./run_tests.sh` (Linux/macOS) or `.\run_tests.ps1` (PowerShell)
