const { pool } = require('../db');
const logger = require('../lib/logger');

async function overviewRoutes(fastify, opts) {
  // simple overview combining KPIs and recent operations
  fastify.get('/api/overview', { preHandler: [opts.permit('*')] }, async (request, reply) => {
    logger.info(['handler','overview'],'overview requested');
    const kpisRes = await pool.query('SELECT COUNT(*)::int AS invoices FROM invoices');
    const invoicesCount = Number((kpisRes.rows[0] && kpisRes.rows[0].invoices) || 0);

    const recentAudits = (await pool.query('SELECT id,event_type,event_data,created_at FROM audit_events ORDER BY created_at DESC LIMIT 10')).rows;
    const recentInvoices = (await pool.query('SELECT id,patient_name,total,state,created_at FROM invoices ORDER BY created_at DESC LIMIT 10')).rows;
    const recentInventory = (await pool.query('SELECT id,sku,name,on_hand,created_at FROM inventory ORDER BY created_at DESC LIMIT 10')).rows;

    const recent = [];
    recentAudits.forEach(r => recent.push({ type: 'audit', id: r.id, when: r.created_at, summary: r.event_type }));
    recentInvoices.forEach(r => recent.push({ type: 'invoice', id: r.id, when: r.created_at, summary: `${r.patient_name || '—'} $${r.total}` }));
    recentInventory.forEach(r => recent.push({ type: 'inventory', id: r.id, when: r.created_at, summary: `${r.sku || ''} ${r.name || ''}` }));

    // sort by time desc and limit
    recent.sort((a,b) => new Date(b.when) - new Date(a.when));

    return {
      kpis: {
        orderVolume: invoicesCount,
      },
      recentOperations: recent.slice(0, 12),
    };
  });
}

module.exports = overviewRoutes;
