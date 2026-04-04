const { pool } = require('../db');
const logger = require('../lib/logger');

async function syncAuditRoutes(fastify, opts) {
  fastify.post('/api/sync/enqueue', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ code: 403, msg: 'Forbidden' });
    }
    logger.info(['handler','sync:enqueue'], `enqueue sync ${request.body && request.body.entityType}`);
    const body = request.body || {};
    const result = await pool.query(
      'INSERT INTO offline_sync_queue(entity_type,entity_id,operation,payload,state) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [body.entityType, body.entityId || null, body.operation, JSON.stringify(body.payload || {}), 'pending'],
    );
    reply.code(201);
    return result.rows[0];
  });

  fastify.get('/api/sync/status', { preHandler: [opts.permit('audit:read')] }, async () => {
    logger.info(['handler','sync:status'],'sync status requested');
    const result = await pool.query(
      'SELECT state, COUNT(*)::int AS count FROM offline_sync_queue GROUP BY state ORDER BY state',
    );
    return result.rows;
  });

  fastify.get('/api/audit', { preHandler: [opts.permit('audit:read')] }, async () => {
    logger.info(['handler','audit:list'],'audit list requested');
    return (await pool.query('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100')).rows;
  });
}

module.exports = syncAuditRoutes;
