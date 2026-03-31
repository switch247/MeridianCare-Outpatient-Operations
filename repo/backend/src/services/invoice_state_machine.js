const ALLOWED = {
  unpaid: new Set(['pay', 'cancel']),
  paid: new Set([]),
  cancelled: new Set([]),
};

function isInvoiceActionAllowed(state, action) {
  return !!(ALLOWED[state] && ALLOWED[state].has(action));
}

module.exports = { isInvoiceActionAllowed };
