const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const { hashPassword } = require('./security');
const { encrypt } = require('../utils/crypto');
const { env } = require('../config');

async function createUser({ username, password, role, clinicId, actorId, actorRole, correlationId }) {
  const pwHash = await hashPassword(password);
  const usernameEncrypted = encrypt(username, env.PHI_KEY);
  const r = await pool.query('INSERT INTO users(username,username_encrypted,password_hash,role,clinic_id,last_active_at) VALUES($1,$2,$3,$4,$5,NOW()) RETURNING id,username,role,clinic_id', [username, usernameEncrypted, pwHash, role, clinicId || null]);
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

async function getUser(id, { clinicId = null, isAdmin = false } = {}) {
  const scoped = !isAdmin && !!clinicId;
  const sql = (!scoped)
    ? 'SELECT id,username,role,clinic_id,failed_attempts,lockout_until,created_at FROM users WHERE id=$1'
    : 'SELECT id,username,role,clinic_id,failed_attempts,lockout_until,created_at FROM users WHERE id=$1 AND clinic_id=$2';
  const params = scoped ? [id, clinicId] : [id];
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}

async function updateUser(id, { username, role, clinicId, correlationId, scopeClinicId = null, isAdmin = false }, actorId, actorRole) {
  const scoped = !isAdmin && !!scopeClinicId;
  const usernameEncrypted = encrypt(username, env.PHI_KEY);
  const sql = (!scoped)
    ? 'UPDATE users SET username=$1,username_encrypted=$2,role=$3,clinic_id=$4 WHERE id=$5 RETURNING id,username,role,clinic_id,created_at'
    : 'UPDATE users SET username=$1,username_encrypted=$2,role=$3,clinic_id=$4 WHERE id=$5 AND clinic_id=$6 RETURNING id,username,role,clinic_id,created_at';
  const params = scoped
    ? [username, usernameEncrypted, role, clinicId || null, id, scopeClinicId]
    : [username, usernameEncrypted, role, clinicId || null, id];
  const r = await pool.query(sql, params);
  const user = r.rows[0];
  if (!user) return null;
  await writeAudit({ entityType: 'user', entityId: id, action: 'update', actorId, actorRole, eventData: { username, role, clinicId }, snapshot: user, correlationId });
  return user;
}

async function deleteUser(id, { confirmed, reason, correlationId, scopeClinicId = null, isAdmin = false }, actorId, actorRole) {
  if (!confirmed) throw new Error('Deletion must be confirmed');
  const scoped = !isAdmin && !!scopeClinicId;
  const r0 = await pool.query(
    (!scoped)
      ? 'SELECT id,username,role,clinic_id,created_at FROM users WHERE id=$1'
      : 'SELECT id,username,role,clinic_id,created_at FROM users WHERE id=$1 AND clinic_id=$2',
    scoped ? [id, scopeClinicId] : [id],
  );
  const existing = r0.rows[0];
  if (!existing) throw new Error('User not found');
  await pool.query(
    scoped ? 'DELETE FROM users WHERE id=$1 AND clinic_id=$2' : 'DELETE FROM users WHERE id=$1',
    scoped ? [id, scopeClinicId] : [id],
  );
  await writeAudit({ entityType: 'user', entityId: id, action: 'delete', actorId, actorRole, eventData: { reason }, snapshot: existing, correlationId });
  return existing;
}

module.exports = { createUser, listUsers, getUser, updateUser, deleteUser };
