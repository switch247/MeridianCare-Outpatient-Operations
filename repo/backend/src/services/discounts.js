function applyDiscounts(lines, planPercent = 0, couponAmount = 0, thresholdRule = { threshold: 200, off: 25 }) {
  for (const line of lines) if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Quantity must be a positive integer');
  const subtotal = lines.reduce((a, l) => a + Number(l.unitPrice) * l.quantity, 0);
  const planDiscount = subtotal * (Number(planPercent) / 100);
  const afterPlan = subtotal - planDiscount;
  const couponDiscount = Math.min(Number(couponAmount), afterPlan);
  const afterCoupon = afterPlan - couponDiscount;
  const thresholdDiscount = afterCoupon >= Number(thresholdRule.threshold) ? Number(thresholdRule.off) : 0;
  return { subtotal, planDiscount, couponDiscount, thresholdDiscount, total: Math.max(0, afterCoupon - thresholdDiscount) };
}
module.exports = { applyDiscounts };
