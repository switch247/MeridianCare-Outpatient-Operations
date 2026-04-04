const assert = require('assert');
const { withToken } = require('./helper');

async function runApiSmoke(api, sessions) {
  const physician = withToken(api, sessions.physician.token);
  const pharmacist = withToken(api, sessions.pharmacist.token);
  const billing = withToken(api, sessions.billing.token);
  const admin = withToken(api, sessions.admin.token);

  const health = await api.get('/health');
  assert.equal(health.status, 200);

  // middleware claims extraction sanity: no token rejected, token accepted
  const meUnauthorized = await api.get('/api/auth/me');
  assert.equal(meUnauthorized.status, 401);
  const meAuthorized = await admin.get('/api/auth/me');
  assert.equal(meAuthorized.status, 200);
  assert.equal(meAuthorized.body.username, 'admin@local');
  assert.equal(meAuthorized.body.role, 'admin');

  const suffix = Date.now();
  const patient = await physician.post('/api/patients').send({
    name: `Smoke Patient ${suffix}`,
    ssn: '123-45-6789',
    allergies: [{ drug: 'amoxicillin', severity: 'high' }],
    contraindications: [],
  });
  assert.equal(patient.status, 201);

  const encounter = await physician.post('/api/encounters').send({
    patientId: patient.body.id,
    chiefComplaint: 'Fever',
    treatment: 'Rest',
    followUp: '7 days',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounter.status, 201);

  const signed = await physician
    .post(`/api/encounters/${encounter.body.id}/sign`)
    .send({ expectedVersion: encounter.body.version });
  assert.equal(signed.status, 200);

  const hardStop = await physician.post('/api/prescriptions').send({
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
  });
  assert.equal(hardStop.status, 409);

  const override = await physician.post('/api/prescriptions').send({
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
    overrideReason: 'Clinical necessity',
    reauthPassword: process.env.SEED_PASSWORD || 'Password!123',
  });
  assert.equal(override.status, 201);

  const rxItem = await pharmacist.post('/api/inventory/items').send({
    sku: `SM-RX-${suffix}`,
    name: 'amoxicillin',
    lowStockThreshold: 3,
  });
  assert.equal(rxItem.status, 201);

  const stockIn = await pharmacist.post('/api/inventory/movements').send({
    itemId: rxItem.body.id,
    movementType: 'receive',
    quantity: 20,
  });
  assert.equal(stockIn.status, 200);

  const approved = await pharmacist
    .post(`/api/pharmacy/${override.body.id}/action`)
    .send({ action: 'approve', expectedVersion: override.body.version });
  assert.equal(approved.status, 200);

  const dispensed = await pharmacist
    .post(`/api/pharmacy/${override.body.id}/action`)
    .send({
      action: 'dispense',
      expectedVersion: approved.body.version,
      inventoryItemId: rxItem.body.id,
      dispenseQuantity: 5,
    });
  assert.equal(dispensed.status, 200);

  const price = await billing.post('/api/billing/price').send({
    lines: [{ chargeType: 'visit_code', quantity: 2, unitPrice: 120 }],
    planPercent: 10,
    couponAmount: 20,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(price.status, 200);
  assert.equal(price.body.total, 196);

  const invoice = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 2, unitPrice: 120 }],
    planPercent: 10,
    couponAmount: 20,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(invoice.status, 201);

  const paid = await billing.post(`/api/invoices/${invoice.body.id}/payment`).send({
    expectedVersion: invoice.body.version,
    tenderType: 'cash',
    reference: `cash-${suffix}`,
  });
  assert.equal(paid.status, 200);

  const credForbidden = await physician.post('/api/credentialing/import').send({
    rows: [{ entityType: 'candidate', fullName: 'No Access', licenseExpiry: new Date(Date.now() + 60 * 86400000).toISOString() }],
  });
  assert.equal(credForbidden.status, 403);

  const credReject = await admin.post('/api/credentialing/import').send({
    rows: [{ entityType: 'candidate', fullName: 'Short License', licenseExpiry: new Date(Date.now() + 5 * 86400000).toISOString() }],
  });
  assert.equal(credReject.status, 200);
  assert.equal(credReject.body.rejected, 1);
}

module.exports = { runApiSmoke };
