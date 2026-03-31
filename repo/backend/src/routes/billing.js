const { pool } = require('../db');
const { applyDiscounts } = require('../services/discounts');
const { isInvoiceActionAllowed } = require('../services/invoice_state_machine');
const logger = require('../lib/logger');

const ALLOWED_LINE_TYPES = new Set(['visit_code', 'procedure', 'dispense_fee', 'retail', 'shipping']);
const ZIP_RE = /^\d{5}(-\d{4})?$/;

function ensureValidLines(lines) {
  for (const line of lines || []) {
    if (!line.chargeType || !ALLOWED_LINE_TYPES.has(line.chargeType)) {
      throw new Error('Invalid chargeType');
    }
    if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1) {
      throw new Error('Quantity must be a positive integer');
    }
    if (Number(line.unitPrice) < 0) {
      throw new Error('unitPrice must be non-negative');
    }
  }
}

async function resolveShipping(shipping) {
  if (!shipping || shipping.deliveryType !== 'home_delivery') {
    return { details: { deliveryType: 'pickup' }, shippingLine: null };
  }
  if (!shipping.addressLine1 || !shipping.city || !shipping.state || !shipping.zip || !shipping.zone) {
    throw new Error('Home delivery requires addressLine1, city, state, zip, and zone');
  }
  if (!ZIP_RE.test(String(shipping.zip))) {
    throw new Error('Invalid US ZIP code');
  }
  const tplRes = await pool.query('SELECT * FROM shipping_templates WHERE active=true AND zone=$1', [shipping.zone]);
  const tpl = tplRes.rows[0];
  if (!tpl) throw new Error('Shipping zone template not found');
  const shippingLine = {
    chargeType: 'shipping',
    description: `Shipping ${tpl.zone}`,
    quantity: 1,
    unitPrice: Number(tpl.flat_fee),
  };
  return {
    shippingLine,
    details: {
      deliveryType: 'home_delivery',
      zone: tpl.zone,
      fee: Number(tpl.flat_fee),
      carrier: shipping.carrier || null,
      trackingNumber: shipping.trackingNumber || null,
      addressLine1: shipping.addressLine1,
      addressLine2: shipping.addressLine2 || null,
      city: shipping.city,
      state: shipping.state,
      zip: shipping.zip,
    },
  };
}

