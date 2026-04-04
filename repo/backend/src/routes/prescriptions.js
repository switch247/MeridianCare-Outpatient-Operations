const { pool } = require('../db');
const { writeAudit } = require('../lib/audit');
const { can } = require('../lib/rbac');
const { verifyPassword } = require('../services/security');
const { findHighSeverityConflict } = require('../services/allergy');
const { isActionAllowed, computeDispenseOutcome } = require('../services/prescription_state_machine');
const logger = require('../lib/logger');

async function prescriptionsRoutes(fastify, opts) {
  const isAdmin = (request) => request.user && request.user.role === 'admin';
  const requireClinicContext = (request, reply) => {
    if (!request.user || !request.user.clinic_id) {
      reply.code(403).send({ code: 403, msg: 'Clinic scope required' });
      return false;
    }
    return true;
  };

  fastify.post('/api/prescriptions', { preHandler: [opts.permit('prescription:write')] }, async (request, reply) => {
    logger.info(['handler','prescriptions:create'], `create prescription by ${request.user && request.user.username}`);
    if (!requireClinicContext(request, reply)) return;
    const b = request.body || {};
    const p = await pool.query('SELECT * FROM patients WHERE id=$1 AND clinic_id=$2', [b.patientId, request.user.clinic_id]);
    const patient = p.rows[0];
    if (!patient) return reply.code(404).send({ code: 404, msg: 'Patient not found' });
    const conflict = findHighSeverityConflict(patient, b.drugName);
    if (conflict && (!b.overrideReason || !b.reauthPassword)) return reply.code(409).send({ code: 409, msg: 'High-severity conflict: override reason and re-auth required' });
    if (conflict) {
      const valid = await verifyPassword(b.reauthPassword, request.user.password_hash);
      if (!valid) return reply.code(401).send({ code: 401, msg: 'Invalid re-auth password' });
    }
    const r = await pool.query(
      'INSERT INTO prescriptions(encounter_id,patient_id,prescriber_id,drug_name,dose,route,quantity,instructions,override_reason,state,clinic_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [b.encounterId, b.patientId, request.user.id, b.drugName, b.dose, b.route, b.quantity, b.instructions, b.overrideReason || null, 'pending', request.user.clinic_id],
    );
    await writeAudit({ entityType: 'prescription', entityId: r.rows[0].id, action: 'submit', actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: r.rows[0], correlationId: request.requestId });
    logger.info(['handler','prescriptions:create','created'], `prescription=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.get('/api/pharmacy/queue', { preHandler: [opts.permit('prescription:review')] }, async (request, reply) => {
    if (!requireClinicContext(request, reply)) return;
    const rows = await pool.query(
      `SELECT p.id,
              p.state,
              p.instructions,
              p.quantity,
              p.dispensed_quantity,
              p.drug_name,
              p.version,
              inv.id AS inventory_item_id,
              COALESCE(inv.on_hand, 0) AS inventory_available,
              COALESCE(inv.lot_tracking, FALSE) AS lot_tracking,
              COALESCE(inv.serial_tracking, FALSE) AS serial_tracking
       FROM prescriptions p
       LEFT JOIN LATERAL (
         SELECT id,on_hand,lot_tracking,serial_tracking
         FROM inventory_items
         WHERE LOWER(name)=LOWER(p.drug_name)
         ORDER BY on_hand DESC
         LIMIT 1
       ) inv ON TRUE
       WHERE p.clinic_id=$1
       ORDER BY p.updated_at DESC`,
      [request.user.clinic_id],
    )
    return rows.rows;
  });

  fastify.post('/api/pharmacy/:id/action', { preHandler: [opts.permit('prescription:approve')] }, async (request, reply) => {
    logger.info(['handler','prescriptions:action'], `action ${request.body && request.body.action} on ${request.params.id} by ${request.user && request.user.username}`);
    if (!requireClinicContext(request, reply)) return;
    const b = request.body || {};
    const r = await pool.query('SELECT * FROM prescriptions WHERE id=$1 AND clinic_id=$2', [request.params.id, request.user.clinic_id]);
    const rx = r.rows[0];
    if (!rx) return reply.code(404).send({ code: 404, msg: 'Prescription not found' });
    const actionPerm = b.action === 'approve' ? 'prescription:approve' : b.action === 'dispense' ? 'prescription:dispense' : b.action === 'void' ? 'prescription:void' : null;
    if (!actionPerm || !can(request.user.role, actionPerm)) return reply.code(403).send({ code: 403, msg: 'Forbidden' });
    if (b.expectedVersion && Number(b.expectedVersion) !== rx.version) return reply.code(409).send({ code: 409, msg: 'Version conflict on prescription' });
    if (b.action === 'void' && Number(rx.dispensed_quantity) > 0) return reply.code(400).send({ code: 400, msg: 'Void disallowed after dispensing' });
    if (b.action === 'void' && !b.reason) return reply.code(400).send({ code: 400, msg: 'Void reason required' });
    if (!isActionAllowed(rx.state, b.action, rx.dispensed_quantity)) {
      return reply.code(400).send({ code: 400, msg: `Action ${b.action} is not allowed from state ${rx.state}` });
    }
    const next = b.action === 'approve' ? 'approved' : b.action === 'void' ? 'voided' : null;

    if (b.action === 'dispense') {
      const dispenseQty = Number(b.dispenseQuantity || (rx.quantity - Number(rx.dispensed_quantity || 0)));
      if (!Number.isInteger(dispenseQty) || dispenseQty < 1) {
        return reply.code(400).send({ code: 400, msg: 'Dispense quantity must be a positive integer' });
      }
      const itemId = b.inventoryItemId;
      if (!itemId) return reply.code(400).send({ code: 400, msg: 'inventoryItemId is required for dispense' });
      const outcome = computeDispenseOutcome(rx.quantity, rx.dispensed_quantity || 0, dispenseQty);
      if (!outcome.ok) return reply.code(400).send({ code: 400, msg: outcome.msg });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lockedItemRes = await client.query('SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE', [itemId]);
        const item = lockedItemRes.rows[0];
        if (!item) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ code: 404, msg: 'Inventory item not found' });
        }
        if (item.lot_tracking && !b.lot) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ code: 400, msg: 'Lot is required for this inventory item' });
        }
        if (item.serial_tracking && !b.serial) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ code: 400, msg: 'Serial is required for this inventory item' });
        }
        if (Number(item.on_hand) < dispenseQty) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ code: 400, msg: 'Insufficient inventory for dispense' });
        }
        const nextOnHand = Number(item.on_hand) - dispenseQty;
        await client.query('UPDATE inventory_items SET on_hand=$1 WHERE id=$2', [nextOnHand, itemId]);
        await client.query(
          'INSERT INTO inventory_movements(item_id,movement_type,quantity,ref_type,ref_id,lot,serial,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [itemId, 'dispense', dispenseQty, 'prescription', rx.id, b.lot || null, b.serial || null, b.reason || null, request.user.id],
        );
        const upd = await client.query(
          'UPDATE prescriptions SET state=$1,dispensed_quantity=$2,version=version+1,updated_at=NOW() WHERE id=$3 AND clinic_id=$4 RETURNING *',
          [outcome.nextState, outcome.totalDispensed, rx.id, request.user.clinic_id],
        );
        if (!upd.rows[0]) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ code: 404, msg: 'Prescription not found' });
        }
        await client.query('COMMIT');
        await writeAudit({
          entityType: 'prescription',
          entityId: rx.id,
          action: b.action,
          actorId: request.user.id,
          actorRole: request.user.role,
          eventData: b,
          snapshot: upd.rows[0],
          correlationId: request.requestId,
        });
        return upd.rows[0];
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const upd = await pool.query(
      'UPDATE prescriptions SET state=$1,version=version+1,updated_at=NOW() WHERE id=$2 AND clinic_id=$3 RETURNING *',
      [next, rx.id, request.user.clinic_id],
    );
    if (!upd.rows[0]) return reply.code(404).send({ code: 404, msg: 'Prescription not found' });
    await writeAudit({ entityType: 'prescription', entityId: rx.id, action: b.action, actorId: request.user.id, actorRole: request.user.role, eventData: b, snapshot: upd.rows[0], correlationId: request.requestId });
    return upd.rows[0];
  });

  fastify.get('/api/pharmacy/:id/movements', { preHandler: [opts.permit('prescription:review')] }, async (request, reply) => {
    if (!requireClinicContext(request, reply)) return;
    const rxRes = await pool.query('SELECT id FROM prescriptions WHERE id=$1 AND clinic_id=$2', [request.params.id, request.user.clinic_id]);
    if (!rxRes.rows[0]) return reply.code(404).send({ code: 404, msg: 'Prescription not found' });
    const rows = await pool.query(
      "SELECT id,movement_type,quantity,item_id,lot,serial,reason,created_at FROM inventory_movements WHERE ref_type='prescription' AND ref_id=$1 ORDER BY created_at DESC",
      [request.params.id],
    );
    return rows.rows;
  });

  fastify.post('/api/pharmacy/:id/return', { preHandler: [opts.permit('prescription:dispense')] }, async (request, reply) => {
    if (!requireClinicContext(request, reply)) return;
    const b = request.body || {};
    if (!b.originalMovementId) return reply.code(400).send({ code: 400, msg: 'originalMovementId is required' });
    if (!Number.isInteger(b.quantity) || b.quantity < 1) return reply.code(400).send({ code: 400, msg: 'Return quantity must be a positive integer' });
    if (!b.reason) return reply.code(400).send({ code: 400, msg: 'Return reason is required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const movementRes = await client.query(
        "SELECT mv.* FROM inventory_movements mv JOIN prescriptions p ON p.id=mv.ref_id WHERE mv.id=$1 AND mv.ref_type='prescription' AND mv.ref_id=$2 AND mv.movement_type='dispense' AND p.clinic_id=$3",
        [b.originalMovementId, request.params.id, request.user.clinic_id],
      );
      const movement = movementRes.rows[0];
      if (!movement) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ code: 404, msg: 'Original dispense movement not found' });
      }
      if (b.quantity > Number(movement.quantity)) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ code: 400, msg: 'Return quantity cannot exceed original dispense quantity' });
      }
      const itemRes = await client.query('SELECT * FROM inventory_items WHERE id=$1 FOR UPDATE', [movement.item_id]);
      const item = itemRes.rows[0];
      if (!item) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ code: 404, msg: 'Inventory item not found' });
      }
      const nextOnHand = Number(item.on_hand) + Number(b.quantity);
      await client.query('UPDATE inventory_items SET on_hand=$1 WHERE id=$2', [nextOnHand, item.id]);
      const retRes = await client.query(
        'INSERT INTO inventory_movements(item_id,movement_type,quantity,ref_type,ref_id,lot,serial,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [item.id, 'return', b.quantity, 'dispense_movement', movement.id, movement.lot || null, movement.serial || null, b.reason, request.user.id],
      );
      await client.query('COMMIT');
      await writeAudit({
        entityType: 'prescription',
        entityId: request.params.id,
        action: 'return',
        actorId: request.user.id,
        actorRole: request.user.role,
        eventData: b,
        snapshot: retRes.rows[0],
        correlationId: request.requestId,
      });
      return { movement: retRes.rows[0], onHand: nextOnHand };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
}

module.exports = prescriptionsRoutes;
