Purpose
Provide a single, authoritative prompt for MeridianCare Outpatient Operations that contains the original product prompt, an extracted and exact requirements list (business + code + non-functional), a role matrix, and clear per-role user flows. This file is intended for an implementing agent or developer to produce code, tests, artifacts and documentation matching the project's standards.

---

1) ORIGINAL PROMPT

A MeridianCare Outpatient Operations platform capable of running an on-premise clinic with an in-house pharmacy, supply room, and front-desk billing, all from an English Angular web interface optimized for desktop workstations. Physicians create structured encounter notes during a visit, capturing chief complaint, diagnosis, treatment, and follow-up, and select ICD codes from a locally maintained catalog with typeahead search and validation that at least one diagnosis is present before signing. From the same visit, the physician drafts an e-prescription that automatically checks the patient’s recorded allergies and contraindications; high-severity conflicts hard-stop submission unless an override reason is entered and the prescriber re-authenticates with their password. Pharmacists work a review queue that shows prescription state, patient instructions, and inventory availability; they can approve, dispense, or void, with voids requiring a reason and being disallowed after dispensing. Billing staff use a cart-and-checkout center to assemble charges (visit codes, procedures, dispense fees, and retail items), validate quantities as positive integers, apply stacked discount rules in a fixed order (plan discount first, then coupon, then full-reduction threshold such as “$25 off orders over $200”), and generate an invoice for in-person payment outside the system; shipping for optional home delivery uses a local shipping template table (zone-based flat fees, manual carrier and tracking entry) and US address management with ZIP validation. Inventory staff record receiving, dispensing/shipping, returns, and stock counts with optional lot/serial tracking, low-stock alerts, and variance reports, while administrators maintain candidate and organization records for credentialing (providers, pharmacists, and clinic locations), including batch onboarding, eligibility rules (license expiration must be at least 30 days out), and import/export with field mapping and error feedback.

The backend uses Fastify to expose offline REST-style APIs to the Angular client, enforcing server-side validation, state-machine transitions, and concurrency controls, with PostgreSQL as the single local system of record for encounters, prescriptions, patients, invoices, inventory movements, credentialing profiles, and audit history. Authentication is strictly local username/password with minimum 12 characters, bcrypt hashing, 5 failed attempts triggering a 15-minute lockout, and a 20-minute idle session timeout; all PHI is stored locally with column-level encryption for sensitive identifiers and masking in non-clinical views, and every edit to encounters, prescriptions, and credentialing data writes an immutable audit event plus a version snapshot for traceability. Distributed crawler scheduling and workflow orchestration runs entirely inside the deployment to ingest and normalize locally staged data files (for example ICD updates, drug catalogs, or nightly exports) using a dependency chain of collect → parse → store, with priority queues, incremental checkpoints, exponential backoff retries (starting at 30 seconds up to 15 minutes), cross-node load balancing, and elastic auto-scaling within available on-prem nodes. Forecasting and recommendations operate on local historical data, producing visit-volume and medication demand forecasts via pluggable time-series/regression algorithms and similar-patient or similar-prescription suggestions via vectorized feature similarity scoring; each model version is stored, evaluated against a defined baseline, deployed with one-click rollback, and monitored for drift using locally computed metrics. Observability is built-in with end-to-end request tracing, structured logs, exception alerts surfaced in an admin console, KPI dashboards (order volume, acceptance rate, fulfillment time, cancellation rate), and a backup/recovery plan using encrypted nightly database dumps retained for 30 days on local storage with monthly restore drills.

---

2) EXACT EXTRACTED REQUIREMENTS (numbered)
Business / UI requirements
1. English Angular web interface optimized for desktop workstations.
2. Physicians create structured encounter notes capturing: chief complaint, diagnosis(s), treatment, and follow-up.
3. ICD codes are selected from a locally maintained catalog with typeahead search.
4. Validation must ensure at least one diagnosis is present before signing an encounter.
5. From the same visit, physicians draft e-prescriptions tied to the encounter.
6. E-prescription must automatically check patient-recorded allergies and contraindications.
7. High-severity allergy/contraindication conflicts cause a hard-stop on submission.
8. Overrides for hard-stops require entering an override reason and prescriber re-authentication with password.

Pharmacy & medication requirements
9. Pharmacists have a review queue showing prescription state, patient instructions, and inventory availability.
10. Pharmacists can perform actions: Approve, Dispense, Void.
11. Voids require a reason and are disallowed after dispensing.
12. Partial fills/dispense behavior must be modeled (implicit requirement for accurate inventory and invoices).

