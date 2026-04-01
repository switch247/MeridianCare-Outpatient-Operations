const assert = require('assert');
const http = require('http');
const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const parsedBase = new URL(baseUrl);

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({ hostname: parsedBase.hostname, port: Number(parsedBase.port || 80), path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function createUser(username, role) {
  const password = 'StrongPass123';
  const adminLogin = await request('POST', '/api/auth/login', { username: 'admin@local', password: 'Password!123' });
  assert.equal(adminLogin.status, 200, 'login seeded admin');
  const provision = await request('POST', '/api/admin/users', { username, password, role }, adminLogin.body.token);
  assert.equal(provision.status, 201, `provision ${role}`);
  const l = await request('POST', '/api/auth/login', { username, password });
  assert.equal(l.status, 200, `login ${role}`);
  return { token: l.body.token, password };
}

(async () => {
  const suffix = Date.now();
  const physician = await createUser(`r_doc_${suffix}`, 'physician');
  const pharmacist = await createUser(`r_pharm_${suffix}`, 'pharmacist');
  const billing = await createUser(`r_bill_${suffix}`, 'billing');
  const admin = await createUser(`r_admin_${suffix}`, 'admin');
  const auditor = await createUser(`r_audit_${suffix}`, 'auditor');

  const badPassword = await request('POST', '/api/auth/register', { username: `bad_${suffix}`, password: 'short', role: 'physician' });
  assert.equal(badPassword.status, 403);
  const escalate = await request('POST', '/api/auth/register', { username: `escalate_${suffix}`, password: 'StrongPass123', role: 'admin' });
  assert.equal(escalate.status, 403);

  const patient = await request('POST', '/api/patients', {
    name: 'Req Test Patient',
    ssn: '999-88-7777',
    allergies: [{ drug: 'amoxicillin', severity: 'high' }],
    contraindications: [{ drug: 'warfarin', severity: 'high' }],
  }, physician.token);
  assert.equal(patient.status, 201);
  const physicianPatientView = await request('GET', '/api/patients', null, physician.token);
  assert.equal(physicianPatientView.status, 200);
  const physicianTarget = (physicianPatientView.body || []).find((p) => p.id === patient.body.id);
  if (physicianTarget) {
    assert.equal(physicianTarget.name, 'Req Test Patient');
  }
  const maskedPatientList = await request('GET', '/api/patients', null, auditor.token);
  assert.equal(maskedPatientList.status, 200);
  const maskedTarget = (maskedPatientList.body || []).find((p) => p.id === patient.body.id);
  if (maskedTarget) {
    assert.notEqual(maskedTarget.name, 'Req Test Patient');
  }

  const icd = await request('GET', '/api/icd?q=J06', null, physician.token);
  assert.equal(icd.status, 200);
  assert.ok(Array.isArray(icd.body));

  const encounter = await request('POST', '/api/encounters', {
    patientId: patient.body.id,
    chiefComplaint: 'Cough',
    treatment: 'Hydration',
    followUp: 'After 3 days',
    diagnoses: [{ code: 'J06.9' }],
  }, physician.token);
  assert.equal(encounter.status, 201);

  const signConflict = await request('POST', `/api/encounters/${encounter.body.id}/sign`, { expectedVersion: 999 }, physician.token);
  assert.equal(signConflict.status, 409);
  const encounterList = await request('GET', `/api/encounters?patientId=${patient.body.id}`, null, physician.token);
  assert.equal(encounterList.status, 200);
  assert.ok(Array.isArray(encounterList.body));
  const sign = await request('POST', `/api/encounters/${encounter.body.id}/sign`, { expectedVersion: 1 }, physician.token);
  assert.equal(sign.status, 200);

  const hardStop = await request('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg', route: 'oral', quantity: 20, instructions: 'BID',
  }, physician.token);
  assert.equal(hardStop.status, 409);

  const override = await request('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'amoxicillin',
    dose: '500mg', route: 'oral', quantity: 20, instructions: 'BID',
    overrideReason: 'clinical necessity', reauthPassword: physician.password,
  }, physician.token);
  assert.equal(override.status, 201);

  const queue = await request('GET', '/api/pharmacy/queue', null, pharmacist.token);
  assert.equal(queue.status, 200);
  const rxId = override.body.id;

  const rxItem = await request('POST', '/api/inventory/items', { sku: `RX-${suffix}`, name: 'amoxicillin', lowStockThreshold: 3 }, pharmacist.token);
  assert.equal(rxItem.status, 201);
  const rxStock = await request('POST', '/api/inventory/movements', { itemId: rxItem.body.id, movementType: 'receive', quantity: 25 }, pharmacist.token);
  assert.equal(rxStock.status, 200);

  const approve = await request('POST', `/api/pharmacy/${rxId}/action`, { action: 'approve', expectedVersion: 1 }, pharmacist.token);
  assert.equal(approve.status, 200);
  const dispense = await request('POST', `/api/pharmacy/${rxId}/action`, { action: 'dispense', expectedVersion: 2, inventoryItemId: rxItem.body.id, dispenseQuantity: 20 }, pharmacist.token);
  assert.equal(dispense.status, 200);
  assert.equal(dispense.body.dispensed_quantity, 20);
  const voidAfter = await request('POST', `/api/pharmacy/${rxId}/action`, { action: 'void', reason: 'too late' }, pharmacist.token);
  assert.equal(voidAfter.status, 400);

  const badQty = await request('POST', '/api/billing/price', { lines: [{ quantity: 0, unitPrice: 50 }] }, billing.token);
  assert.equal(badQty.status, 400);
  const price = await request('POST', '/api/billing/price', {
    lines: [{ chargeType: 'visit_code', quantity: 2, unitPrice: 120 }],
    planPercent: 10, couponAmount: 20, thresholdRule: { threshold: 200, off: 25 },
  }, billing.token);
  assert.equal(price.status, 200);
  assert.equal(price.body.total, 196);

  const ship = await request('GET', '/api/shipping/templates', null, billing.token);
  assert.equal(ship.status, 200);
  assert.ok(ship.body.length > 0);

  const inv = await request('POST', '/api/invoices', {
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 100 }],
    planPercent: 0, couponAmount: 0, thresholdRule: { threshold: 200, off: 25 },
  }, billing.token);
  assert.equal(inv.status, 201);
  const invPayConflict = await request('POST', `/api/invoices/${inv.body.id}/payment`, { expectedVersion: 999, tenderType: 'cash', reference: 'cash' }, billing.token);
  assert.equal(invPayConflict.status, 409);
  const invPay = await request('POST', `/api/invoices/${inv.body.id}/payment`, { expectedVersion: inv.body.version, tenderType: 'cash', reference: 'cash-ok' }, billing.token);
  assert.equal(invPay.status, 200);

  const item = await request('POST', '/api/inventory/items', { sku: `SKU-${suffix}`, name: 'Bandage', lowStockThreshold: 3 }, pharmacist.token);
  assert.equal(item.status, 201);
  const recv = await request('POST', '/api/inventory/movements', { itemId: item.body.id, movementType: 'receive', quantity: 5 }, pharmacist.token);
  assert.equal(recv.status, 200);
  const dispInv = await request('POST', '/api/inventory/movements', { itemId: item.body.id, movementType: 'dispense', quantity: 6 }, pharmacist.token);
  assert.equal(dispInv.status, 400);

  const onboardBad = await request('POST', '/api/credentialing/onboard', {
    entityType: 'candidate', fullName: 'Too Soon', licenseNumber: 'L1', licenseExpiry: new Date(Date.now()+ 5*86400000).toISOString(),
  }, admin.token);
  assert.equal(onboardBad.status, 400);
  const importRows = await request('POST', '/api/credentialing/import', {
    rows: [
      { entityType: 'candidate', fullName: 'Good One', licenseNumber: 'L2', licenseExpiry: new Date(Date.now()+40*86400000).toISOString() },
      { entityType: 'candidate', fullName: 'Bad One', licenseNumber: 'L3', licenseExpiry: new Date(Date.now()+2*86400000).toISOString() },
    ],
  }, admin.token);
  assert.equal(importRows.status, 200);
  assert.equal(importRows.body.accepted, 1);
  assert.equal(importRows.body.rejected, 1);

  const crawl = await request('POST', '/api/crawler/run', { sourceName: 'icd', priority: 1 }, admin.token);
  assert.equal(crawl.status, 201);
  const retry = await request('POST', `/api/crawler/${crawl.body.id}/retry`, {}, admin.token);
  assert.equal(retry.status, 200);

  const model1 = await request('POST', '/api/models/register', { modelType: 'visit_volume', versionTag: `v1-${suffix}`, algorithm: 'reg', deploy: true }, admin.token);
  assert.equal(model1.status, 201);
  const model2 = await request('POST', '/api/models/register', { modelType: 'visit_volume', versionTag: `v2-${suffix}`, algorithm: 'reg', deploy: true }, admin.token);
  assert.equal(model2.status, 201);
  const rollback = await request('POST', `/api/models/${model2.body.id}/rollback`, {}, admin.token);
  assert.equal(rollback.status, 200);

  const kpis = await request('GET', '/api/observability/kpis', null, admin.token);
  assert.equal(kpis.status, 200);

  const backup = await request('POST', '/api/admin/backups/nightly', {}, admin.token);
  assert.equal(backup.status, 201);
  const drill = await request('POST', '/api/admin/backups/restore-drill', { status: 'completed', notes: 'monthly test' }, admin.token);
  assert.equal(drill.status, 201);

  const syncEnq = await request('POST', '/api/sync/enqueue', { entityType: 'invoice', operation: 'upsert', payload: { id: inv.body.id } }, admin.token);
  assert.equal(syncEnq.status, 201);
  const syncStatus = await request('GET', '/api/sync/status', null, admin.token);
  assert.equal(syncStatus.status, 200);

  const audits = await request('GET', '/api/audit', null, auditor.token);
  assert.equal(audits.status, 200);
  const noAuditAccess = await request('GET', '/api/audit', null, physician.token);
  assert.equal(noAuditAccess.status, 403);

  // lockout policy check
  const lockUser = `lock_${suffix}`;
  await request('POST', '/api/admin/users', { username: lockUser, password: 'StrongPass123', role: 'physician' }, admin.token);
  for (let i = 0; i < 5; i += 1) {
    const bad = await request('POST', '/api/auth/login', { username: lockUser, password: 'WrongPass123' });
    assert.equal(bad.status, 401);
  }
  const locked = await request('POST', '/api/auth/login', { username: lockUser, password: 'StrongPass123' });
  assert.equal(locked.status, 423);
  const usersRows = await request('GET', '/api/users', null, admin.token);
  const lockTarget = (usersRows.body || []).find((u) => u.username === lockUser);
  if (lockTarget) {
    const unlock = await request('POST', `/api/auth/unlock/${lockTarget.id}`, {}, admin.token);
    assert.equal(unlock.status, 200);
    const unlocked = await request('POST', '/api/auth/login', { username: lockUser, password: 'StrongPass123' });
    assert.equal(unlocked.status, 200);
  }

  console.log('Requirement API tests passed');
})();
