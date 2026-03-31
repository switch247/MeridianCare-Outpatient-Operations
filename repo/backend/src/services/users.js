const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const { hashPassword } = require('./security');

async function createUser({ username, password, role, clinicId, actorId, actorRole, correlationId }) {
  const pwHash = await hashPassword(password);
  const r = await pool.query('INSERT INTO users(username,password_hash,role,clinic_id,last_active_at) VALUES($1,$2,$3,$4,NOW()) RETURNING id,username,role,clinic_id', [username, pwHash, role, clinicId || null]);
  const user = r.rows[0];
  await writeAudit({ entityType: 'user', entityId: user.id, action: 'create', actorId, actorRole, eventData: { username, role, clinicId }, snapshot: user, correlationId });
  return user;
}

async function listUsers({ clinicId }) {
  if (clinicId) {
    const r = await pool.query('SELECT id,username,role,clinic_id,failed_attempts,lockout_until,created_at FROM users WHERE clinic_id=$1 ORDER BY created_at DESC', [clinicId]);
    return r.rows;
  }
  const r = await pool.query('SELECT id,username,role,clinic_id,failed_attempts,lockout_until,created_at FROM users ORDER BY created_at DESC');
  return r.rows;
}

async function getUser(id) {
  const r = await pool.query('SELECT id,username,role,clinic_id,failed_attempts,lockout_until,created_at FROM users WHERE id=$1', [id]);
  return r.rows[0] || null;
}

async function updateUser(id, { username, role, clinicId, correlationId }, actorId, actorRole) {
  const r = await pool.query('UPDATE users SET username=$1,role=$2,clinic_id=$3 WHERE id=$4 RETURNING id,username,role,clinic_id,created_at', [username, role, clinicId || null, id]);
  const user = r.rows[0];
  await writeAudit({ entityType: 'user', entityId: id, action: 'update', actorId, actorRole, eventData: { username, role, clinicId }, snapshot: user, correlationId });
  return user;
}

async function deleteUser(id, { confirmed, reason, correlationId }, actorId, actorRole) {
  if (!confirmed) throw new Error('Deletion must be confirmed');
  const r0 = await pool.query('SELECT id,username,role,clinic_id,created_at FROM users WHERE id=$1', [id]);
  const existing = r0.rows[0];
  if (!existing) throw new Error('User not found');
  await pool.query('DELETE FROM users WHERE id=$1', [id]);
  await writeAudit({ entityType: 'user', entityId: id, action: 'delete', actorId, actorRole, eventData: { reason }, snapshot: existing, correlationId });
  return existing;
}

module.exports = { createUser, listUsers, getUser, updateUser, deleteUser };
