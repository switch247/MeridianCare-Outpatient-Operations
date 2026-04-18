const assert = require('assert');
const { withToken } = require('./helper');

/**
 * Admin/crawler/model/observability API direct endpoint tests
 */
async function runAdminCrawlerObsApi(api, sessions) {
  const admin = withToken(api, sessions.admin.token);
  const suffix = Date.now();

  // Crawler run
  const crawler = await admin.post('/api/crawler/run').send({ sourceName: 'test', priority: 1 });
  assert.ok([200, 201].includes(crawler.status), 'crawler run should succeed');

  // Crawler queue
  const queue = await admin.get('/api/crawler/queue');
  assert.equal(queue.status, 200, 'crawler queue should succeed');
  assert.ok(Array.isArray(queue.body.items), 'crawler queue items should be array');

  // Crawler process-next
  const processNext = await admin.post('/api/crawler/process-next').send({});
  assert.ok([200, 201].includes(processNext.status), 'crawler process-next should succeed');

  // Crawler nodes
  const nodes = await admin.get('/api/crawler/nodes');
  assert.equal(nodes.status, 200, 'crawler nodes should succeed');
  assert.ok(Array.isArray(nodes.body), 'crawler nodes should be array');

  // Crawler scale
  const scale = await admin.post('/api/crawler/scale').send({});
  assert.ok([200, 201].includes(scale.status), 'crawler scale should succeed');

  // Model register
  const model = await admin.post('/api/models/register').send({ modelType: 'test', versionTag: `v${suffix}` });
  assert.ok([200, 201].includes(model.status), 'model register should succeed');

  // Model drift
  const drift = await admin.get('/api/models/drift');
  assert.equal(drift.status, 200, 'model drift should succeed');

  // Observability KPIs
  const kpis = await admin.get('/api/observability/kpis');
  assert.equal(kpis.status, 200, 'observability kpis should succeed');
  assert.ok(typeof kpis.body.orderVolume === 'number', 'orderVolume should be number');

  // Observability exceptions
  const exception = await admin.post('/api/observability/exceptions').send({ message: 'test exception' });
  assert.ok([200, 201].includes(exception.status), 'exception create should succeed');
  const exceptions = await admin.get('/api/observability/exceptions');
  assert.equal(exceptions.status, 200, 'exceptions list should succeed');
  assert.ok(Array.isArray(exceptions.body.items), 'exceptions.items should be array');
}

module.exports = { runAdminCrawlerObsApi };
