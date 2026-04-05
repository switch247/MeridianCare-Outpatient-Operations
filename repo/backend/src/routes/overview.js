const { pool } = require('../db');
const logger = require('../lib/logger');

async function overviewRoutes(fastify, opts) {
  const isClinicalRole = (role) => {
    const normalized = String(role || '').toUpperCase();
    return normalized === 'PHYSICIAN' || normalized === 'NURSE';
  };
  const maskPatientName = (name) => {
    const value = String(name || '').trim();
    if (!value) return value;
    const parts = value.split(/\s+/).filter(Boolean);
    return parts.map((part) => `${part[0]}${'*'.repeat(Math.max(2, part.length - 1))}`).join(' ');
  };

  fastify.get('/api/overview', { preHandler: [opts.permit('overview:read')] }, async (request) => {
    logger.info(['handler', 'overview'], 'overview requested');

    // Full KPI computation
    const invoicesRes = await pool.query('SELECT COUNT(*)::int AS count FROM invoices');
    const paidRes = await pool.query("SELECT COUNT(*)::int AS count FROM invoices WHERE state='paid'");
    const rxRes = await pool.query('SELECT COUNT(*)::int AS count FROM prescriptions');
    const dispensedRes = await pool.query("SELECT COUNT(*)::int AS count FROM prescriptions WHERE state='dispensed'");
    const cancelledRes = await pool.query("SELECT COUNT(*)::int AS count FROM prescriptions WHERE state='voided'");
    const fulfillmentRes = await pool.query(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (dispense_at - submit_at)) / 60.0), 0) AS avg_minutes
       FROM (
         SELECT
           entity_id,
           MIN(CASE WHEN action='submit' THEN created_at END) AS submit_at,
           MIN(CASE WHEN action='dispense' THEN created_at END) AS dispense_at
         FROM audit_events
         WHERE entity_type='prescription'
         GROUP BY entity_id
       ) t
       WHERE submit_at IS NOT NULL AND dispense_at IS NOT NULL AND dispense_at >= submit_at`,
    );
    const encounterRes = await pool.query('SELECT COUNT(*)::int AS count FROM encounters');
    const patientsRes = await pool.query('SELECT COUNT(*)::int AS count FROM patients');
    const inventoryLowRes = await pool.query('SELECT COUNT(*)::int AS count FROM inventory_items WHERE on_hand <= low_stock_threshold');

    const orderVolume = Number(invoicesRes.rows[0].count);
    const paidCount = Number(paidRes.rows[0].count);
    const rxCount = Number(rxRes.rows[0].count);
    const dispensedCount = Number(dispensedRes.rows[0].count);
    const cancelledCount = Number(cancelledRes.rows[0].count);
    const acceptanceRate = rxCount === 0 ? 0 : dispensedCount / rxCount;
    const cancellationRate = rxCount === 0 ? 0 : cancelledCount / rxCount;
    const fulfillmentTimeMinutes = Number(fulfillmentRes.rows[0].avg_minutes || 0);

    // Recent operations
    const recentAudits = (
      await pool.query('SELECT id,action,event_data,created_at FROM audit_events ORDER BY created_at DESC LIMIT 10')
    ).rows;
    const recentInvoices = (
      await pool.query(
        `SELECT i.id,p.name AS patient_name,i.total,i.state,i.created_at
         FROM invoices i
         JOIN patients p ON p.id=i.patient_id
         ORDER BY i.created_at DESC
         LIMIT 10`,
      )
    ).rows;
    const recentInventory = (
      await pool.query('SELECT id,sku,name,on_hand FROM inventory_items ORDER BY name ASC LIMIT 10')
    ).rows;

    const recent = [];
    const shouldMaskInvoicePatients = !isClinicalRole(request.user && request.user.role);
    recentAudits.forEach((r) => recent.push({ type: 'audit', id: r.id, when: r.created_at, summary: r.action }));
    recentInvoices.forEach((r) => {
      const patientName = shouldMaskInvoicePatients ? maskPatientName(r.patient_name) : r.patient_name;
      recent.push({ type: 'invoice', id: r.id, when: r.created_at, summary: `${patientName || '-'} $${r.total}` });
    });
    recentInventory.forEach((r) => recent.push({ type: 'inventory', id: r.id, when: new Date().toISOString(), summary: `${r.sku || ''} ${r.name || ''}` }));

    recent.sort((a, b) => new Date(b.when) - new Date(a.when));

    return {
      kpis: {
        orderVolume,
        paidInvoices: paidCount,
        totalPrescriptions: rxCount,
        dispensedPrescriptions: dispensedCount,
        acceptanceRate: Number(acceptanceRate.toFixed(3)),
        fulfillmentTimeMinutes: Number(fulfillmentTimeMinutes.toFixed(2)),
        cancellationRate: Number(cancellationRate.toFixed(3)),
        totalEncounters: Number(encounterRes.rows[0].count),
        totalPatients: Number(patientsRes.rows[0].count),
        lowStockItems: Number(inventoryLowRes.rows[0].count),
      },
      recentOperations: recent.slice(0, 12),
    };
  });
}

module.exports = overviewRoutes;
