const { isActionAllowed, computeDispenseOutcome } = require('../../src/services/prescription_state_machine');

describe('prescription state machine', () => {
  it('allows only valid transitions', () => {
    expect(isActionAllowed('pending', 'approve', 0)).toBe(true);
    expect(isActionAllowed('pending', 'dispense', 0)).toBe(false);
    expect(isActionAllowed('approved', 'dispense', 0)).toBe(true);
    expect(isActionAllowed('dispensed', 'void', 10)).toBe(false);
    expect(isActionAllowed('partially_dispensed', 'void', 1)).toBe(false);
  });

  it('computes partial and full dispense outcomes', () => {
    const partial = computeDispenseOutcome(10, 0, 4);
    expect(partial.ok).toBe(true);
    expect(partial.nextState).toBe('partially_dispensed');
    expect(partial.totalDispensed).toBe(4);

    const full = computeDispenseOutcome(10, 4, 6);
    expect(full.ok).toBe(true);
    expect(full.nextState).toBe('dispensed');
    expect(full.totalDispensed).toBe(10);

    const invalid = computeDispenseOutcome(10, 8, 3);
    expect(invalid.ok).toBe(false);
  });
});
