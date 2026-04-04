const assert = require('assert');
const { withToken } = require('./helper');

async function runOverviewApi(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const auditor = withToken(api, sessions.auditor.token);
  const physician = withToken(api, sessions.physician.token);

  const adminOverview = await admin.get('/api/overview');
  assert.equal(adminOverview.status, 200);
  assert.ok(adminOverview.body && adminOverview.body.kpis);
  assert.ok(Array.isArray(adminOverview.body.recentOperations));

  const auditorOverview = await auditor.get('/api/overview');
  assert.equal(auditorOverview.status, 200);
  assert.ok(auditorOverview.body && auditorOverview.body.kpis);

  const physicianOverview = await physician.get('/api/overview');
  assert.equal(physicianOverview.status, 403);

  const adminKpis = await admin.get('/api/observability/kpis');
  assert.equal(adminKpis.status, 200);
  assert.ok(typeof adminKpis.body.orderVolume === 'number');
  assert.ok(typeof adminKpis.body.fulfillmentTimeMinutes === 'number');

  const auditorKpis = await auditor.get('/api/observability/kpis');
  assert.equal(auditorKpis.status, 200);
}

module.exports = { runOverviewApi };
