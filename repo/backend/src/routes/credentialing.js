const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const logger = require('../lib/logger');

async function credentialingRoutes(fastify, opts) {
  fastify.post('/api/credentialing/onboard', { preHandler: [opts.permit('*')] }, async (request, reply) => {
    logger.info(['handler','credentialing:onboard'], `onboard requested by ${request.user && request.user.username}`);
    const b = request.body || {};
    if (b.entityType === 'candidate') {
      const minDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (new Date(b.licenseExpiry) < minDate) { logger.warn(['handler','credentialing:onboard','invalid'], `licenseExpiry too soon`); return reply.code(400).send({ code: 400, msg: 'License expiration must be at least 30 days out' }); }
    }
    const r = await pool.query('INSERT INTO credentialing_profiles(entity_type,full_name,license_number,license_expiry,status) VALUES($1,$2,$3,$4,$5) RETURNING *', [b.entityType, b.fullName, b.licenseNumber || null, b.licenseExpiry || null, 'active']);
    await writeAudit({ entityType: 'credentialing', entityId: r.rows[0].id, action: 'onboard', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0] });
    logger.info(['handler','credentialing:onboard','created'], `profile=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/credentialing/import', { preHandler: [opts.permit('*')] }, async (request) => {
    logger.info(['handler','credentialing:import'], `import requested by ${request.user && request.user.username}`);
    const rows = Array.isArray((request.body || {}).rows) ? request.body.rows : [];
    const accepted = [];
    const errors = [];
    const minDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.entityType === 'candidate' && new Date(row.licenseExpiry) < minDate) {
        errors.push({ row: i + 1, field: 'licenseExpiry', message: 'must be at least 30 days out' });
      } else {
        accepted.push(row);
      }
    }
    for (const row of accepted) {
      await pool.query(
        'INSERT INTO credentialing_profiles(entity_type,full_name,license_number,license_expiry,status) VALUES($1,$2,$3,$4,$5)',
        [row.entityType, row.fullName, row.licenseNumber || null, row.licenseExpiry || null, 'active'],
      );
    }
    return { accepted: accepted.length, rejected: errors.length, errors };
  });
}

module.exports = credentialingRoutes;
