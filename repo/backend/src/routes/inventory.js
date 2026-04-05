const { pool } = require('../db');
const logger = require('../lib/logger');

async function inventoryRoutes(fastify, opts) {
  const isAdmin = (request) => request.user && request.user.role === 'admin';
  const clinicScope = (request) => {
    const clinicId = request.user && request.user.clinic_id;
    if (isAdmin(request) && !clinicId) return { clause: '', params: [], forbidden: false };
    if (!clinicId) return { clause: '', params: [], forbidden: true };
    return { clause: ' WHERE clinic_id=$1', params: [clinicId], forbidden: false };
  };

  fastify.get('/api/inventory/items', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    const scope = clinicScope(request);
    if (scope.forbidden) return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    const result = await pool.query(
      `SELECT id,sku,name,on_hand,low_stock_threshold,lot_tracking,serial_tracking
       FROM inventory_items${scope.clause}
       ORDER BY name`,
      scope.params,
    );
    return result.rows;
  });

  fastify.post('/api/inventory/items', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    logger.info(['handler','inventory:createItem'], `create item by ${request.user && request.user.username}`);
    if (!isAdmin(request) && !(request.user && request.user.clinic_id)) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const b = request.body || {};
    const itemClinicId = request.user && request.user.clinic_id ? request.user.clinic_id : null;
    const r = await pool.query(
      'INSERT INTO inventory_items(sku,name,low_stock_threshold,lot_tracking,serial_tracking,clinic_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [b.sku, b.name, b.lowStockThreshold || 10, !!b.lotTracking, !!b.serialTracking, itemClinicId],
    );
    logger.info(['handler','inventory:createItem','created'], `item=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/inventory/movements', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    logger.info(['handler','inventory:movement'], `movement by ${request.user && request.user.username}`);
    if (!isAdmin(request) && !(request.user && request.user.clinic_id)) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const b = request.body || {};
    if (!Number.isInteger(b.quantity) || b.quantity < 1) return reply.code(400).send({ code: 400, msg: 'Quantity must be positive integer' });
    const admin = isAdmin(request);
    const scopeSql = admin ? 'SELECT * FROM inventory_items WHERE id=$1' : 'SELECT * FROM inventory_items WHERE id=$1 AND clinic_id=$2';
    const scopeParams = admin ? [b.itemId] : [b.itemId, request.user.clinic_id];
    const itemRes = await pool.query(scopeSql, scopeParams); const item = itemRes.rows[0];
    if (!item) return reply.code(404).send({ code: 404, msg: 'Item not found' });
    const inTypes = ['receive','return','count_adjust_up']; const sign = inTypes.includes(b.movementType) ? 1 : -1; const next = item.on_hand + sign * b.quantity;
    if (next < 0) return reply.code(400).send({ code: 400, msg: 'Inventory cannot be negative' });
    await pool.query('UPDATE inventory_items SET on_hand=$1 WHERE id=$2', [next, b.itemId]);
    const mv = await pool.query(
      'INSERT INTO inventory_movements(item_id,movement_type,quantity,ref_type,ref_id,lot,serial,reason,created_by,clinic_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [b.itemId, b.movementType, b.quantity, b.refType || null, b.refId || null, b.lot || null, b.serial || null, b.reason || null, request.user.id, item.clinic_id || null],
    );
    logger.info(['handler','inventory:movement','created'], `movement=${mv.rows[0].id} item=${b.itemId} qty=${b.quantity}`);
    return { movement: mv.rows[0], onHand: next, lowStock: next <= item.low_stock_threshold };
  });

  fastify.get('/api/inventory/alerts/low-stock', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    const scope = clinicScope(request);
    if (scope.forbidden) return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    const result = await pool.query(
      `SELECT id,sku,name,on_hand,low_stock_threshold
       FROM inventory_items
       WHERE on_hand <= low_stock_threshold${scope.clause ? ' AND clinic_id=$1' : ''}
       ORDER BY on_hand ASC`,
      scope.params,
    );
    return result.rows;
  });

  fastify.get('/api/inventory/reports/variance', { preHandler: [opts.permit('inventory:write')] }, async (request, reply) => {
    const scope = clinicScope(request);
    if (scope.forbidden) return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    const result = await pool.query(
      `SELECT item_id,
              SUM(CASE WHEN movement_type IN ('count_adjust_up') THEN quantity ELSE 0 END)::int AS positive_adjustments,
              SUM(CASE WHEN movement_type IN ('count_adjust_down') THEN quantity ELSE 0 END)::int AS negative_adjustments
       FROM inventory_movements${scope.clause}
       GROUP BY item_id
       ORDER BY item_id`,
      scope.params,
    );
    return result.rows;
  });
}

module.exports = inventoryRoutes;
