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
  const reg = await request('POST', '/api/auth/register', { username, password, role });
  assert.equal(reg.status, 201);
  const login = await request('POST', '/api/auth/login', { username, password });
  assert.equal(login.status, 200);
  return { token: login.body.token };
}

(async () => {
  const suffix = Date.now();
  const admin = await createUser(`p5_admin_${suffix}`, 'admin');

  const crawl = await request('POST', '/api/crawler/run', { sourceName: 'drug-catalog', priority: 1 }, admin.token);
  assert.equal(crawl.status, 201);
  const jobId = crawl.body.id;

  const q1 = await request('GET', '/api/crawler/queue', null, admin.token);
  assert.equal(q1.status, 200);
  assert.ok((q1.body || []).some((j) => j.id === jobId));

  const step1 = await request('POST', '/api/crawler/process-next', { nodeId: 'node-a' }, admin.token);
  assert.equal(step1.status, 200);
  assert.equal(step1.body.node_id, 'node-a');

  const retry = await request('POST', `/api/crawler/${jobId}/retry`, {}, admin.token);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.state, 'retry_wait');

  const modelA = await request('POST', '/api/models/register', {
    modelType: 'medication_demand',
    versionTag: `m1-${suffix}`,
    algorithm: 'baseline_ts',
    baselineScore: 0.7,
    currentScore: 0.75,
    deploy: true,
  }, admin.token);
  assert.equal(modelA.status, 201);

  const modelB = await request('POST', '/api/models/register', {
    modelType: 'medication_demand',
    versionTag: `m2-${suffix}`,
    algorithm: 'baseline_ts',
    baselineScore: 0.7,
    currentScore: 0.82,
    driftScore: 0.12,
    deploy: true,
  }, admin.token);
  assert.equal(modelB.status, 201);

  const drift = await request('GET', '/api/models/drift', null, admin.token);
  assert.equal(drift.status, 200);
  assert.ok((drift.body || []).some((m) => m.id === modelB.body.id));

  const rollback = await request('POST', `/api/models/${modelB.body.id}/rollback`, {}, admin.token);
  assert.equal(rollback.status, 200);

  const ex = await request('POST', '/api/observability/exceptions', {
    level: 'error',
    source: 'phase5-test',
    message: 'simulated failure',
    details: { code: 'E_SIM' },
  }, admin.token);
  assert.equal(ex.status, 201);

  const exList = await request('GET', '/api/observability/exceptions', null, admin.token);
  assert.equal(exList.status, 200);
  assert.ok((exList.body || []).some((e) => e.id === ex.body.id));

  const nightly = await request('POST', '/api/admin/backups/nightly', {}, admin.token);
  assert.equal(nightly.status, 201);
  assert.equal(nightly.body.encrypted, true);

  const nightlyList = await request('GET', '/api/admin/backups/nightly', null, admin.token);
  assert.equal(nightlyList.status, 200);
  assert.ok((nightlyList.body || []).length >= 1);

  const drill = await request('POST', '/api/admin/backups/restore-drill', {
    status: 'completed',
    notes: 'phase5 monthly drill',
  }, admin.token);
  assert.equal(drill.status, 201);

  console.log('Phase 5 ops E2E passed');
})();
