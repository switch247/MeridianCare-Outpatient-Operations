const assert = require('assert');
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const options = { hostname: 'localhost', port: 3000, path, method, headers };
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
  const created = await req('POST', '/api/auth/register', { username, password, role });
  assert.equal(created.status, 201);
  const login = await req('POST', '/api/auth/login', { username, password });
  assert.equal(login.status, 200);
  return { token: login.body.token, password };
}

(async () => {
  const suffix = Date.now();
  const physician = await registerAndLogin(`p3_doc_${suffix}`, 'physician');
  const pharmacist = await registerAndLogin(`p3_pharm_${suffix}`, 'pharmacist');

  const patient = await req('POST', '/api/patients', {
    name: 'Phase3 Patient',
    ssn: '123-45-6789',
    allergies: [],
    contraindications: [],
  }, physician.token);
  assert.equal(patient.status, 201);

  const encounter = await req('POST', '/api/encounters', {
    patientId: patient.body.id,
    chiefComplaint: 'Cough',
    treatment: 'Hydration',
    followUp: '3 days',
    diagnoses: [{ code: 'J06.9', label: 'URI' }],
  }, physician.token);
  assert.equal(encounter.status, 201);

  const signed = await req('POST', `/api/encounters/${encounter.body.id}/sign`, { expectedVersion: encounter.body.version }, physician.token);
  assert.equal(signed.status, 200);

  const rx = await req('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'cefuroxime',
    dose: '250mg',
    route: 'oral',
    quantity: 5,
    instructions: 'twice daily',
  }, physician.token);
  assert.equal(rx.status, 201);
  assert.equal(rx.body.state, 'pending');

  const item = await req('POST', '/api/inventory/items', {
    sku: `P3-${suffix}`,
    name: 'cefuroxime',
    lowStockThreshold: 2,
    lotTracking: true,
  }, pharmacist.token);
  assert.equal(item.status, 201);

  const receive = await req('POST', '/api/inventory/movements', {
    itemId: item.body.id,
    movementType: 'receive',
    quantity: 5,
    lot: 'LOT-001',
  }, pharmacist.token);
  assert.equal(receive.status, 200);

  const approved = await req('POST', `/api/pharmacy/${rx.body.id}/action`, {
    action: 'approve',
    expectedVersion: rx.body.version,
  }, pharmacist.token);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.state, 'approved');

  const dispense1 = req('POST', `/api/pharmacy/${rx.body.id}/action`, {
    action: 'dispense',
    expectedVersion: approved.body.version,
    inventoryItemId: item.body.id,
    dispenseQuantity: 4,
    lot: 'LOT-001',
  }, pharmacist.token);
  const dispense2 = req('POST', `/api/pharmacy/${rx.body.id}/action`, {
    action: 'dispense',
    expectedVersion: approved.body.version,
    inventoryItemId: item.body.id,
    dispenseQuantity: 4,
    lot: 'LOT-001',
  }, pharmacist.token);
  const [raceA, raceB] = await Promise.all([dispense1, dispense2]);
  const successCount = [raceA, raceB].filter((r) => r.status === 200).length;
  const failCount = [raceA, raceB].filter((r) => r.status !== 200).length;
  assert.equal(successCount, 1, 'exactly one concurrent dispense should succeed');
  assert.equal(failCount, 1, 'exactly one concurrent dispense should fail');

  const queue = await req('GET', '/api/pharmacy/queue', null, pharmacist.token);
  assert.equal(queue.status, 200);
  const queueRx = (queue.body || []).find((q) => q.id === rx.body.id);
  assert.ok(queueRx);
  assert.equal(queueRx.state, 'partially_dispensed');
  assert.equal(Number(queueRx.dispensed_quantity), 4);

  const movements = await req('GET', `/api/pharmacy/${rx.body.id}/movements`, null, pharmacist.token);
  assert.equal(movements.status, 200);
  const originalDispense = movements.body.find((m) => m.movement_type === 'dispense');
  assert.ok(originalDispense, 'dispense movement should exist');

  const returned = await req('POST', `/api/pharmacy/${rx.body.id}/return`, {
    originalMovementId: originalDispense.id,
    quantity: 1,
    reason: 'damaged package',
  }, pharmacist.token);
  assert.equal(returned.status, 200);
  assert.equal(returned.body.movement.movement_type, 'return');

  console.log('Phase 3 pharmacy E2E passed');
})();
