const { applyDiscounts } = require('../../src/services/discounts');

describe('discount ordering', () => {
  it('applies fixed order', () => {
    const r = applyDiscounts([{ quantity:2, unitPrice:120 }],10,20,{ threshold:200, off:25 });
    expect(r.total).toBe(196);
  });
  it('rejects non-positive quantities', () => {
    expect(() => applyDiscounts([{ quantity: 0, unitPrice: 120 }], 0, 0, { threshold: 200, off: 25 })).toThrow(
      'Quantity must be a positive integer',
    );
  });
});
