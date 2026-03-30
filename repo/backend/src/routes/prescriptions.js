const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const { verifyPassword } = require('../services/security');
const logger = require('../lib/logger');

async function prescriptionsRoutes(fastify, opts) {
  fastify.post('/api/prescriptions', { preHandler: [opts.permit('prescription:write')] }, async (request, reply) => {
    logger.info(['handler','prescriptions:create'], `create prescription by ${request.user && request.user.username}`);
    const b = request.body || {};
    const p = await pool.query('SELECT * FROM patients WHERE id=$1', [b.patientId]);
    const patient = p.rows[0];
    if (!patient) return reply.code(404).send({ code: 404, msg: 'Patient not found' });
    const conflict = [...(patient.allergies || []), ...(patient.contraindications || [])].find((x) => String(x.drug || '').toLowerCase() === String(b.drugName || '').toLowerCase() && x.severity === 'high');
    if (conflict && (!b.overrideReason || !b.reauthPassword)) return reply.code(409).send({ code: 409, msg: 'High-severity conflict: override reason and re-auth required' });
    if (conflict) {
      const valid = await verifyPassword(b.reauthPassword, request.user.password_hash);
      if (!valid) return reply.code(401).send({ code: 401, msg: 'Invalid re-auth password' });
    }
    const r = await pool.query('INSERT INTO prescriptions(encounter_id,patient_id,prescriber_id,drug_name,dose,route,quantity,instructions,override_reason,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [b.encounterId, b.patientId, request.user.id, b.drugName, b.dose, b.route, b.quantity, b.instructions, b.overrideReason || null, 'submitted']);
    await writeAudit({ entityType: 'prescription', entityId: r.rows[0].id, action: 'submit', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0], correlationId: request.requestId });
    logger.info(['handler','prescriptions:create','created'], `prescription=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.get('/api/pharmacy/queue', { preHandler: [opts.permit('prescription:review')] }, async () => (await pool.query('SELECT id,state,instructions,quantity,drug_name FROM prescriptions ORDER BY updated_at DESC')).rows);

  fastify.post('/api/pharmacy/:id/action', { preHandler: [opts.permit('prescription:approve')] }, async (request, reply) => {
    logger.info(['handler','prescriptions:action'], `action ${request.body && request.body.action} on ${request.params.id} by ${request.user && request.user.username}`);
    const b = request.body || {};
    const r = await pool.query('SELECT * FROM prescriptions WHERE id=$1', [request.params.id]);
    const rx = r.rows[0];
    if (!rx) return reply.code(404).send({ code: 404, msg: 'Prescription not found' });
    if (b.expectedVersion && Number(b.expectedVersion) !== rx.version) return reply.code(409).send({ code: 409, msg: 'Version conflict on prescription' });
    if (b.action === 'void' && rx.state === 'dispensed') return reply.code(400).send({ code: 400, msg: 'Void disallowed after dispensing' });
    if (b.action === 'void' && !b.reason) return reply.code(400).send({ code: 400, msg: 'Void reason required' });
    const next = b.action === 'approve' ? 'approved' : b.action === 'dispense' ? 'dispensed' : b.action === 'void' ? 'voided' : null;
    if (!next) return reply.code(400).send({ code: 400, msg: 'Invalid action' });
    const upd = await pool.query('UPDATE prescriptions SET state=$1,version=version+1,updated_at=NOW() WHERE id=$2 RETURNING *', [next, rx.id]);
    await writeAudit({ entityType: 'prescription', entityId: rx.id, action: b.action, actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: upd.rows[0], correlationId: request.requestId });
    return upd.rows[0];
  });
}

module.exports = prescriptionsRoutes;
