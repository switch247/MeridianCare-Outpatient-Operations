# API Acceptance Scenarios

Executed by:
- `tests/API_tests/scripts/api_smoke_test.js`
- `tests/API_tests/scripts/requirement_api_test.js`

Covered scenarios:
- Local auth register/login and token issuance
- Physician workflow: create patient, encounter, sign with diagnosis validation
- Prescription hard-stop conflict and override with re-auth password
- Pharmacist workflow: queue read, approve, dispense, and void-after-dispense rejection
- RBAC denial path (physician denied billing endpoint)
- Billing discount order and invoice payment transition
- Shipping template retrieval
- Credentialing batch import row-level error feedback
- Crawler queue and exponential retry scheduling
- Model registration and rollback
- Backup restore drill evidence recording
- Offline sync queue enqueue and status summary
- Auth lockout after five failed attempts and locked login response
- Inventory negative prevention boundary
- Version conflict boundaries for encounter sign and invoice payment
