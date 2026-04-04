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
    const kpisRes = await pool.query('SELECT COUNT(*)::int AS invoices FROM invoices');
    const invoicesCount = Number((kpisRes.rows[0] && kpisRes.rows[0].invoices) || 0);

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
        orderVolume: invoicesCount,
      },
      recentOperations: recent.slice(0, 12),
    };
  });
}

module.exports = overviewRoutes;
