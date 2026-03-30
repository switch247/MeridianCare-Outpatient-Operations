const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');

async function createClinic({ name, address, contactInfo, type, actorId, actorRole, correlationId }) {
  const r = await pool.query(
    'INSERT INTO clinics(name,address,contact_info,type,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [name, address || null, JSON.stringify(contactInfo || {}), type || 'clinical', actorId || null],
  );
  const clinic = r.rows[0];
  await writeAudit({ entityType: 'clinic', entityId: clinic.id, action: 'create', actorId, actorRole, eventData: { name, address, contactInfo, type }, snapshot: clinic, correlationId });
  return clinic;
}

async function getClinic(id) {
  if (!id) {
    const r = await pool.query('SELECT * FROM clinics ORDER BY created_at LIMIT 1');
    return r.rows[0] || null;
  }
  const r = await pool.query('SELECT * FROM clinics WHERE id=$1', [id]);
  return r.rows[0] || null;
}

async function updateClinic(id, { name, address, contactInfo, type, correlationId }, actorId, actorRole) {
  const r = await pool.query(
    'UPDATE clinics SET name=$1,address=$2,contact_info=$3,type=$4,updated_at=NOW() WHERE id=$5 RETURNING *',
    [name, address || null, JSON.stringify(contactInfo || {}), type || 'clinical', id],
  );
  const clinic = r.rows[0];
  await writeAudit({ entityType: 'clinic', entityId: id, action: 'update', actorId, actorRole, eventData: { name, address, contactInfo, type }, snapshot: clinic, correlationId });
  return clinic;
}

async function deleteClinic(id, { reason, confirmed, correlationId }, actorId, actorRole) {
  if (!confirmed) throw new Error('Deletion must be confirmed');
  const r = await pool.query('SELECT * FROM clinics WHERE id=$1', [id]);
  const clinic = r.rows[0];
  if (!clinic) throw new Error('Clinic not found');
  await pool.query('DELETE FROM clinics WHERE id=$1', [id]);
  await writeAudit({ entityType: 'clinic', entityId: id, action: 'delete', actorId, actorRole, eventData: { reason }, snapshot: clinic, correlationId });
  return clinic;
}

module.exports = { createClinic, getClinic, updateClinic, deleteClinic };
