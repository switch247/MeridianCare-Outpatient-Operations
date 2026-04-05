const assert = require('assert');
const { withToken } = require('./helper');

/**
 * Billing User Acceptance Test (UAT).
 *
 * Exercises the full billing lifecycle: price calculation with discounts,
 * invoice creation, payment, cancellation, shipping, and state machine guards.
 */
async function runBillingUat(api, sessions) {
  const physician = withToken(api, sessions.physician.token);
  const billing = withToken(api, sessions.billing.token);

  const suffix = Date.now();

  // Create a patient for billing tests
  const patient = await physician.post('/api/patients').send({
    name: `Billing UAT Patient ${suffix}`,
    ssn: '888-77-6666',
    allergies: [],
    contraindications: [],
  });
  assert.equal(patient.status, 201);

  // === Price calculation with all discount types ===
  const priceResult = await billing.post('/api/billing/price').send({
    lines: [
      { chargeType: 'visit_code', quantity: 2, unitPrice: 100 },
      { chargeType: 'procedure', quantity: 1, unitPrice: 50 },
    ],
    planPercent: 10,
    couponAmount: 15,
    thresholdRule: { threshold: 200, off: 20 },
  });
  assert.equal(priceResult.status, 200);
  assert.ok(typeof priceResult.body.total === 'number', 'Price should return a numeric total');
  assert.ok(typeof priceResult.body.subtotal === 'number', 'Price should return a numeric subtotal');
  assert.equal(priceResult.body.subtotal, 250, 'Subtotal should be 2*100 + 1*50 = 250');

  // === Invoice creation ===
  const invoice = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 200 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 500, off: 0 },
  });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.body.state, 'unpaid');
  assert.equal(Number(invoice.body.total), 200);

  // === Invoice listing ===
  const invoiceList = await billing.get('/api/invoices');
  assert.equal(invoiceList.status, 200);
  const found = (invoiceList.body || []).find((i) => i.id === invoice.body.id);
  assert.ok(found, 'Created invoice should appear in listing');

  // === Invoice detail ===
  const detail = await billing.get(`/api/invoices/${invoice.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.id, invoice.body.id);

  // === Payment (cash) ===
  const paid = await billing.post(`/api/invoices/${invoice.body.id}/payment`).send({
    expectedVersion: invoice.body.version,
    tenderType: 'cash',
    reference: `uat-cash-${suffix}`,
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.state, 'paid');

  // === Cannot pay an already-paid invoice ===
  const doublePay = await billing.post(`/api/invoices/${invoice.body.id}/payment`).send({
    tenderType: 'card',
  });
  assert.equal(doublePay.status, 400, 'Paying an already-paid invoice should fail');

  // === Cannot cancel a paid invoice ===
  const cancelPaid = await billing.post(`/api/invoices/${invoice.body.id}/cancel`).send({});
  assert.equal(cancelPaid.status, 400, 'Cancelling a paid invoice should fail');

  // === Create and cancel an unpaid invoice ===
  const invoice2 = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 75 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 500, off: 0 },
  });
  assert.equal(invoice2.status, 201);

  const cancelled = await billing.post(`/api/invoices/${invoice2.body.id}/cancel`).send({
    expectedVersion: invoice2.body.version,
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.state, 'cancelled');

  // === Cannot pay a cancelled invoice ===
  const payCancelled = await billing.post(`/api/invoices/${invoice2.body.id}/payment`).send({
    tenderType: 'cash',
  });
  assert.equal(payCancelled.status, 400, 'Paying a cancelled invoice should fail');

  // === Version conflict detection ===
  const invoice3 = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 50 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 500, off: 0 },
  });
  assert.equal(invoice3.status, 201);

  const conflictPay = await billing.post(`/api/invoices/${invoice3.body.id}/payment`).send({
    expectedVersion: 999,
    tenderType: 'cash',
  });
  assert.equal(conflictPay.status, 409, 'Version conflict should return 409');

  // === Shipping templates are available ===
  const templates = await billing.get('/api/shipping/templates');
  assert.equal(templates.status, 200);
  assert.ok(Array.isArray(templates.body), 'Shipping templates should be an array');

  // === PHI masking: billing user should see masked patient names ===
  const billingInvoiceDetail = await billing.get(`/api/invoices/${invoice.body.id}`);
  assert.equal(billingInvoiceDetail.status, 200);
  if (billingInvoiceDetail.body.patient_name) {
    assert.ok(
      String(billingInvoiceDetail.body.patient_name).includes('*'),
      'Billing user should see masked patient names',
    );
  }

  // === Payment requires tenderType ===
  const invoice4 = await billing.post('/api/invoices').send({
    patientId: patient.body.id,
    lines: [{ chargeType: 'visit_code', quantity: 1, unitPrice: 30 }],
    planPercent: 0,
    couponAmount: 0,
    thresholdRule: { threshold: 500, off: 0 },
  });
  assert.equal(invoice4.status, 201);
  const noTender = await billing.post(`/api/invoices/${invoice4.body.id}/payment`).send({});
  assert.equal(noTender.status, 400, 'Payment without tenderType should fail');
}

module.exports = { runBillingUat };
