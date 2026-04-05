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

  // Verify full KPI set is present
  const kpis = adminOverview.body.kpis;
  assert.ok(typeof kpis.orderVolume === 'number', 'overview kpis.orderVolume should be a number');
  assert.ok(typeof kpis.acceptanceRate === 'number', 'overview kpis.acceptanceRate should be a number');
  assert.ok(typeof kpis.fulfillmentTimeMinutes === 'number', 'overview kpis.fulfillmentTimeMinutes should be a number');
  assert.ok(typeof kpis.cancellationRate === 'number', 'overview kpis.cancellationRate should be a number');
  assert.ok(typeof kpis.totalEncounters === 'number', 'overview kpis.totalEncounters should be a number');
  assert.ok(typeof kpis.totalPatients === 'number', 'overview kpis.totalPatients should be a number');
  assert.ok(typeof kpis.totalPrescriptions === 'number', 'overview kpis.totalPrescriptions should be a number');
  assert.ok(typeof kpis.lowStockItems === 'number', 'overview kpis.lowStockItems should be a number');

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
