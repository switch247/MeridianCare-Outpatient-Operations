const { pool } = require('../db');
async function writeAudit({ entityType, entityId, action, actorId, actorRole, eventData, snapshot, correlationId }) {
  const payload = Object.assign({}, eventData || {});
  if (correlationId) payload._correlationId = correlationId;
  await pool.query('INSERT INTO audit_events(entity_type,entity_id,action,actor_id,actor_role,event_data,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)', [entityType, entityId, action, actorId, actorRole, JSON.stringify(payload||{}), JSON.stringify(snapshot||{})]);
}
module.exports = { writeAudit };
