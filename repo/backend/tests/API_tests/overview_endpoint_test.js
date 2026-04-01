const assert = require('assert');
const http = require('http');

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
const parsedBase = new URL(baseUrl);

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'content-type': 'application/json' };
    if (payload) headers['content-length'] = Buffer.byteLength(payload);
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({ hostname: parsedBase.hostname, port: Number(parsedBase.port || 80), path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const adminLogin = await request('POST', '/api/auth/login', { username: 'admin@local', password: 'Password!123' });
  assert.equal(adminLogin.status, 200);
  const overview = await request('GET', '/api/overview', null, adminLogin.body.token);
  assert.equal(overview.status, 200);
  assert.ok(overview.body && overview.body.kpis);
  assert.ok(Array.isArray(overview.body.recentOperations));
  console.log('Overview endpoint test passed');
})();
