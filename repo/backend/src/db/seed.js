const { pool, initDb } = require('./index');
const { hashPassword } = require('../services/security');

async function upsertClinic(name, address, contact_info, type) {
  const found = await pool.query('SELECT id FROM clinics WHERE name=$1 LIMIT 1', [name]);
  if (found.rows.length) {
    const id = found.rows[0].id;
    await pool.query('UPDATE clinics SET address=$1, contact_info=$2, type=$3, updated_at=NOW() WHERE id=$4', [address, contact_info, type, id]);
    return id;
  }
  const res = await pool.query('INSERT INTO clinics (name,address,contact_info,type) VALUES($1,$2,$3,$4) RETURNING id', [name, address, contact_info, type]);
  return res.rows[0].id;
}

async function upsertUser(username, password, role, clinicId) {
  const found = await pool.query('SELECT id FROM users WHERE username=$1 LIMIT 1', [username]);
  const hash = await hashPassword(password);
  if (found.rows.length) {
    const id = found.rows[0].id;
    await pool.query('UPDATE users SET password_hash=$1, role=$2, clinic_id=$3 WHERE id=$4', [hash, role, clinicId, id]);
    const r = await pool.query('SELECT id, username, role FROM users WHERE id=$1', [id]);
    return r.rows[0];
  }
  const res = await pool.query('INSERT INTO users (username,password_hash,role,clinic_id) VALUES($1,$2,$3,$4) RETURNING id, username, role', [username, hash, role, clinicId]);
  return res.rows[0];
}

async function upsertPatient(name, allergies = [], contraindications = [], clinicId = null) {
  const found = await pool.query('SELECT id FROM patients WHERE name=$1 LIMIT 1', [name]);
  if (found.rows.length) return found.rows[0].id;
  const r = await pool.query('INSERT INTO patients (name, allergies, contraindications, clinic_id) VALUES($1,$2,$3,$4) RETURNING id', [name, JSON.stringify(allergies), JSON.stringify(contraindications), clinicId]);
  return r.rows[0].id;
}

