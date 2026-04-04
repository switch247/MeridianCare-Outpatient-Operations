const { pool } = require('../db');
const { encrypt } = require('../utils/crypto');
const { env } = require('../config');
const logger = require('../lib/logger');

async function patientsRoutes(fastify, opts) {
  const clinicalRoles = new Set(['physician', 'pharmacist', 'admin']);
  const isAdmin = (request) => request.user && request.user.role === 'admin';
  const requireClinicContext = (request, reply) => {
    if (!request.user || !request.user.clinic_id) {
      reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
      return false;
    }
    return true;
  };

  function maskName(name) {
    if (!name) return name;
    const trimmed = String(name).trim();
    if (trimmed.length <= 2) return `${trimmed[0] || ''}*`;
    return `${trimmed[0]}${'*'.repeat(Math.max(1, trimmed.length - 2))}${trimmed[trimmed.length - 1]}`;
  }

  // helper to scrub PHI from responses
  function scrubPatient(row, role) {
    if (!row) return row;
    const { ssn_encrypted, ...rest } = row;
    const shouldMask = role && !clinicalRoles.has(role);
    // do not expose encrypted SSN; provide presence flag only
    return {
      ...rest,
      name: shouldMask ? maskName(rest.name) : rest.name,
      has_ssn: !!ssn_encrypted,
    };
  }

  // create patient (physician or admin)
  fastify.post('/api/patients', { preHandler: [opts.permit('patient:write')] }, async (request, reply) => {
    logger.info(['handler','patients:create'], `create patient by ${request.user && request.user.username}`);
    if (!requireClinicContext(request, reply)) return;
    const { name, ssn, allergies = [], contraindications = [] } = request.body || {};
    const r = await pool.query(
      'INSERT INTO patients(name,ssn_encrypted,allergies,contraindications,clinic_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [name, encrypt(ssn || '', env.PHI_KEY), JSON.stringify(allergies), JSON.stringify(contraindications), request.user.clinic_id || null],
    );
    logger.info(['handler','patients:create','created'], `patient=${r.rows[0].id}`);
    reply.code(201); return scrubPatient(r.rows[0], request.user && request.user.role);
  });

  // list patients (for roles with read access)
  fastify.get('/api/patients', { preHandler: [opts.permit('patient:read')] }, async (request, reply) => {
    logger.info(['handler','patients:list'],'list patients');
    const admin = isAdmin(request);
    const clinicId = request.user && request.user.clinic_id;
    if (!admin && !clinicId) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const sql = admin
      ? 'SELECT * FROM patients ORDER BY name LIMIT 200'
      : 'SELECT * FROM patients WHERE clinic_id=$1 ORDER BY name LIMIT 200';
    const params = admin ? [] : [clinicId];
    const r = await pool.query(sql, params);
    return r.rows.map((row) => scrubPatient(row, request.user && request.user.role));
  });

  // get patient
  fastify.get('/api/patients/:id', { preHandler: [opts.permit('patient:read')] }, async (request, reply) => {
    const admin = isAdmin(request);
    const clinicId = request.user && request.user.clinic_id;
    if (!admin && !clinicId) {
      return reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
    }
    const sql = admin
      ? 'SELECT * FROM patients WHERE id=$1'
      : 'SELECT * FROM patients WHERE id=$1 AND clinic_id=$2';
    const params = admin ? [request.params.id] : [request.params.id, clinicId];
    const r = await pool.query(sql, params);
    if (!r.rows.length) return reply.code(404).send({ code: 404, msg: 'Patient not found' });
    return scrubPatient(r.rows[0], request.user && request.user.role);
  });

  // update patient
  fastify.put('/api/patients/:id', { preHandler: [opts.permit('patient:write')] }, async (request, reply) => {
    logger.info(['handler','patients:update'], `update patient ${request.params.id} by ${request.user && request.user.username}`);
    if (!requireClinicContext(request, reply)) return;
    const { name, ssn, allergies, contraindications } = request.body || {};
    const updateFields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { updateFields.push(`name=$${idx++}`); values.push(name); }
    if (ssn !== undefined) { updateFields.push(`ssn_encrypted=$${idx++}`); values.push(encrypt(ssn || '', env.PHI_KEY)); }
    if (allergies !== undefined) { updateFields.push(`allergies=$${idx++}`); values.push(JSON.stringify(allergies)); }
    if (contraindications !== undefined) { updateFields.push(`contraindications=$${idx++}`); values.push(JSON.stringify(contraindications)); }
    if (!updateFields.length) return reply.code(400).send({ code:400, msg:'no fields' });
    const whereParts = [`id=$${idx}`];
    values.push(request.params.id);
    whereParts.push(`clinic_id=$${idx + 1}`);
    values.push(request.user.clinic_id);
    const q = `UPDATE patients SET ${updateFields.join(',')}, updated_at=NOW() WHERE ${whereParts.join(' AND ')} RETURNING *`;
    const r = await pool.query(q, values);
    if (!r.rows.length) return reply.code(404).send({ code:404, msg:'Patient not found' });
    return scrubPatient(r.rows[0], request.user && request.user.role);
  });

  // delete patient (admin only)
  fastify.delete('/api/patients/:id', { preHandler: [opts.permit('patient:delete')] }, async (request, reply) => {
    logger.info(['handler','patients:delete'], `delete patient ${request.params.id} by ${request.user && request.user.username}`);
    if (!requireClinicContext(request, reply)) return;
    const sql = 'DELETE FROM patients WHERE id=$1 AND clinic_id=$2 RETURNING id';
    const params = [request.params.id, request.user.clinic_id];
    const r = await pool.query(sql, params);
    if (!r.rows.length) return reply.code(404).send({ code:404, msg:'Patient not found' });
    return { id: r.rows[0].id, deleted: true };
  });

  // ICD search (keep existing access rules for encounters)
  fastify.get('/api/icd', { preHandler: [opts.permit('encounter:write')] }, async (request) => {
    logger.info(['handler','patients:icd','query'], `q=${String((request.query || {}).q || '')}`);
    const q = String((request.query || {}).q || '').toLowerCase();
    const r = await pool.query('SELECT code,label FROM icd_catalog WHERE active=true AND (LOWER(code) LIKE $1 OR LOWER(label) LIKE $1) LIMIT 20', [`%${q}%`]);
    return r.rows;
  });
}

module.exports = patientsRoutes;
