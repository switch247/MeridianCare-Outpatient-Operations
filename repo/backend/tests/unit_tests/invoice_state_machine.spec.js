const { isInvoiceActionAllowed } = require('../../src/services/invoice_state_machine');

describe('invoice state machine', () => {
  it('allows manual payment and cancellation from unpaid only', () => {
    expect(isInvoiceActionAllowed('unpaid', 'pay')).toBe(true);
    expect(isInvoiceActionAllowed('unpaid', 'cancel')).toBe(true);
    expect(isInvoiceActionAllowed('paid', 'pay')).toBe(false);
    expect(isInvoiceActionAllowed('cancelled', 'cancel')).toBe(false);
  });
});
