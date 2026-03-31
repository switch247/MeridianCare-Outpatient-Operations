const ACTIONS = ['approve', 'dispense', 'void'];

const ALLOWED_TRANSITIONS = {
  pending: new Set(['approve', 'void']),
  approved: new Set(['dispense', 'void']),
  partially_dispensed: new Set(['dispense']),
  dispensed: new Set([]),
  voided: new Set([]),
};

function isActionAllowed(currentState, action, dispensedQuantity = 0) {
  if (!ACTIONS.includes(action)) return false;
  if (action === 'void' && Number(dispensedQuantity) > 0) return false;
  return !!(ALLOWED_TRANSITIONS[currentState] && ALLOWED_TRANSITIONS[currentState].has(action));
}

function computeDispenseOutcome(prescribedQty, alreadyDispensed, newDispenseQty) {
  const total = Number(alreadyDispensed) + Number(newDispenseQty);
  if (total > Number(prescribedQty)) {
    return { ok: false, msg: 'Dispense quantity exceeds prescribed total' };
  }
  if (total === Number(prescribedQty)) {
    return { ok: true, nextState: 'dispensed', totalDispensed: total };
  }
  return { ok: true, nextState: 'partially_dispensed', totalDispensed: total };
}

module.exports = {
  isActionAllowed,
  computeDispenseOutcome,
};
