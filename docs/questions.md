Business Logic Questions Log:

1) ICD catalog updates: source and cadence
Question: The prompt mentions a "locally maintained catalog" for ICD codes. How are ICD updates delivered (file import, manual admin UI, scheduled crawler)? What is the expected update cadence and format?
My understanding: ICD updates will be ingested by the on-prem crawler as staged files (e.g., CSV/JSON) but the exact format and frequency are unspecified.
Solution: Support both manual admin upload and scheduled import via the crawler; define a simple CSV/JSON schema and an "import schedule" setting.

2) ICD validation and code versioning
Question: When validating ICD codes at diagnosis/signing, which ICD version(s) are supported and how should historical encounters reference older code sets?
My understanding: The system should validate against the current local catalog but retain the exact code and catalog version in the encounter snapshot.
Solution: Store code + catalog version on encounters; provide a catalog version field and a migration policy for older records.

3) E-prescription severity and overrides
Question: What defines a "high-severity" allergy/contraindication conflict versus a lower severity? Are severity mappings provided in the drug/allergy catalog?
My understanding: There must be a severity attribute on interactions (e.g., minor/moderate/severe) but mapping rules are not specified.
Solution: Require an interactions file that includes severity levels; implement configurable severity thresholds that trigger hard-stop versus warning.

4) Re-authentication for override
Question: The prompt requires the prescriber to "re-authenticate with their password" for overrides—does this mean the same primary credentials, or a privileged PIN/2FA? Should an override require higher-level permission or audit fields?
My understanding: Re-entering the same password is intended, but details on escalation and audit capture are missing.
Solution: Require password re-entry (primary credential) and capture the override reason, user ID, time, and affected fields in the immutable audit event; consider optional 2FA for higher assurance.

5) Pharmacist workflow and allowed transitions
Question: The prescription flow lists approve, dispense, or void, with void disallowed after dispensing. Are there intermediate states (e.g., reviewed, awaiting-fill, partially-dispensed)? How should partial fills be represented?
My understanding: Minimal state machine implied; partial fills and holds are not defined.
Solution: Define explicit states: Created → Reviewed → Approved → Awaiting Fill → Partially Dispensed → Dispensed → Voided; disallow Voided when Dispensed or Partially Dispensed with quantity>0 unless a return is processed.

6) Voids and returns relationship
Question: If a prescription is voided after dispense is disallowed, how should returns/recalls be handled? Are inventory returns recorded against the original prescription or as separate transactions?
My understanding: Returns are separate inventory movements, but the linkage to the original prescription isn't specified.
Solution: Record return/recall movements referencing the originating prescription and original dispense movement; allow financial adjustments referencing invoice/dispense.

7) Billing: invoice for in-person payment outside the system
Question: When generating an invoice for in-person payment "outside the system", does the system need to record payment status and reconciliation entries once cash is collected? Any requirement for receipt generation or cashier reconciliation?
My understanding: Invoices should be generated and marked unpaid; reconciliation process is unspecified.
Solution: Create invoice states (Unpaid, Partially Paid, Paid, Voided) and a manual payment entry screen for billing staff to mark payments and record tender type and reference.

8) Discount stacking and calculation order
Question: The stacking order is defined (plan → coupon → full-reduction). How should percentage vs fixed-amount coupons interact with full-reduction thresholds, and what rounding/precision rules apply?
My understanding: Order is fixed but interactions (percentage vs fixed) and rounding rules are unspecified.
Solution: Define calculation rules: apply plan discount first (percentage or fixed), then coupon (apply percent before fixed by coupon definition), then evaluate full-reduction on post-discount subtotal; specify currency rounding to cents at each step.

9) Shipping templates and address validation
Question: For home delivery, shipping uses "zone-based flat fees" and US ZIP validation—what constitutes a zone mapping (ZIP range, state-based)? Should international addresses be allowed later?
My understanding: Initially US-only with ZIP-based zones, but mapping details are missing.
Solution: Implement zone table mapping ZIP prefixes (first 3 digits) to zones with fallbacks to state-level; validate ZIP using USPS ZIP format and allow a toggle for future international addresses.

