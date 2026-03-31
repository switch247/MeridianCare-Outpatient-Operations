const { pool } = require('../db');
const logger = require('../lib/logger');

async function inventoryRoutes(fastify, opts) {
  fastify.get('/api/inventory/items', { preHandler: [opts.permit('inventory:write')] }, async () => {
    const result = await pool.query(
      'SELECT id,sku,name,on_hand,low_stock_threshold,lot_tracking,serial_tracking FROM inventory_items ORDER BY name',
    );
    return result.rows;
  });

  fastify.post('/api/inventory/items', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    logger.info(['handler','inventory:createItem'], `create item by ${request.user && request.user.username}`);
    const b = request.body || {};
    const r = await pool.query('INSERT INTO inventory_items(sku,name,low_stock_threshold,lot_tracking,serial_tracking) VALUES($1,$2,$3,$4,$5) RETURNING *', [b.sku, b.name, b.lowStockThreshold || 10, !!b.lotTracking, !!b.serialTracking]);
    logger.info(['handler','inventory:createItem','created'], `item=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/inventory/movements', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    logger.info(['handler','inventory:movement'], `movement by ${request.user && request.user.username}`);
    const b = request.body || {};
    if (!Number.isInteger(b.quantity) || b.quantity < 1) return reply.code(400).send({ code: 400, msg: 'Quantity must be positive integer' });
    const itemRes = await pool.query('SELECT * FROM inventory_items WHERE id=$1', [b.itemId]); const item = itemRes.rows[0];
    if (!item) return reply.code(404).send({ code: 404, msg: 'Item not found' });
    const inTypes = ['receive','return','count_adjust_up']; const sign = inTypes.includes(b.movementType) ? 1 : -1; const next = item.on_hand + sign * b.quantity;
    if (next < 0) return reply.code(400).send({ code: 400, msg: 'Inventory cannot be negative' });
    await pool.query('UPDATE inventory_items SET on_hand=$1 WHERE id=$2', [next, b.itemId]);
    const mv = await pool.query('INSERT INTO inventory_movements(item_id,movement_type,quantity,ref_type,ref_id,lot,serial,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [b.itemId, b.movementType, b.quantity, b.refType || null, b.refId || null, b.lot || null, b.serial || null, b.reason || null, request.user.id]);
    logger.info(['handler','inventory:movement','created'], `movement=${mv.rows[0].id} item=${b.itemId} qty=${b.quantity}`);
    return { movement: mv.rows[0], onHand: next, lowStock: next <= item.low_stock_threshold };
  });

  fastify.get('/api/inventory/alerts/low-stock', { preHandler: [opts.permit('inventory:write')] }, async () => {
    const result = await pool.query(
      'SELECT id,sku,name,on_hand,low_stock_threshold FROM inventory_items WHERE on_hand <= low_stock_threshold ORDER BY on_hand ASC',
    );
    return result.rows;
  });

  fastify.get('/api/inventory/reports/variance', { preHandler: [opts.permit('inventory:write')] }, async () => {
    const result = await pool.query(
      `SELECT item_id,\n              SUM(CASE WHEN movement_type IN ('count_adjust_up') THEN quantity ELSE 0 END)::int AS positive_adjustments,\n              SUM(CASE WHEN movement_type IN ('count_adjust_down') THEN quantity ELSE 0 END)::int AS negative_adjustments\n       FROM inventory_movements\n       GROUP BY item_id\n       ORDER BY item_id`,
    );
    return result.rows;
  });
}

module.exports = inventoryRoutes;
