const assert = require('assert');
const { withToken } = require('./helper');

async function runAdminAccess(api, sessions) {
  const physician = withToken(api, sessions.physician.token);

  const calls = [
    () => physician.post('/api/admin/users').send({ username: 'x', password: 'StrongPass123', role: 'physician' }),
    () => physician.get('/api/auth/sessions'),
    () => physician.post('/api/crawler/run').send({ sourceName: 'x', priority: 1 }),
    () => physician.get('/api/crawler/queue'),
    () => physician.post('/api/crawler/process-next').send({}),
    () => physician.post('/api/crawler/00000000-0000-0000-0000-000000000000/retry').send({}),
    () => physician.get('/api/crawler/nodes'),
    () => physician.post('/api/crawler/scale').send({}),
    () => physician.post('/api/models/register').send({ modelType: 'visit_volume', versionTag: 'x' }),
    () => physician.get('/api/models/drift'),
    () => physician.post('/api/models/00000000-0000-0000-0000-000000000000/rollback').send({}),
    () => physician.get('/api/admin/forecasts'),
    () => physician.get('/api/admin/recommendations'),
    () => physician.get('/api/observability/kpis'),
    () => physician.post('/api/observability/exceptions').send({ message: 'x' }),
    () => physician.get('/api/observability/exceptions'),
    () => physician.post('/api/admin/backups/nightly').send({}),
    () => physician.get('/api/admin/backups/nightly'),
    () => physician.post('/api/admin/backups/restore-drill').send({ status: 'completed' }),
    () => physician.get('/api/admin/backups/restore-drill'),
  ];

  for (const run of calls) {
    const res = await run();
    assert.equal(res.status, 403);
  }
}

module.exports = { runAdminAccess };