Billing & payments
13. Billing staff use a cart-and-checkout center to assemble charges including visit codes, procedures, dispense fees, and retail items.
14. Quantity fields validated as positive integers.
15. Discounts applied in fixed stacked order: plan discount first, then coupon, then full-reduction (e.g., $25 off over $200).
16. System generates an invoice for in-person payment that occurs outside the system (invoice state must be tracked).
17. Optional home delivery: shipping uses a local shipping template table (zone-based flat fees), manual carrier and tracking entry, and US address management with ZIP validation.

Inventory & supply
18. Inventory staff record receiving, dispensing/shipping, returns, and stock counts.
19. Optional lot and serial tracking for items (per-item configurability).
20. Low-stock alerts and variance reports are generated.

Credentialing & admin
21. Administrators maintain candidate and organization records for credentialing providers, pharmacists, and clinic locations.
22. Batch onboarding with import/export and field mapping must provide error feedback per-row.
23. Eligibility rules: license expiration must be at least 30 days out at onboarding.

Backend, data & APIs
24. Backend uses Fastify to expose REST-style APIs to the Angular client.
25. APIs must support offline-style operation (client may be intermittent) — document offline behavior and sync expectations.
26. Server-side validation, state-machine transitions, and concurrency controls are required for domain objects.
27. PostgreSQL is the single local system of record for encounters, prescriptions, patients, invoices, inventory movements, credentialing profiles, and audit history.

Security, auth & PHI
28. Authentication is local username/password, minimum 12 characters, bcrypt hashing.
29. Lockout policy: 5 failed attempts => 15-minute lockout.
30. Session idle timeout: 20 minutes.
31. PHI stored locally with column-level encryption for sensitive identifiers and masking in non-clinical views.

Auditing & versioning
32. Every edit to encounters, prescriptions, and credentialing data writes an immutable audit event plus a version snapshot for traceability.

Crawler, ingestion & orchestration
33. Distributed crawler scheduling and workflow orchestration run inside the deployment to ingest/normalize locally staged data files (ICD updates, drug catalogs, nightly exports).
34. Crawler pipeline follows collect → parse → store with priority queues, incremental checkpoints, and exponential backoff retries (30s → 15min).
35. Cross-node load balancing and elastic auto-scaling within available on-prem nodes are supported.

Forecasting & recommendations
36. Forecasting and recommendations operate on local historical data producing visit-volume and medication demand forecasts via pluggable algorithms.
37. Model versions are stored, evaluated against a defined baseline, deployed with one-click rollback, and monitored for drift using locally computed metrics.

Observability & backups
38. Observability: end-to-end request tracing, structured logs, exception alerts surfaced in an admin console, and KPI dashboards (order volume, acceptance rate, fulfillment time, cancellation rate).
39. Backup/recovery: encrypted nightly database dumps retained for 30 days on local storage and monthly restore drills.

Non-functional
40. All core systems operate on-premise (no cloud dependencies for core flows).
41. Client UI optimized for desktop workstations (layout, density, keyboard shortcuts, larger grids).

3) ROLE MATRIX (roles, responsibilities, and required permissions)
- Physician: create/edit encounter notes; select ICD codes; sign encounters; draft/submit e-prescriptions; override allergy hard-stops with re-auth and reason; view patient medication history. Permissions: Encounter: create/edit/sign; Prescription: create/override(submit+re-auth); Audit: view own actions.
- Pharmacist: view review queue; inspect prescription details and inventory; approve/dispense/void prescriptions; record dispense movements; add dispense notes. Permissions: Prescription: review/approve/dispense/void; Inventory: read/write dispenses; Audit: view/field-level.
- Billing Staff: assemble cart; apply discounts; validate quantities; generate invoices; mark payment/reconciliation entries (manual). Permissions: Billing: create/edit invoices; Discounts: apply; Invoice: update payment status; Reports: view financials.
- Inventory Staff: receive shipments; record putaway; process dispensing and shipping movements; process returns; perform stock counts; configure lot/serial on products. Permissions: Inventory: full CRUD for movements and counts; Product: manage lot/serial flags.
- Administrator: manage users, credentials, candidate/org records; run batch onboarding; manage ICD/drug catalogs; configure shipping templates; view KPIs and audit logs; manage backups and crawler schedules. Permissions: Full admin RBAC, unlock accounts, override system settings.
- Auditor / Compliance (read-only role): view audit events, version snapshots, export audit reports. Permissions: read-only access to audit trails and export.