10) Inventory: optional lot/serial tracking
Question: Lot/serial tracking is optional—should this be a per-product setting, and how should expiration dates, FIFO/LIFO, and lot-level quantities be modeled?
My understanding: Per-item configuration expected; specifics for handling expirations and allocation are not provided.
Solution: Add product-level flags for lotTracking and serialTracking, store lot entries with qty and expiry, and support FIFO allocation by default with configurable policies.

11) Low-stock alerts and thresholds
Question: How are low-stock thresholds defined (per-location, per-product, global)? Should alerts be per user preference or role-based?
My understanding: Thresholds likely per-location and per-product but not stated.
Solution: Allow per-product, per-location reorderThreshold and criticalThreshold, with alert subscriptions by role and an admin defaults page.

12) Credentialing: "license expiration must be at least 30 days out"
Question: Does "at least 30 days out" mean the license expiration must be more than 30 days from the date of onboarding, or from next scheduled activity? How are renewals handled?
My understanding: Likely means expiration > now + 30 days at onboarding time.
Solution: Enforce expiration_date > now + 30 days for onboarding; add automated renewal reminders and an exception workflow for temporary approvals.

13) Batch onboarding import/export mapping
Question: For batch onboarding, what are the accepted file formats and required fields? How should mapping errors be surfaced (row-level vs summary)?
My understanding: CSV/Excel are typical, but required fields and error reporting are unspecified.
Solution: Support CSV/Excel with a template export, require minimal required fields (name, license number, license type, expiration, role), and provide row-level error feedback with downloadable error file.

14) Authentication and lockout scope
Question: The lockout policy is "5 failed attempts triggering a 15-minute lockout"—is this per-username, per-IP, per-device, or combined? Should admins be able to manually unlock accounts?
My understanding: Likely per-username; admin manual unlock implied but not explicit.
Solution: Apply per-username lockout with optional IP-based rate limiting; provide an admin unlock endpoint with audit logging.

15) Session management and refresh behavior
Question: A 20-minute idle session timeout is specified—are sliding sessions permitted, and are refresh tokens or long-lived sessions allowed for trusted workstations?
My understanding: Idle timeout suggests sliding expiration but not explicit about refresh tokens.
Solution: Use sliding expiration on session cookies; allow a "trusted workstation" flag that extends session length subject to admin policy.

16) Column-level encryption and PHI field list
Question: Which specific fields are considered "sensitive identifiers" requiring column-level encryption and which fields should be masked in non-clinical views? Is there a canonical PHI field list?
My understanding: Names, SSNs, DOB, MRN, and contact details are likely sensitive but not enumerated.
Solution: Request canonical PHI field list; default to encrypt MRN, SSN, national IDs, phone numbers, and insurance IDs; mask partial name and DOB in non-clinical views.

17) Audit immutability and retention
Question: Audits are immutable and include version snapshots—what is the retention policy, and can audits ever be redacted for legal reasons? Who can access audit snapshots?
My understanding: Retention unspecified; access control unspecified.
Solution: Define a retention policy (e.g., 7 years by default), an admin redaction workflow requiring justification and separate redaction audit, and role-based access to audit data.

18) Offline REST-style APIs meaning
Question: The backend "exposes offline REST-style APIs"—does "offline" mean the client operates in intermittent-connectivity mode with local caching, or simply that APIs are internal to the local network (not cloud)?
My understanding: Likely refers to on-prem/local network APIs rather than internet-dependent cloud APIs, but client offline-first behavior is unclear.
Solution: Clarify whether offline-first (local client cache and sync) is required; if not, document APIs as on-prem REST endpoints.

19) Crawler behavior and file formats
Question: The distributed crawler ingests ICD updates, drug catalogs, and nightly exports—what are the exact file formats, expected directories, and failure semantics (e.g., partial file, duplicate records)?
My understanding: Generic collect→parse→store chain described but file specs not provided.
Solution: Provide file format contracts for each feed, define idempotency keys, and document failure handling with quarantined file area and operator retry options.

20) Forecast baseline and drift metrics
Question: Forecasting models are compared to a "defined baseline"—who defines that baseline, which metrics (MAE, MAPE) should be used, and what's the rollback criteria?
My understanding: Baseline likely provided by product/analytics owners; metrics unspecified.
Solution: Require baseline definition per model (e.g., historical mean or naive forecast), define evaluation metrics (MAE, MAPE), and set a configurable drift alert threshold that triggers rollback eligibility.
