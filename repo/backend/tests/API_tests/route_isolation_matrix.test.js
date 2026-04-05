const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../src/db');
const { hashPassword } = require('../../src/services/security');
const { withToken } = require('./helper');

/**
 * Table-driven route isolation matrix test.
 *
 * Creates two clinics with users and seed data, then systematically
 * verifies that every data-bearing route enforces clinic-level isolation.
 */

async function createUserInClinic({ username, password, role, clinicId }) {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    'INSERT INTO users(username,password_hash,role,clinic_id) VALUES($1,$2,$3,$4) RETURNING id,username,role,clinic_id',
    [username, passwordHash, role, clinicId],
  );
  return result.rows[0];
}

async function runRouteIsolationMatrix(api, sessions) {
  const suffix = Date.now();
  const password = 'StrongPass123!';

  // Create two isolated clinics
  const clinic1Id = uuidv4();
  const clinic2Id = uuidv4();
  await pool.query(
    'INSERT INTO clinics(id,name,address,contact_info,type) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [clinic1Id, `Matrix Clinic A ${suffix}`, 'Addr A', JSON.stringify({}), 'clinical'],
  );
  await pool.query(
    'INSERT INTO clinics(id,name,address,contact_info,type) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [clinic2Id, `Matrix Clinic B ${suffix}`, 'Addr B', JSON.stringify({}), 'clinical'],
  );

  // Create users in each clinic
  const userA = await createUserInClinic({ username: `matrix_doc_a_${suffix}`, password, role: 'physician', clinicId: clinic1Id });
  const userB = await createUserInClinic({ username: `matrix_doc_b_${suffix}`, password, role: 'physician', clinicId: clinic2Id });
  const pharmacistB = await createUserInClinic({ username: `matrix_pharm_b_${suffix}`, password, role: 'pharmacist', clinicId: clinic2Id });
  const billingB = await createUserInClinic({ username: `matrix_bill_b_${suffix}`, password, role: 'billing', clinicId: clinic2Id });

  // Login all users
  const loginA = await api.post('/api/auth/login').send({ username: userA.username, password });
  assert.equal(loginA.status, 200);
  const docA = withToken(api, loginA.body.token);

  const loginB = await api.post('/api/auth/login').send({ username: userB.username, password });
  assert.equal(loginB.status, 200);
  const docB = withToken(api, loginB.body.token);

  const loginPharmB = await api.post('/api/auth/login').send({ username: pharmacistB.username, password });
  assert.equal(loginPharmB.status, 200);
  const pharmB = withToken(api, loginPharmB.body.token);

  const loginBillB = await api.post('/api/auth/login').send({ username: billingB.username, password });
  assert.equal(loginBillB.status, 200);
  const billB = withToken(api, loginBillB.body.token);

  // === Seed data in Clinic A ===
  const patientA = await docA.post('/api/patients').send({
    name: `Matrix Patient A ${suffix}`,
    ssn: '100-00-0001',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patientA.status, 201);

  const encounterA = await docA.post('/api/encounters').send({
    patientId: patientA.body.id,
    chiefComplaint: 'Matrix test',
    treatment: 'rest',
    followUp: '2 days',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounterA.status, 201);

  const rxA = await docA.post('/api/prescriptions').send({
    encounterId: encounterA.body.id,
    patientId: patientA.body.id,
    drugName: 'ibuprofen',
    dose: '400mg',
    route: 'oral',
    quantity: 10,
    instructions: 'TID',
  });
  assert.equal(rxA.status, 201);

  // === Route isolation matrix: Clinic B users cannot access Clinic A data ===
  const matrix = [
    // [description, requestFn, expectedStatuses]
    ['GET /api/patients/:id (cross-clinic)', () => docB.get(`/api/patients/${patientA.body.id}`), [403, 404]],
    ['PUT /api/patients/:id (cross-clinic)', () => docB.put(`/api/patients/${patientA.body.id}`).send({ name: 'Hacked' }), [403, 404]],
    ['DELETE /api/patients/:id (cross-clinic)', () => docB.delete(`/api/patients/${patientA.body.id}`).send({}), [403, 404]],
    ['GET /api/encounters/:id (cross-clinic)', () => docB.get(`/api/encounters/${encounterA.body.id}`), [403, 404]],
    ['POST /api/encounters/:id/sign (cross-clinic)', () => docB.post(`/api/encounters/${encounterA.body.id}/sign`).send({ expectedVersion: encounterA.body.version }), [403, 404]],
    ['POST /api/prescriptions (cross-clinic encounter)', () => docB.post('/api/prescriptions').send({
      encounterId: encounterA.body.id, patientId: patientA.body.id, drugName: 'aspirin', dose: '100mg', route: 'oral', quantity: 5, instructions: 'QD',
    }), [400, 403, 404]],
    ['POST /api/pharmacy/:id/action approve (cross-clinic)', () => pharmB.post(`/api/pharmacy/${rxA.body.id}/action`).send({ action: 'approve', expectedVersion: rxA.body.version }), [403, 404]],
    ['POST /api/pharmacy/:id/action void (cross-clinic)', () => pharmB.post(`/api/pharmacy/${rxA.body.id}/action`).send({ action: 'void', expectedVersion: rxA.body.version, reason: 'test' }), [403, 404]],
    ['GET /api/pharmacy/:id/movements (cross-clinic)', () => pharmB.get(`/api/pharmacy/${rxA.body.id}/movements`), [403, 404]],
  ];

  for (const [desc, requestFn, expectedStatuses] of matrix) {
    const res = await requestFn();
    assert.ok(
      expectedStatuses.includes(res.status),
      `${desc}: expected one of [${expectedStatuses}] but got ${res.status}`,
    );
  }

  // Verify Clinic B patient list does NOT include Clinic A patients
  const bPatients = await docB.get('/api/patients');
  assert.equal(bPatients.status, 200);
  const found = (bPatients.body || []).find((p) => p.id === patientA.body.id);
  assert.equal(found, undefined, 'Clinic B should not see Clinic A patients in list');

  // Verify Clinic B encounters list does NOT include Clinic A encounters
  const bEncounters = await docB.get('/api/encounters');
  assert.equal(bEncounters.status, 200);
  const foundEnc = (bEncounters.body || []).find((e) => e.id === encounterA.body.id);
  assert.equal(foundEnc, undefined, 'Clinic B should not see Clinic A encounters in list');

  // Verify Clinic B pharmacy queue does NOT include Clinic A prescriptions
  const bQueue = await pharmB.get('/api/pharmacy/queue');
  assert.equal(bQueue.status, 200);
  const foundRx = (bQueue.body || []).find((r) => r.id === rxA.body.id);
  assert.equal(foundRx, undefined, 'Clinic B should not see Clinic A prescriptions in queue');

  // Verify Clinic B billing cannot create invoice for Clinic A patient
  const crossInvoice = await billB.post('/api/invoices').send({
    patientId: patientA.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 50 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 100, off: 0 },
  });
  assert.ok([403, 404].includes(crossInvoice.status), `Cross-clinic invoice should be denied, got ${crossInvoice.status}`);
}

module.exports = { runRouteIsolationMatrix };
