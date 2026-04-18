const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const { encrypt } = require('../utils/crypto');
const { env } = require('../config');
const logger = require('../lib/logger');

function minLicenseDate() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function toInternalRow(row, mapping = {}) {
  const read = (key, fallback) => {
    const mapped = mapping[key];
    if (mapped && row[mapped] !== undefined) return row[mapped];
    return row[key] !== undefined ? row[key] : fallback;
  };
  return {
    entityType: read('entityType', 'candidate'),
    fullName: read('fullName', ''),
    licenseNumber: read('licenseNumber', null),
    licenseExpiry: read('licenseExpiry', null),
  };
}

function validateOnboard(entityType, licenseExpiry) {
  if (entityType === 'candidate') {
    const minDate = minLicenseDate();
    if (!licenseExpiry || new Date(licenseExpiry) < minDate) {
      return 'License expiration must be at least 30 days out';
    }
  }
  return null;
}

function maskLicense(row) {
  if (row.license_number_encrypted && !row.license_number) return 'encrypted';
  if (!row.license_number) return '-';
  const text = String(row.license_number);
  if (text.length <= 4) return '****';
  return `${'*'.repeat(text.length - 4)}${text.slice(-4)}`;
}

async function credentialingRoutes(fastify, opts) {
  const isAdminRole = (role) => role === 'admin';
  const ensureAdmin = (request, reply) => {
    if (!request.user || !isAdminRole(request.user.role)) {
      reply.code(403).send({ code: 403, msg: 'Admin role required' });
      return false;
    }
    return true;
  };

  fastify.get('/api/credentialing', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const result = await pool.query(
      'SELECT id,entity_type,full_name,license_number,license_number_encrypted,license_expiry,status,version,source_row FROM credentialing_profiles ORDER BY id DESC LIMIT 200',
    );
    return result.rows.map((r) => ({ ...r, license_number: maskLicense(r) }));
  });

  fastify.post('/api/credentialing/onboard', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    logger.info(['handler', 'credentialing:onboard'], `onboard requested by ${request.user && request.user.username}`);
    const b = request.body || {};
    const err = validateOnboard(b.entityType, b.licenseExpiry);
    if (err) return reply.code(400).send({ code: 400, msg: err });
    const encLicense = b.licenseNumber ? encrypt(b.licenseNumber, env.PHI_KEY) : null;
    const r = await pool.query(
      `INSERT INTO credentialing_profiles(entity_type,full_name,license_number,license_number_encrypted,license_expiry,status,source_row)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.entityType, b.fullName, null, encLicense, b.licenseExpiry || null, 'active', JSON.stringify({ mode: 'single' })],
    );
    await writeAudit({ entityType: 'credentialing', entityId: r.rows[0].id, action: 'onboard', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0], correlationId: request.requestId });
    reply.code(201);
    return { ...r.rows[0], license_number: maskLicense(r.rows[0]) };
  });

  fastify.post('/api/credentialing/import', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    logger.info(['handler', 'credentialing:import'], `import requested by ${request.user && request.user.username}`);
    const rows = Array.isArray((request.body || {}).rows) ? request.body.rows : [];
    const mapping = (request.body || {}).mapping || {};
    const accepted = [];
    const errors = [];
    for (let i = 0; i < rows.length; i += 1) {
      const mapped = toInternalRow(rows[i], mapping);
      const err = validateOnboard(mapped.entityType, mapped.licenseExpiry);
      if (!mapped.fullName) {
        errors.push({ row: i + 1, field: 'fullName', message: 'is required' });
        continue;
      }
      if (err) {
        errors.push({ row: i + 1, field: 'licenseExpiry', message: err });
      } else {
        accepted.push({ original: rows[i], mapped });
      }
    }
    for (const row of accepted) {
      const encLicense = row.mapped.licenseNumber ? encrypt(row.mapped.licenseNumber, env.PHI_KEY) : null;
      const inserted = await pool.query(
        `INSERT INTO credentialing_profiles(entity_type,full_name,license_number,license_number_encrypted,license_expiry,status,source_row)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [row.mapped.entityType, row.mapped.fullName, null, encLicense, row.mapped.licenseExpiry || null, 'active', JSON.stringify(row.original || {})],
      );
      if (inserted.rows && inserted.rows[0] && request.user) {
        await writeAudit({
          entityType: 'credentialing',
          entityId: inserted.rows[0].id,
          action: 'import_onboard',
          actorId: request.user.id,
          actorRole: request.user.role,
          eventData: row.mapped,
          snapshot: inserted.rows[0],
          correlationId: request.requestId,
        });
      }
    }
    return { accepted: accepted.length, rejected: errors.length, errors, mappingUsed: mapping };
  });

  fastify.get('/api/credentialing/export', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const rows = (await pool.query('SELECT id,entity_type,full_name,license_expiry,status FROM credentialing_profiles ORDER BY id DESC LIMIT 500')).rows;
    const summary = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      pending: rows.filter((r) => r.status === 'pending').length,
    };
    return { summary, rows };
  });

  fastify.get('/api/organizations', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    return (await pool.query('SELECT * FROM organizations ORDER BY id DESC LIMIT 200')).rows;
  });

  fastify.post('/api/organizations', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const b = request.body || {};
    if (!b.name) return reply.code(400).send({ code: 400, msg: 'name is required' });
    const inserted = await pool.query(
      `INSERT INTO organizations(name,organization_type,contact_email_encrypted,contact_phone,address,status)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.name, b.organizationType || 'clinic', b.contactEmail ? encrypt(b.contactEmail, env.PHI_KEY) : null, b.contactPhone || null, b.address || null, b.status || 'active'],
    );
    reply.code(201);
    return inserted.rows[0];
  });

  fastify.put('/api/organizations/:id', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const b = request.body || {};
    const updated = await pool.query(
      `UPDATE organizations
       SET name=$1,organization_type=$2,contact_email_encrypted=$3,contact_phone=$4,address=$5,status=$6,updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [b.name, b.organizationType || 'clinic', b.contactEmail ? encrypt(b.contactEmail, env.PHI_KEY) : null, b.contactPhone || null, b.address || null, b.status || 'active', request.params.id],
    );
    if (!updated.rows[0]) return reply.code(404).send({ code: 404, msg: 'Organization not found' });
    return updated.rows[0];
  });

  fastify.delete('/api/organizations/:id', { preHandler: [opts.permit('admin')] }, async (request, reply) => {
    if (!ensureAdmin(request, reply)) return;
    const deleted = await pool.query('DELETE FROM organizations WHERE id=$1 RETURNING id', [request.params.id]);
    if (!deleted.rows[0]) return reply.code(404).send({ code: 404, msg: 'Organization not found' });
    return { ok: true, id: deleted.rows[0].id };
  });
}

module.exports = credentialingRoutes;

