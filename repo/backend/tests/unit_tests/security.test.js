const { isSessionExpiredByInactivity, isLocked } = require('../../src/services/security');

describe('security session', () => {
  it('expires after 20 min', () => {
    expect(isSessionExpiredByInactivity(new Date(Date.now()-21*60*1000).toISOString(), 20)).toBe(true);
  });
  it('marks account locked when lockout is in the future', () => {
    expect(isLocked(new Date(Date.now() + 60 * 1000).toISOString())).toBe(true);
  });
});