4) USER FLOWS (high-level step-by-step for each role)
Physician encounter → prescription flow
- Login (local auth)
- Open patient record → Create encounter (enter chief complaint, treatment, follow-up)
- Add diagnosis: invoke ICD typeahead, select code(s) from local catalog
- System validates at least one diagnosis before allowing Sign
- Draft e-prescription from encounter: select drug, dose, route, quantity
- System checks allergies/contraindications; if high-severity conflict, hard-stop submission and prompt for override reason + password re-entry
- On successful sign/submit, write audit event and version snapshot; persist prescription linked to encounter

Pharmacist review & dispense flow
- Login → open pharmacist review queue
- Inspect prescription: view state, patient instructions, inventory availability
- If stock available, Approve → allocate inventory (create movement), Dispense → produce dispense record, decrement inventory
- If user selects Void before dispensing, require a reason and write audit; disallow Void after Dispense
- For returns/recalls, create return movement referencing original dispense

Billing cart & invoice flow
- Login → open cart-and-checkout
- Add charges: visit codes, procedures, dispense fees, retail items; validate quantities are positive integers
- Apply discounts in order: plan discount → coupon → full-reduction threshold
- Review final total → Generate invoice (state=Unpaid) and optionally print or export
- When cash is collected outside system, billing staff records manual payment against invoice with tender type and reference

Inventory lifecycle flow
- Receive shipment: create receiving movement, optionally assign lot/serial and expiry
- Putaway: increment on-hand at location
- Dispense/ship: create dispensing movement referencing prescription or sales invoice
- Returns: create return movement referencing original dispense
- Stock count: perform count, record variances, generate variance reports
- Low-stock: system generates alerts to subscribed users/roles

Administrator credentialing & onboarding flow
- Login as admin → open credentialing module
- Create candidate or organization record or upload batch (CSV/Excel) using import template
- Validate rows: enforce license expiration > now + 30 days; present per-row field mapping errors and allow corrections
- On successful validation, onboard candidate and create credential profile; write audit trail and snapshots

Crawler ingestion & model lifecycle flow
- Admin stages files into ingest directory or schedules feeds
- Crawler collects → parses → stores; uses incremental checkpoints and retries on transient failure
- Parsed ICD/drug catalogs update local catalogs with version metadata; changes produce audit events
- Forecast models trained on local historical data; stored with version metadata and evaluated vs baseline; admin may roll forward or rollback a model with one click

Backup & restore flow
- Nightly encrypted DB dump and attachments snapshot stored locally; retention for 30 days
- Admin can initiate monthly restore drill using restore UI; restore process logs steps and outcomes

5) CODE & ARCHITECTURE NOTES (concise)
- Backend: Fastify-based REST APIs, modules for auth, encounters, prescriptions, pharmacy, billing, inventory, credentialing, crawler, forecasting, observability and admin.
- DB: PostgreSQL with revision/version tables and append-only audit events for key domains.
- Auth: local username/password (min 12), bcrypt, 5-fail lockout, 20-min idle timeout, session revocation endpoints.
- PHI protection: column-level encryption for sensitive identifiers, masking in non-clinical views; document key management approach.
- Crawler: internal scheduler with retry/backoff, priority queues, idempotent import semantics.
- Observability: request tracing, structured logs, admin console alerts, KPI dashboards.
- Backups: encrypted dumps, retention and restore scripts.

6) DEFINITION OF DONE (extracted from prompt)
- All business requirements (1–41) implemented or explicitly scoped with acceptance tests.
- Role matrix implemented with RBAC enforcement for all actions described.
- Per-role user flows are demoable end-to-end for core scenarios: (physician encounter+prescription, pharmacist dispense, billing invoice, inventory receive/dispense, admin credentialing, crawler ingest, backup/restore).
- Server enforces validation, state transitions and concurrency controls.
- PHI encryption, audit immutability, and version snapshots implemented for encounters, prescriptions, and credentialing records.
- Nightly backups are encrypted and retained 30 days; monthly restore drill documented.

---

Next steps
- Confirm this extracted requirements list matches your expectation and whether you want the file formatted into an implementation plan (OpenAPI, migrations, seed data) like the provided example. I can also convert this into prioritized tickets and acceptance criteria.
implementations must be made by taking into account the general_guide.md and qa_guide.md all code goes in /repo directory including readme 