const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const logger = require('../lib/logger');

async function encountersRoutes(fastify, opts) {
  fastify.get('/api/encounters', { preHandler: [opts.permit('encounter:write')] }, async (request) => {
    const isAdmin = request.user && request.user.role === 'admin';
    const hasClinic = request.user && request.user.clinic_id;
    const patientId = (request.query || {}).patientId;
    if (patientId) {
      const sql = isAdmin || !hasClinic
        ? 'SELECT * FROM encounters WHERE patient_id=$1 ORDER BY updated_at DESC LIMIT 100'
        : 'SELECT * FROM encounters WHERE patient_id=$1 AND clinic_id=$2 ORDER BY updated_at DESC LIMIT 100';
      const byPatient = await pool.query(sql, isAdmin || !hasClinic ? [patientId] : [patientId, request.user.clinic_id]);
      return byPatient.rows;
    }
    const allRows = await pool.query(
      isAdmin || !hasClinic
        ? 'SELECT * FROM encounters ORDER BY updated_at DESC LIMIT 100'
        : 'SELECT * FROM encounters WHERE clinic_id=$1 ORDER BY updated_at DESC LIMIT 100',
      isAdmin || !hasClinic ? [] : [request.user.clinic_id],
    );
    return allRows.rows;
  });

  fastify.get('/api/encounters/:id', { preHandler: [opts.permit('encounter:write')] }, async (request, reply) => {
    const isAdmin = request.user && request.user.role === 'admin';
    const hasClinic = request.user && request.user.clinic_id;
    const sql = isAdmin || !hasClinic
      ? 'SELECT * FROM encounters WHERE id=$1'
      : 'SELECT * FROM encounters WHERE id=$1 AND clinic_id=$2';
    const result = await pool.query(sql, isAdmin || !hasClinic ? [request.params.id] : [request.params.id, request.user.clinic_id]);
    if (!result.rows[0]) return reply.code(404).send({ code: 404, msg: 'Encounter not found' });
    return result.rows[0];
  });

  fastify.post('/api/encounters', { preHandler: [opts.permit('encounter:write')] }, async (request, reply) => {
    logger.info(['handler','encounters:create'], `create encounter by ${request.user && request.user.username}`);
    if (!request.user || !request.user.clinic_id) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const b = request.body || {};
    const patientScope = await pool.query(
      'SELECT id FROM patients WHERE id=$1 AND clinic_id=$2',
      [b.patientId, request.user.clinic_id],
    );
    if (!patientScope.rows[0]) {
      return reply.code(403).send({ code: 403, msg: 'Forbidden' });
    }
    const r = await pool.query(
      'INSERT INTO encounters(patient_id,physician_id,chief_complaint,treatment,follow_up,diagnoses,clinic_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [b.patientId, request.user.id, b.chiefComplaint, b.treatment, b.followUp, JSON.stringify(b.diagnoses || []), request.user.clinic_id || null],
    );
    await writeAudit({ entityType: 'encounter', entityId: r.rows[0].id, action: 'create', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0], correlationId: request.requestId });
    logger.info(['handler','encounters:create','created'], `encounter=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/encounters/:id/sign', { preHandler: [opts.permit('encounter:sign')] }, async (request, reply) => {
    logger.info(['handler','encounters:sign'], `sign encounter ${request.params.id} by ${request.user && request.user.username}`);
    if (!request.user || !request.user.clinic_id) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const r = await pool.query('SELECT * FROM encounters WHERE id=$1 AND clinic_id=$2', [request.params.id, request.user.clinic_id]);
    const enc = r.rows[0];
    if (!enc) return reply.code(404).send({ code: 404, msg: 'Encounter not found' });
    const expectedVersion = Number((request.body || {}).expectedVersion || 0);
    if (expectedVersion && expectedVersion !== enc.version) {
      return reply.code(409).send({ code: 409, msg: 'Version conflict on encounter' });
    }
    if (!Array.isArray(enc.diagnoses) || enc.diagnoses.length < 1) return reply.code(400).send({ code: 400, msg: 'At least one diagnosis is required before signing' });
    const upd = await pool.query(
      'UPDATE encounters SET state=$1,version=version+1,updated_at=NOW() WHERE id=$2 AND clinic_id=$3 RETURNING *',
      ['signed', enc.id, request.user.clinic_id],
    );
    if (!upd.rows[0]) return reply.code(404).send({ code: 404, msg: 'Encounter not found' });
    await writeAudit({ entityType: 'encounter', entityId: enc.id, action: 'sign', actorId: request.user.id, actorRole: request.user.role, eventData: {}, snapshot: upd.rows[0], correlationId: request.requestId });
    logger.info(['handler','encounters:sign','signed'], `encounter=${enc.id}`);
    return upd.rows[0];
  });
}

module.exports = encountersRoutes;
