const assert = require('assert');
const http = require('http');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = { hostname: 'localhost', port: 3000, path, method, headers: { 'content-type': 'application/json' } };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function makeAuthedReq(token) {
  return (method, path, body) => new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function registerAndLogin(username, role) {
  const password = 'StrongPass123';
  const register = await req('POST', '/api/auth/register', { username, password, role });
  assert.equal(register.status, 201);
  const login = await req('POST', '/api/auth/login', { username, password });
  assert.equal(login.status, 200);
  return login.body.token;
}

(async () => {
  const health = await req('GET', '/health');
  assert.equal(health.status, 200);

  const suffix = Date.now();
  const physicianToken = await registerAndLogin(`doc_${suffix}`, 'physician');
  const billingToken = await registerAndLogin(`billing_${suffix}`, 'billing');
  const adminToken = await registerAndLogin(`admin_${suffix}`, 'admin');
  const pharmacistToken = await registerAndLogin(`pharm_${suffix}`, 'pharmacist');

  const physicianReq = makeAuthedReq(physicianToken);
  const billingReq = makeAuthedReq(billingToken);
  const adminReq = makeAuthedReq(adminToken);
  const pharmacistReq = makeAuthedReq(pharmacistToken);

  const patient = await physicianReq('POST', '/api/patients', {
    name: 'Test Patient',
    ssn: '123-45-6789',
    allergies: [{ drug: 'amoxicillin', severity: 'high' }],
  });
  assert.equal(patient.status, 201);

  const encounter = await physicianReq('POST', '/api/encounters', {
    patientId: patient.body.id,
    chiefComplaint: 'Fever',
    treatment: 'Rest',
    followUp: '7 days',
    diagnoses: [{ code: 'J06.9' }],
  });
  assert.equal(encounter.status, 201);

  const sign = await physicianReq('POST', `/api/encounters/${encounter.body.id}/sign`, { expectedVersion: 1 });
  assert.equal(sign.status, 200);

  const hardStop = await physicianReq('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
  });
  assert.equal(hardStop.status, 409);

  const overrideOk = await physicianReq('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
    overrideReason: 'Benefit outweighs risk',
    reauthPassword: 'StrongPass123',
  });
  assert.equal(overrideOk.status, 201);

  const rxQueue = await pharmacistReq('GET', '/api/pharmacy/queue');
  assert.equal(rxQueue.status, 200);
  assert.ok(Array.isArray(rxQueue.body));
  const rxId = overrideOk.body.id;

  const approve = await pharmacistReq('POST', `/api/pharmacy/${rxId}/action`, { action: 'approve', expectedVersion: 1 });
  assert.equal(approve.status, 200);
  const dispense = await pharmacistReq('POST', `/api/pharmacy/${rxId}/action`, { action: 'dispense', expectedVersion: 2 });
  assert.equal(dispense.status, 200);
  const voidAfterDispense = await pharmacistReq('POST', `/api/pharmacy/${rxId}/action`, { action: 'void', reason: 'late' });
  assert.equal(voidAfterDispense.status, 400);

  const deniedBillingAction = await physicianReq('POST', '/api/billing/price', {
    lines: [{ quantity: 1, unitPrice: 100 }],
    planPercent: 10,
  });
  assert.equal(deniedBillingAction.status, 403);

  const bill = await billingReq('POST', '/api/billing/price', {
    lines: [{ quantity: 2, unitPrice: 120 }],
    planPercent: 10,
    couponAmount: 20,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(bill.status, 200);
  assert.equal(bill.body.total, 196);

  const shipping = await billingReq('GET', '/api/shipping/templates');
  assert.equal(shipping.status, 200);
  assert.ok(shipping.body.length >= 1);

  const invoice = await billingReq('POST', '/api/invoices', {
    patientId: patient.body.id,
    lines: [{ quantity: 2, unitPrice: 120 }],
    planPercent: 10,
    couponAmount: 20,
    thresholdRule: { threshold: 200, off: 25 },
  });
  assert.equal(invoice.status, 201);
  const paid = await billingReq('POST', `/api/invoices/${invoice.body.id}/payment`, {
    expectedVersion: invoice.body.version,
    reference: `cash-${suffix}`,
  });
  assert.equal(paid.status, 200);

  const credReject = await adminReq('POST', '/api/credentialing/import', {
    rows: [{ entityType: 'candidate', fullName: 'Short License', licenseExpiry: new Date(Date.now() + 5 * 86400000).toISOString() }],
  });
  assert.equal(credReject.status, 200);
  assert.equal(credReject.body.rejected, 1);

  const crawler = await adminReq('POST', '/api/crawler/run', { sourceName: 'icd-update', priority: 1 });
  assert.equal(crawler.status, 201);
  const retried = await adminReq('POST', `/api/crawler/${crawler.body.id}/retry`, {});
  assert.equal(retried.status, 200);
  assert.equal(retried.body.state, 'retry_wait');

  const modelA = await adminReq('POST', '/api/models/register', {
    modelType: 'visit_volume',
    versionTag: `v1-${suffix}`,
    algorithm: 'baseline_regression',
    baselineScore: 0.7,
    currentScore: 0.8,
    driftScore: 0.1,
    deploy: true,
  });
  assert.equal(modelA.status, 201);
  const modelB = await adminReq('POST', '/api/models/register', {
    modelType: 'visit_volume',
    versionTag: `v2-${suffix}`,
    algorithm: 'baseline_regression',
    baselineScore: 0.7,
    currentScore: 0.85,
    driftScore: 0.08,
    deploy: true,
  });
  assert.equal(modelB.status, 201);
  const rollback = await adminReq('POST', `/api/models/${modelB.body.id}/rollback`, {});
  assert.equal(rollback.status, 200);

  const restoreDrill = await adminReq('POST', '/api/admin/backups/restore-drill', {
    status: 'completed',
    notes: 'monthly drill evidence',
  });
  assert.equal(restoreDrill.status, 201);

  const syncQueued = await adminReq('POST', '/api/sync/enqueue', {
    entityType: 'encounter',
    operation: 'upsert',
    payload: { id: encounter.body.id, state: 'signed' },
  });
  assert.equal(syncQueued.status, 201);
  const syncStatus = await adminReq('GET', '/api/sync/status');
  assert.equal(syncStatus.status, 200);

  console.log('API acceptance tests passed');
})();
