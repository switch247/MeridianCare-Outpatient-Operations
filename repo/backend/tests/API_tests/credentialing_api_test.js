const assert = require('assert');
const { withToken } = require('./helper');

/**
 * Credentialing API direct endpoint tests
 */
async function runCredentialingApi(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const suffix = Date.now();

  // List credentialing
  const list = await admin.get('/api/credentialing');
  assert.equal(list.status, 200, 'credentialing list should succeed');
  assert.ok(Array.isArray(list.body), 'credentialing list should be array');

  // Onboard credential
  const onboard = await admin.post('/api/credentialing/onboard').send({
    entityType: 'candidate',
    fullName: `Test Candidate ${suffix}`,
    licenseNumber: `LIC${suffix}`,
    licenseExpiry: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  assert.equal(onboard.status, 201, 'credentialing onboard should succeed');
  assert.ok(onboard.body.id, 'onboarded credential should have id');

  // Export credentialing
  const exportRes = await admin.get('/api/credentialing/export');
  assert.equal(exportRes.status, 200, 'credentialing export should succeed');
  assert.ok(Array.isArray(exportRes.body) || typeof exportRes.body === 'object', 'credentialing export should return data');
}

module.exports = { runCredentialingApi };