async function run() {
  try {
    await initDb();

    const clinicName = 'MeridianCare Clinic';
    const clinicId = await upsertClinic(clinicName, '123 Health Way, Suite 100', { phone: '+1-555-0100', email: 'admin@meridiancare.local' }, 'clinical');
    console.log('Clinic id:', clinicId);

    const roles = ['physician','pharmacist','billing','inventory','admin','auditor'];
    const runningTests = process.env.NODE_ENV === 'test' || process.argv.join(' ').toLowerCase().includes('vitest');
    const password = process.env.SEED_PASSWORD || 'Password!123';
    const createdUsers = {};
    for (const r of roles) {
      const username = `${r}@local`;
      const u = await upsertUser(username, password, r, clinicId);
      createdUsers[r] = u;
      console.log('Upserted user', u.username);
    }

    const adminId = createdUsers['admin'].id;
    await pool.query('UPDATE clinics SET created_by=$1, updated_at=NOW() WHERE id=$2', [adminId, clinicId]);

    const patients = [
      { name: 'John Doe', allergies: ['penicillin'], contraindications: [] },
      { name: 'Mary Smith', allergies: [], contraindications: ['aspirin'] },
      { name: 'Carlos Ruiz', allergies: [], contraindications: [] }
    ];
    const patientIds = [];
    for (const p of patients) {
      const id = await upsertPatient(p.name, p.allergies, p.contraindications, clinicId);
      patientIds.push(id);
    }
    console.log('Patients:', patientIds);

    // Inventory items - use ON CONFLICT upsert
    const items = [
      { sku: 'MED-001', name: 'Amoxicillin 500mg', on_hand: 120 },
      { sku: 'MED-002', name: 'Atorvastatin 20mg', on_hand: 80 },
      { sku: 'KIT-001', name: 'Suture Kit', on_hand: 25 }
    ];
    for (const it of items) {
      await pool.query(`INSERT INTO inventory_items (sku, name, on_hand, low_stock_threshold, lot_tracking) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, on_hand=EXCLUDED.on_hand, low_stock_threshold=EXCLUDED.low_stock_threshold, lot_tracking=EXCLUDED.lot_tracking`, [it.sku, it.name, it.on_hand, 10, false]);
    }
    console.log('Seeded inventory items');

    // Create a simple encounter/prescription/invoice if not already present
    // Only create encounter if none exists for patient with same complaint
    const physicianId = createdUsers['physician'].id;
    const existingEnc = await pool.query('SELECT id FROM encounters WHERE patient_id=$1 AND chief_complaint=$2 LIMIT 1', [patientIds[0], 'Cough and sore throat']);
    let encounterId = null;
    if (existingEnc.rows.length) {
      encounterId = existingEnc.rows[0].id;
      console.log('Encounter exists', encounterId);
    } else {
      const encounterRes = await pool.query('INSERT INTO encounters (patient_id, physician_id, chief_complaint, treatment, follow_up, diagnoses, state, clinic_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [patientIds[0], physicianId, 'Cough and sore throat', 'Supportive care, fluids, rest', 'Return in 7 days if worse', JSON.stringify([{ code: 'J06.9', label: 'URI' }]), 'finalized', clinicId]);
      encounterId = encounterRes.rows[0].id;
      console.log('Created encounter', encounterId);
    }

    const existingPres = await pool.query('SELECT id FROM prescriptions WHERE encounter_id=$1 LIMIT 1', [encounterId]);
    if (!existingPres.rows.length) {
      await pool.query('INSERT INTO prescriptions (encounter_id, patient_id, prescriber_id, drug_name, dose, route, quantity, instructions, state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [encounterId, patientIds[0], physicianId, 'Amoxicillin', '500 mg', 'oral', 21, 'Take one tablet three times daily for 7 days', 'dispensed']);
      console.log('Created prescription');
    }

    const existingInv = await pool.query('SELECT id FROM invoices WHERE patient_id=$1 LIMIT 1', [patientIds[1]]);
    if (!existingInv.rows.length) {
      await pool.query('INSERT INTO invoices (patient_id, lines, subtotal, plan_discount, coupon_discount, threshold_discount, total, state, clinic_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [patientIds[1], JSON.stringify([{ description: 'Office visit', amount: 120 }]), 120, 0, 0, 0, 120, 'unpaid', clinicId]);
      console.log('Created invoice');
    }

    // Insert audit events only if not present
    const clinicAudit = await pool.query('SELECT id FROM audit_events WHERE entity_type=$1 AND entity_id=$2 AND action=$3 LIMIT 1', ['clinic', clinicId, 'create']);
    if (!clinicAudit.rows.length) {
      await pool.query('INSERT INTO audit_events (entity_type, entity_id, action, actor_id, actor_role, event_data, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7)', ['clinic', clinicId, 'create', adminId, 'admin', JSON.stringify({ name: clinicName }), JSON.stringify({ name: clinicName })]);
    }
    for (const r of roles) {
      const u = createdUsers[r];
      const ua = await pool.query('SELECT id FROM audit_events WHERE entity_type=$1 AND entity_id=$2 AND action=$3 LIMIT 1', ['user', u.id, 'create']);
      if (!ua.rows.length) {
        await pool.query('INSERT INTO audit_events (entity_type, entity_id, action, actor_id, actor_role, event_data, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7)', ['user', u.id, 'create', adminId, 'admin', JSON.stringify({ username: u.username, role: u.role }), JSON.stringify({ username: u.username, role: u.role })]);
      }
    }

    console.log('Seeding complete. Default password for seeded users:', password);
    return { clinicId, createdUsers };
  } catch (err) {
    console.error('Seed failed', err);
    throw err;
  }
}

module.exports = { run };
