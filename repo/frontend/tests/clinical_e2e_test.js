const assert = require('assert');
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  const stamp = Date.now();
  const username = `phase2_doc_${stamp}`;
  const password = 'StrongPass123';

  const adminLogin = await req('POST', '/api/auth/login', { username: 'admin@local', password: 'Password!123' });
  assert.equal(adminLogin.status, 200);
  const reg = await req('POST', '/api/admin/users', { username, password, role: 'physician' }, adminLogin.body.token);
  assert.equal(reg.status, 201);
  const login = await req('POST', '/api/auth/login', { username, password });
  assert.equal(login.status, 200);
  const token = login.body.token;

  const patient = await req('POST', '/api/patients', {
    name: 'Phase2 Patient',
    ssn: '111-22-3333',
    allergies: [{ drug: 'penicillin', severity: 'high' }],
    contraindications: [],
  }, token);
  assert.equal(patient.status, 201);

  const icd = await req('GET', '/api/icd?q=J06', null, token);
  assert.equal(icd.status, 200);
  assert.ok((icd.body || []).length > 0);

  const encounter = await req('POST', '/api/encounters', {
    patientId: patient.body.id,
    chiefComplaint: 'Sore throat',
    treatment: 'Hydration and rest',
    followUp: '3 days',
    diagnoses: [{ code: 'J06.9', label: 'Acute upper respiratory infection, unspecified' }],
  }, token);
  assert.equal(encounter.status, 201);

  const sign = await req('POST', `/api/encounters/${encounter.body.id}/sign`, { expectedVersion: encounter.body.version }, token);
  assert.equal(sign.status, 200);

  const conflictRx = await req('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'penicillin',
    dose: '250mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
  }, token);
  assert.equal(conflictRx.status, 409);

  const overrideRx = await req('POST', '/api/prescriptions', {
    encounterId: encounter.body.id,
    patientId: patient.body.id,
    drugName: 'penicillin',
    dose: '250mg',
    route: 'oral',
    quantity: 10,
    instructions: 'twice daily',
    overrideReason: 'Clinical necessity documented',
    reauthPassword: password,
  }, token);
  assert.equal(overrideRx.status, 201);

  const audits = await req('GET', '/api/audit', null, token);
  assert.equal(audits.status, 403);

  console.log('Clinical E2E passed');
})();
