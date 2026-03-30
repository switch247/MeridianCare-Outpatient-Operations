const { pool } = require('../db');
const { applyDiscounts } = require('../services/discounts');
const logger = require('../lib/logger');

async function billingRoutes(fastify, opts) {
  fastify.post('/api/billing/price', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    logger.info(['handler','billing:price'], `price calc requested by ${request.user && request.user.username}`);
    try { return applyDiscounts(request.body.lines || [], request.body.planPercent, request.body.couponAmount, request.body.thresholdRule); }
    catch (e) { logger.error(['handler','billing:price','error'], e.message); return reply.code(400).send({ code: 400, msg: e.message }); }
  });

  fastify.post('/api/invoices', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    logger.info(['handler','billing:invoice:create'], `create invoice by ${request.user && request.user.username}`);
    const b = request.body || {}; const price = applyDiscounts(b.lines || [], b.planPercent, b.couponAmount, b.thresholdRule);
    const r = await pool.query('INSERT INTO invoices(patient_id,lines,subtotal,plan_discount,coupon_discount,threshold_discount,total,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [b.patientId, JSON.stringify(b.lines || []), price.subtotal, price.planDiscount, price.couponDiscount, price.thresholdDiscount, price.total, 'unpaid']);
    logger.info(['handler','billing:invoice:create','created'], `invoice=${r.rows[0].id}`);
    reply.code(201); return r.rows[0];
  });

  fastify.post('/api/invoices/:id/payment', { preHandler: [opts.permit('invoice:payment')] }, async (request, reply) => {
    logger.info(['handler','billing:payment'], `payment for ${request.params.id} by ${request.user && request.user.username}`);
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE id=$1', [request.params.id]);
    const invoice = invoiceRes.rows[0];
    if (!invoice) return reply.code(404).send({ code: 404, msg: 'Invoice not found' });
    if ((request.body || {}).expectedVersion && Number(request.body.expectedVersion) !== invoice.version) {
      return reply.code(409).send({ code: 409, msg: 'Version conflict on invoice' });
    }
    const r = await pool.query('UPDATE invoices SET state=$1,payment_ref=$2,version=version+1 WHERE id=$3 RETURNING *', ['paid', (request.body || {}).reference || null, request.params.id]);
    return r.rows[0];
  });

  fastify.get('/api/shipping/templates', { preHandler: [opts.permit('billing:write')] }, async () => {
    const result = await pool.query('SELECT * FROM shipping_templates WHERE active=true ORDER BY zone');
    return result.rows;
  });
}

module.exports = billingRoutes;