async function billingRoutes(fastify, opts) {
  fastify.post('/api/billing/price', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    logger.info(['handler', 'billing:price'], `price calc requested by ${request.user && request.user.username}`);
    try {
      const baseLines = request.body && request.body.lines ? request.body.lines : [];
      ensureValidLines(baseLines);
      const shipping = await resolveShipping((request.body || {}).shipping);
      const lines = shipping.shippingLine ? [...baseLines, shipping.shippingLine] : baseLines;
      return {
        ...applyDiscounts(lines, request.body.planPercent, request.body.couponAmount, request.body.thresholdRule),
        shipping: shipping.details,
      };
    } catch (e) {
      logger.error(['handler', 'billing:price', 'error'], e.message);
      return reply.code(400).send({ code: 400, msg: e.message });
    }
  });

  fastify.post('/api/invoices', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    logger.info(['handler', 'billing:invoice:create'], `create invoice by ${request.user && request.user.username}`);
    try {
      const b = request.body || {};
      const baseLines = b.lines || [];
      ensureValidLines(baseLines);
      const shipping = await resolveShipping(b.shipping);
      const lines = shipping.shippingLine ? [...baseLines, shipping.shippingLine] : baseLines;
      const price = applyDiscounts(lines, b.planPercent, b.couponAmount, b.thresholdRule);
      const r = await pool.query(
        `INSERT INTO invoices(patient_id,lines,subtotal,plan_discount,coupon_discount,threshold_discount,total,state,payment_ref,payment_metadata,shipping_details,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          b.patientId,
          JSON.stringify(lines),
          price.subtotal,
          price.planDiscount,
          price.couponDiscount,
          price.thresholdDiscount,
          price.total,
          'unpaid',
          null,
          JSON.stringify({ manualOnly: true }),
          JSON.stringify(shipping.details),
          request.user.id,
        ],
      );
      logger.info(['handler', 'billing:invoice:create', 'created'], `invoice=${r.rows[0].id}`);
      reply.code(201);
      return r.rows[0];
    } catch (e) {
      return reply.code(400).send({ code: 400, msg: e.message });
    }
  });

  fastify.get('/api/invoices', { preHandler: [opts.permit('billing:write')] }, async () => (
    await pool.query(
      `SELECT i.id,i.patient_id,i.lines,i.subtotal,i.total,i.state,i.version,i.created_at,i.payment_ref,i.payment_metadata,i.shipping_details,p.name AS patient_name
       FROM invoices i
       JOIN patients p ON p.id=i.patient_id
       ORDER BY i.id DESC`,
    )
  ).rows);

  fastify.get('/api/invoices/:id', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    const result = await pool.query(
      `SELECT i.*,p.name AS patient_name
       FROM invoices i
       JOIN patients p ON p.id=i.patient_id
       WHERE i.id=$1`,
      [request.params.id],
    );
    if (!result.rows[0]) return reply.code(404).send({ code: 404, msg: 'Invoice not found' });
    return result.rows[0];
  });

  fastify.post('/api/invoices/:id/payment', { preHandler: [opts.permit('invoice:payment')] }, async (request, reply) => {
    logger.info(['handler', 'billing:payment'], `payment for ${request.params.id} by ${request.user && request.user.username}`);
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE id=$1', [request.params.id]);
    const invoice = invoiceRes.rows[0];
    if (!invoice) return reply.code(404).send({ code: 404, msg: 'Invoice not found' });
    if (!isInvoiceActionAllowed(invoice.state, 'pay')) {
      return reply.code(400).send({ code: 400, msg: `Cannot pay invoice in state ${invoice.state}` });
    }
    if ((request.body || {}).expectedVersion && Number(request.body.expectedVersion) !== invoice.version) {
      return reply.code(409).send({ code: 409, msg: 'Version conflict on invoice' });
    }
    const tenderType = (request.body || {}).tenderType;
    if (!tenderType) return reply.code(400).send({ code: 400, msg: 'tenderType is required for manual payment' });
    const r = await pool.query(
      'UPDATE invoices SET state=$1,payment_ref=$2,payment_metadata=$3,version=version+1 WHERE id=$4 RETURNING *',
      ['paid', (request.body || {}).reference || null, JSON.stringify({ manualOnly: true, tenderType }), request.params.id],
    );
    return r.rows[0];
  });

  fastify.post('/api/invoices/:id/cancel', { preHandler: [opts.permit('billing:write')] }, async (request, reply) => {
    const invoiceRes = await pool.query('SELECT * FROM invoices WHERE id=$1', [request.params.id]);
    const invoice = invoiceRes.rows[0];
    if (!invoice) return reply.code(404).send({ code: 404, msg: 'Invoice not found' });
    if (!isInvoiceActionAllowed(invoice.state, 'cancel')) {
      return reply.code(400).send({ code: 400, msg: `Cannot cancel invoice in state ${invoice.state}` });
    }
    if ((request.body || {}).expectedVersion && Number(request.body.expectedVersion) !== invoice.version) {
      return reply.code(409).send({ code: 409, msg: 'Version conflict on invoice' });
    }
    const updated = await pool.query('UPDATE invoices SET state=$1,version=version+1 WHERE id=$2 RETURNING *', ['cancelled', invoice.id]);
    return updated.rows[0];
  });

  fastify.get('/api/shipping/templates', { preHandler: [opts.permit('billing:write')] }, async () => {
    const result = await pool.query('SELECT * FROM shipping_templates WHERE active=true ORDER BY zone');
    return result.rows;
  });
}

module.exports = billingRoutes;
