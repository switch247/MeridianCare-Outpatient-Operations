const assert = require('assert');
const { withToken } = require('./helper');

/**
 * Inventory API direct endpoint tests
 */
async function runInventoryApi(api, sessions) {
  const inventory = withToken(api, sessions.inventory.token);
  const admin = withToken(api, sessions.admin.token);
  const suffix = Date.now();

  // Create inventory item
  const item = await inventory.post('/api/inventory/items').send({
    sku: `TEST-SKU-${suffix}`,
    name: `Test Item ${suffix}`,
    lowStockThreshold: 5,
    lotTracking: false,
    serialTracking: false,
  });
  assert.equal(item.status, 201, 'inventory item create should succeed');
  const itemId = item.body.id;

  // List inventory items
  const items = await inventory.get('/api/inventory/items');
  assert.equal(items.status, 200, 'inventory items list should succeed');
  assert.ok(Array.isArray(items.body), 'inventory items should be array');
  assert.ok(items.body.find(i => i.id === itemId), 'created item should be in list');

  // Create inventory movement
  const movement = await inventory.post('/api/inventory/movements').send({
    itemId,
    movementType: 'receive',
    quantity: 10,
    lot: '',
    serial: '',
    reason: 'test receive',
  });
  assert.equal(movement.status, 200, 'inventory movement should succeed');
  assert.ok(movement.body.movement, 'movement object should be returned');

  // Low stock alerts
  const alerts = await inventory.get('/api/inventory/alerts/low-stock');
  assert.equal(alerts.status, 200, 'low stock alerts should succeed');
  assert.ok(Array.isArray(alerts.body), 'alerts should be array');

  // Variance report
  const variance = await inventory.get('/api/inventory/reports/variance');
  assert.equal(variance.status, 200, 'variance report should succeed');
  assert.ok(Array.isArray(variance.body), 'variance should be array');
}

module.exports = { runInventoryApi };
