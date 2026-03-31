const assert = require('assert');
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createUser(username, role) {
  const password = 'StrongPass123';
  const adminLogin = await request('POST', '/api/auth/login', { username: 'admin@local', password: 'Password!123' });
  assert.equal(adminLogin.status, 200);
  const reg = await request('POST', '/api/admin/users', { username, password, role }, adminLogin.body.token);
  assert.equal(reg.status, 201);
  const login = await request('POST', '/api/auth/login', { username, password });
  assert.equal(login.status, 200);
  return { token: login.body.token };
}

(async () => {
  const suffix = Date.now();
  const physician = await createUser(`p4_doc_${suffix}`, 'physician');
  const billing = await createUser(`p4_bill_${suffix}`, 'billing');

  const patient = await request('POST', '/api/patients', {
    name: 'Billing Patient',
    ssn: '123-11-1111',
  }, physician.token);
  assert.equal(patient.status, 201);

  const invalidZipPrice = await request('POST', '/api/billing/price', {
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 100 }],
    shipping: { deliveryType: 'home_delivery', zone: 'US-EAST', zip: 'BADZIP', city: 'Austin', state: 'TX', addressLine1: '1 Main' },
  }, billing.token);
  assert.equal(invalidZipPrice.status, 400);

  const priced = await request('POST', '/api/billing/price', {
    lines: [
      { chargeType: 'visit_code', quantity: 1, unitPrice: 100 },
      { chargeType: 'dispense_fee', quantity: 1, unitPrice: 20 },
    ],
    planPercent: 10,
    couponAmount: 5,
    thresholdRule: { threshold: 100, off: 10 },
    shipping: { deliveryType: 'home_delivery', zone: 'US-EAST', zip: '73301', city: 'Austin', state: 'TX', addressLine1: '1 Main' },
  }, billing.token);
  assert.equal(priced.status, 200);
  assert.ok(priced.body.total >= 0);

  const created = await request('POST', '/api/invoices', {
    patientId: patient.body.id,
    lines: [
      { chargeType: 'visit_code', quantity: 1, unitPrice: 100 },
      { chargeType: 'retail', quantity: 2, unitPrice: 30 },
    ],
    planPercent: 10,
    couponAmount: 0,
    thresholdRule: { threshold: 140, off: 15 },
    shipping: { deliveryType: 'home_delivery', zone: 'US-EAST', zip: '73301', city: 'Austin', state: 'TX', addressLine1: '1 Main', carrier: 'LocalCarrier' },
  }, billing.token);
  assert.equal(created.status, 201);
  assert.equal(created.body.state, 'unpaid');

  const listed = await request('GET', '/api/invoices', null, billing.token);
  assert.equal(listed.status, 200);
  assert.ok((listed.body || []).some((i) => i.id === created.body.id));

  const payNoTender = await request('POST', `/api/invoices/${created.body.id}/payment`, {
    expectedVersion: created.body.version,
    reference: 'x',
  }, billing.token);
  assert.equal(payNoTender.status, 400);

  const paid = await request('POST', `/api/invoices/${created.body.id}/payment`, {
    expectedVersion: created.body.version,
    tenderType: 'cash',
    reference: 'frontdesk-cash-1',
  }, billing.token);
  assert.equal(paid.status, 200);
  assert.equal(paid.body.state, 'paid');

  const cancelPaid = await request('POST', `/api/invoices/${created.body.id}/cancel`, {
    expectedVersion: paid.body.version,
  }, billing.token);
  assert.equal(cancelPaid.status, 400);

  const created2 = await request('POST', '/api/invoices', {
    patientId: patient.body.id,
    lines: [{ chargeType: 'procedure', quantity: 1, unitPrice: 80 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 200, off: 10 },
  }, billing.token);
  assert.equal(created2.status, 201);

  const canceled = await request('POST', `/api/invoices/${created2.body.id}/cancel`, {
    expectedVersion: created2.body.version,
  }, billing.token);
  assert.equal(canceled.status, 200);
  assert.equal(canceled.body.state, 'cancelled');

  console.log('Phase 4 billing E2E passed');
})();
