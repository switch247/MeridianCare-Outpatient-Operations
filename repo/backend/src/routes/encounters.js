const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const logger = require('../lib/logger');

async function encountersRoutes(fastify, opts) {
  fastify.post('/api/encounters', { preHandler: [opts.permit('encounter:write')] }, async (request, reply) => {
    logger.info(['handler','encounters:create'], `create encounter by ${request.user && request.user.username}`);
    const b = request.body || {};
    const r = await pool.query('INSERT INTO encounters(patient_id,physician_id,chief_complaint,treatment,follow_up,diagnoses) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [b.patientId, request.user.id, b.chiefComplaint, b.treatment, b.followUp, JSON.stringify(b.diagnoses || [])]);
    await writeAudit({ entityType: 'encounter', entityId: r.rows[0].id, action: 'create', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0] });
    logger.info(['handler','encounters:create','created'], `encounter=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/encounters/:id/sign', { preHandler: [opts.permit('encounter:sign')] }, async (request, reply) => {
    logger.info(['handler','encounters:sign'], `sign encounter ${request.params.id} by ${request.user && request.user.username}`);
    const r = await pool.query('SELECT * FROM encounters WHERE id=$1', [request.params.id]);
    const enc = r.rows[0];
    if (!enc) return reply.code(404).send({ code: 404, msg: 'Encounter not found' });
    const expectedVersion = Number((request.body || {}).expectedVersion || 0);
    if (expectedVersion && expectedVersion !== enc.version) {
      return reply.code(409).send({ code: 409, msg: 'Version conflict on encounter' });
    }
    if (!Array.isArray(enc.diagnoses) || enc.diagnoses.length < 1) return reply.code(400).send({ code: 400, msg: 'At least one diagnosis is required before signing' });
    const upd = await pool.query('UPDATE encounters SET state=$1,version=version+1,updated_at=NOW() WHERE id=$2 RETURNING *', ['signed', enc.id]);
    await writeAudit({ entityType: 'encounter', entityId: enc.id, action: 'sign', actorId: request.user.id, actorRole: request.user.role, eventData: {}, snapshot: upd.rows[0] });
    logger.info(['handler','encounters:sign','signed'], `encounter=${enc.id}`);
    return upd.rows[0];
  });
}

module.exports = encountersRoutes;
