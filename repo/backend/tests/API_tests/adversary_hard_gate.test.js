const assert = require('assert');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../src/db');
const { hashPassword } = require('../../src/services/security');
const { decrypt } = require('../../src/utils/crypto');
const { env } = require('../../src/config');
const { withToken } = require('./helper');

async function createUserWithClinic({ username, password, role, clinicId }) {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    'INSERT INTO users(username,password_hash,role,clinic_id) VALUES($1,$2,$3,$4) RETURNING id,username,role,clinic_id',
    [username, passwordHash, role, clinicId],
  );
  return result.rows[0];
}

async function runAdversaryHardGate(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const physician = withToken(api, sessions.physician.token);
  const billing = withToken(api, sessions.billing.token);
  const auditor = withToken(api, sessions.auditor.token);

  // The "Homeless" user: valid role, no clinic scope.
  const homelessUsername = `homeless_auditor_${Date.now()}`;
  const homelessPassword = 'StrongPass123!';
  await createUserWithClinic({
    username: homelessUsername,
    password: homelessPassword,
    role: 'auditor',
    clinicId: null,
  });
  const homelessLogin = await api.post('/api/auth/login').send({
    username: homelessUsername,
    password: homelessPassword,
  });
  assert.equal(homelessLogin.status, 200);
  const homeless = withToken(api, homelessLogin.body.token);
  const homelessPatients = await homeless.get('/api/patients');
  assert.ok([200, 403].includes(homelessPatients.status));
  if (homelessPatients.status === 200) {
    assert.equal(Array.isArray(homelessPatients.body), true);
    assert.equal(homelessPatients.body.length, 0);
  }
  if (homelessPatients.status === 403) {
    assert.equal(homelessPatients.body.code, 403);
  }

  // The "Cross-Clinic" hack: clinic 2 user attempts to sign clinic 1 encounter.
  const clinic2Id = uuidv4();
  await pool.query(
    'INSERT INTO clinics(id,name,address,contact_info,type) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [clinic2Id, `Adversary Clinic ${Date.now()}`, 'Isolation Ave', JSON.stringify({}), 'clinical'],
  );
  const outsiderUsername = `cross_clinic_${Date.now()}`;
  const outsiderPassword = 'StrongPass123!';
  await createUserWithClinic({
    username: outsiderUsername,
    password: outsiderPassword,
    role: 'physician',
    clinicId: clinic2Id,
  });
  const outsiderLogin = await api.post('/api/auth/login').send({
    username: outsiderUsername,
    password: outsiderPassword,
  });
  assert.equal(outsiderLogin.status, 200);
  const outsider = withToken(api, outsiderLogin.body.token);

  const patient = await physician.post('/api/patients').send({
    name: `Cross Clinic Target ${Date.now()}`,
    ssn: '123-45-6789',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patient.status, 201);

  const encounter = await physician.post('/api/encounters').send({
    patientId: patient.body.id,
    chiefComplaint: 'Cross-clinic probe',
    treatment: 'rest',
    followUp: '48h',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounter.status, 201);

  const crossClinicSign = await outsider.post(`/api/encounters/${encounter.body.id}/sign`).send({
    expectedVersion: encounter.body.version,
  });
  assert.ok([403, 404].includes(crossClinicSign.status));

  // The "Mismatched" Rx: patient A + encounter of patient B must be rejected.
  const patientA = await physician.post('/api/patients').send({
    name: `Mismatch A ${Date.now()}`,
    ssn: '321-45-6789',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patientA.status, 201);

  const patientB = await physician.post('/api/patients').send({
    name: `Mismatch B ${Date.now()}`,
    ssn: '222-45-6789',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patientB.status, 201);

  const encounterB = await physician.post('/api/encounters').send({
    patientId: patientB.body.id,
    chiefComplaint: 'Mismatch encounter',
    treatment: 'supportive care',
    followUp: '72h',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounterB.status, 201);

  const mismatchedRx = await physician.post('/api/prescriptions').send({
    encounterId: encounterB.body.id,
    patientId: patientA.body.id,
    drugName: 'cefuroxime',
    dose: '250mg',
    route: 'oral',
    quantity: 4,
    instructions: 'BID',
  });
  assert.equal(mismatchedRx.status, 400);

  // PHI masking in non-clinical invoice and overview views.
  const phiPatient = await physician.post('/api/patients').send({
    name: `Visible Name ${Date.now()}`,
    ssn: '555-11-2222',
    allergies: [],
    contraindications: [],
  });
  assert.equal(phiPatient.status, 201);

  const invoice = await billing.post('/api/invoices').send({
    patientId: phiPatient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 100 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 1000, off: 0 },
  });
  assert.equal(invoice.status, 201);

  const billingInvoice = await billing.get(`/api/invoices/${invoice.body.id}`);
  assert.equal(billingInvoice.status, 200);
  assert.notEqual(billingInvoice.body.patient_name, phiPatient.body.name);
  assert.equal(String(billingInvoice.body.patient_name || '').includes('*'), true);

  const auditorOverview = await auditor.get('/api/overview');
  assert.equal(auditorOverview.status, 200);
  const invoiceEvent = (auditorOverview.body.recentOperations || []).find((evt) => evt.type === 'invoice' && evt.id === invoice.body.id);
  assert.equal(Boolean(invoiceEvent), true);
  assert.equal(String(invoiceEvent.summary || '').includes('*'), true);

  // The "Nightly Evidence": file must be encrypted pg_dump output, not JSON metadata.
  const backup = await admin.post('/api/admin/backup').send({});
  assert.equal(backup.status, 201);
  assert.equal(Boolean(backup.body.artifactPath), true);

  const artifactRaw = fs.readFileSync(backup.body.artifactPath, 'utf8');
  assert.equal(artifactRaw.trim().startsWith('{'), false);

  const decryptedDump = decrypt(artifactRaw, env.PHI_KEY);
  assert.ok(decryptedDump.includes('-- PostgreSQL database dump'));
}

module.exports = { runAdversaryHardGate };
