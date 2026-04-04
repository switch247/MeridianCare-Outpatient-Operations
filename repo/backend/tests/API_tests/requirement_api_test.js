const assert = require('assert');
const { withToken } = require('./helper');

async function runRequirementApi(api, sessions) {
  const physician = withToken(api, sessions.physician.token);
  const pharmacist = withToken(api, sessions.pharmacist.token);
  const billing = withToken(api, sessions.billing.token);
  const admin = withToken(api, sessions.admin.token);
  const auditor = withToken(api, sessions.auditor.token);

  const suffix = Date.now();

  const patient = await physician.post('/api/patients').send({
    name: `Req Patient ${suffix}`,
    ssn: '999-88-7777',
    allergies: [{ drug: 'amoxicillin', severity: 'high' }],
    contraindications: [{ drug: 'warfarin', severity: 'high' }],
  });
  assert.equal(patient.status, 201);

  const patientList = await physician.get('/api/patients');
  assert.equal(patientList.status, 200);
  assert.ok((patientList.body || []).some((p) => p.id === patient.body.id));

  const auditorPatientList = await auditor.get('/api/patients');
  assert.equal(auditorPatientList.status, 200);
  const masked = (auditorPatientList.body || []).find((p) => p.id === patient.body.id);
  if (masked) assert.notEqual(masked.name, patient.body.name);

  const icd = await physician.get('/api/icd?q=J06');
  assert.equal(icd.status, 200);
  assert.ok(Array.isArray(icd.body));

  const encounter = await physician.post('/api/encounters').send({
    patientId: patient.body.id,
    chiefComplaint: 'Cough',
    treatment: 'Hydration',
    followUp: 'After 3 days',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounter.status, 201);

  const signConflict = await physician
    .post(`/api/encounters/${encounter.body.id}/sign`)
    .send({ expectedVersion: 999 });
  assert.equal(signConflict.status, 409);

  const signOk = await physician
    .post(`/api/encounters/${encounter.body.id}/sign`)
    .send({ expectedVersion: encounter.body.version });
  assert.equal(signOk.status, 200);

  const rxHardStop = await physician.post('/api/prescriptions').send({
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 20,
    instructions: 'BID',
  });
  assert.equal(rxHardStop.status, 409);

  const rxOverride = await physician.post('/api/prescriptions').send({
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 20,
    instructions: 'BID',
    overrideReason: 'clinical necessity',
    reauthPassword: process.env.SEED_PASSWORD || 'Password!123',
  });
  assert.equal(rxOverride.status, 201);

  const invItem = await pharmacist.post('/api/inventory/items').send({
    sku: `REQ-RX-${suffix}`,
    name: 'amoxicillin',
    lowStockThreshold: 3,
  });
  assert.equal(invItem.status, 201);

  const received = await pharmacist.post('/api/inventory/movements').send({
    itemId: invItem.body.id,
    movementType: 'receive',
    quantity: 25,
  });
  assert.equal(received.status, 200);

  const approved = await pharmacist
    .post(`/api/pharmacy/${rxOverride.body.id}/action`)
    .send({ action: 'approve', expectedVersion: rxOverride.body.version });
  assert.equal(approved.status, 200);

  const dispensed = await pharmacist
    .post(`/api/pharmacy/${rxOverride.body.id}/action`)
    .send({
      action: 'dispense',
      expectedVersion: approved.body.version,
      inventoryItemId: invItem.body.id,
      dispenseQuantity: 20,
    });
  assert.equal(dispensed.status, 200);
  assert.equal(dispensed.body.state, 'dispensed');

  const billingPrice = await billing.post('/api/billing/price').send({
    lines: [{ chargeType: 'visit_code', quantity: 2, unitPrice: 120 }],
    planPercent: 10,
    couponAmount: 20,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(billingPrice.status, 200);
  assert.equal(billingPrice.body.total, 196);

  const shipping = await billing.get('/api/shipping/templates');
  assert.equal(shipping.status, 200);
  assert.ok((shipping.body || []).length > 0);

  const invoice = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 100 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(invoice.status, 201);

  const paid = await billing.post(`/api/invoices/${invoice.body.id}/payment`).send({
    expectedVersion: invoice.body.version,
    tenderType: 'cash',
    reference: `req-cash-${suffix}`,
  });
  assert.equal(paid.status, 200);

  const credentialingImport = await admin.post('/api/credentialing/import').send({
    rows: [
      { entityType: 'candidate', fullName: 'Good Candidate', licenseNumber: 'L2', licenseExpiry: new Date(Date.now() + 40 * 86400000).toISOString() },
      { entityType: 'candidate', fullName: 'Bad Candidate', licenseNumber: 'L3', licenseExpiry: new Date(Date.now() + 2 * 86400000).toISOString() },
    ],
  });
  assert.equal(credentialingImport.status, 200);
  assert.equal(credentialingImport.body.accepted, 1);
  assert.equal(credentialingImport.body.rejected, 1);

  const crawler = await admin.post('/api/crawler/run').send({ sourceName: 'icd', priority: 1 });
  assert.equal(crawler.status, 201);

  const queue = await admin.get('/api/crawler/queue');
  assert.equal(queue.status, 200);
  assert.ok(Array.isArray(queue.body.items));
  assert.ok(typeof queue.body.total === 'number');

  const model1 = await admin.post('/api/models/register').send({
    modelType: 'visit_volume',
    versionTag: `v1-${suffix}`,
    algorithm: 'reg',
    deploy: true,
  });
  assert.equal(model1.status, 201);

  const model2 = await admin.post('/api/models/register').send({
    modelType: 'visit_volume',
    versionTag: `v2-${suffix}`,
    algorithm: 'reg',
    deploy: true,
  });
  assert.equal(model2.status, 201);

  const drift = await admin.get('/api/models/drift');
  assert.equal(drift.status, 200);
  assert.ok(Array.isArray(drift.body.items));

  const rollback = await admin.post(`/api/models/${model2.body.id}/rollback`).send({});
  assert.equal(rollback.status, 200);
}

module.exports = { runRequirementApi };
