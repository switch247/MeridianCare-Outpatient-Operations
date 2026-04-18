const assert = require('assert');
const { withToken } = require('./helper');

/**
 * Sync and Audit API direct endpoint tests
 */
async function runSyncAuditApi(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const suffix = Date.now();

  // Enqueue sync
  const enqueue = await admin.post('/api/sync/enqueue').send({
    entityType: 'test',
    operation: 'test-op',
    payload: { test: true, suffix },
  });
  assert.equal(enqueue.status, 201, 'sync enqueue should succeed');
  assert.ok(enqueue.body.id, 'sync enqueue should return id');

  // Sync status
  const status = await admin.get('/api/sync/status');
  assert.equal(status.status, 200, 'sync status should succeed');
  assert.ok(Array.isArray(status.body), 'sync status should be array');

  // Audit list
  const audit = await admin.get('/api/audit');
  assert.equal(audit.status, 200, 'audit list should succeed');
  assert.ok(Array.isArray(audit.body), 'audit list should be array');
}

module.exports = { runSyncAuditApi };
