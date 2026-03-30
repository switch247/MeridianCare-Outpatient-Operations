CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL, failed_attempts INT NOT NULL DEFAULT 0, lockout_until TIMESTAMPTZ, last_active_at TIMESTAMPTZ,
  clinic_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  jti TEXT NOT NULL UNIQUE,
  kiosk BOOLEAN NOT NULL DEFAULT FALSE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  contact_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  type TEXT NOT NULL DEFAULT 'clinical',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, ssn_encrypted TEXT,
  allergies JSONB NOT NULL DEFAULT '[]'::jsonb, contraindications JSONB NOT NULL DEFAULT '[]'::jsonb);
CREATE TABLE IF NOT EXISTS icd_catalog (code TEXT PRIMARY KEY, label TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, version_tag TEXT NOT NULL DEFAULT 'local-v1');
CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id), physician_id UUID NOT NULL REFERENCES users(id),
  chief_complaint TEXT NOT NULL, treatment TEXT NOT NULL, follow_up TEXT NOT NULL, diagnoses JSONB NOT NULL DEFAULT '[]'::jsonb,
  state TEXT NOT NULL DEFAULT 'draft', version INT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), encounter_id UUID NOT NULL REFERENCES encounters(id), patient_id UUID NOT NULL REFERENCES patients(id),
  prescriber_id UUID NOT NULL REFERENCES users(id), drug_name TEXT NOT NULL, dose TEXT NOT NULL, route TEXT NOT NULL, quantity INT NOT NULL,
  instructions TEXT NOT NULL, override_reason TEXT, state TEXT NOT NULL DEFAULT 'draft', version INT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, on_hand INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10, lot_tracking BOOLEAN NOT NULL DEFAULT FALSE, serial_tracking BOOLEAN NOT NULL DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), item_id UUID NOT NULL REFERENCES inventory_items(id), movement_type TEXT NOT NULL,
  quantity INT NOT NULL, ref_type TEXT, ref_id UUID, lot TEXT, serial TEXT, reason TEXT, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), patient_id UUID NOT NULL REFERENCES patients(id), lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, plan_discount NUMERIC(12,2) NOT NULL DEFAULT 0, coupon_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  threshold_discount NUMERIC(12,2) NOT NULL DEFAULT 0, total NUMERIC(12,2) NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'unpaid', payment_ref TEXT, version INT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS credentialing_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), entity_type TEXT NOT NULL, full_name TEXT NOT NULL, license_number TEXT,
  license_expiry DATE, status TEXT NOT NULL DEFAULT 'pending', version INT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), entity_type TEXT NOT NULL, entity_id UUID NOT NULL, action TEXT NOT NULL,
  actor_id UUID, actor_role TEXT, event_data JSONB NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS shipping_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone TEXT NOT NULL UNIQUE,
  flat_fee NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS crawler_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 5,
  state TEXT NOT NULL DEFAULT 'queued',
  checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  retries INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_type TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  baseline_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  current_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  drift_score NUMERIC(12,4) NOT NULL DEFAULT 0,
  is_deployed BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_target_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_drills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO icd_catalog (code, label) VALUES ('J06.9', 'Acute upper respiratory infection, unspecified') ON CONFLICT DO NOTHING;
INSERT INTO icd_catalog (code, label) VALUES ('E11.9', 'Type 2 diabetes mellitus without complications') ON CONFLICT DO NOTHING;
INSERT INTO shipping_templates (zone, flat_fee) VALUES ('US-EAST', 9.99) ON CONFLICT DO NOTHING;
INSERT INTO shipping_templates (zone, flat_fee) VALUES ('US-WEST', 12.99) ON CONFLICT DO NOTHING;
