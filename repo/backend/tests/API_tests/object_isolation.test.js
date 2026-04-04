const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../../src/db');
const { withToken } = require('./helper');

async function runObjectIsolation(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const physician = withToken(api, sessions.physician.token);

  const otherClinicId = uuidv4();
  await pool.query(
    'INSERT INTO clinics(id,name,address,contact_info,type) VALUES($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
    [otherClinicId, `Isolation Clinic ${Date.now()}`, 'Other address', JSON.stringify({}), 'clinical'],
  );

  const outsiderUsername = `iso_doc_${Date.now()}`;
  const outsiderPassword = 'StrongPass123';
  const createdOutsider = await admin.post('/api/admin/users').send({
    username: outsiderUsername,
    password: outsiderPassword,
    role: 'physician',
    clinicId: otherClinicId,
  });
  assert.equal(createdOutsider.status, 201);

  const outsiderLogin = await api.post('/api/auth/login').send({
    username: outsiderUsername,
    password: outsiderPassword,
  });
  assert.equal(outsiderLogin.status, 200);
  const outsider = withToken(api, outsiderLogin.body.token);

  const patient = await physician.post('/api/patients').send({
    name: `Isolation Patient ${Date.now()}`,
    ssn: '111-22-3333',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patient.status, 201);

  const outsiderUpdate = await outsider.put(`/api/patients/${patient.body.id}`).send({ name: 'Hacked Name' });
  assert.ok([403, 404].includes(outsiderUpdate.status));

  const outsiderView = await outsider.get(`/api/patients/${patient.body.id}`);
  assert.ok([403, 404].includes(outsiderView.status));

  const outsiderDelete = await outsider.delete(`/api/patients/${patient.body.id}`).send({});
  assert.ok([403, 404].includes(outsiderDelete.status));

  const encounter = await physician.post('/api/encounters').send({
    patientId: patient.body.id,
    chiefComplaint: 'Isolation test',
    treatment: 'rest',
    followUp: '2 days',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounter.status, 201);

  const signed = await physician.post(`/api/encounters/${encounter.body.id}/sign`).send({
    expectedVersion: encounter.body.version,
  });
  assert.equal(signed.status, 200);

  const rx = await physician.post('/api/prescriptions').send({
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'cefuroxime',
    dose: '250mg',
    route: 'oral',
    quantity: 4,
    instructions: 'BID',
  });
  assert.equal(rx.status, 201);

  const outsiderApprove = await outsider.post(`/api/pharmacy/${rx.body.id}/action`).send({
    action: 'approve',
    expectedVersion: rx.body.version,
  });
  assert.ok([403, 404].includes(outsiderApprove.status));
}

module.exports = { runObjectIsolation };
