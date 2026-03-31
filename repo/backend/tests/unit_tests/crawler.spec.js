const { computeBackoffSeconds, nextStage } = require('../../src/services/crawler');

describe('crawler utilities', () => {
  it('computes bounded exponential backoff', () => {
    expect(computeBackoffSeconds(0)).toBe(30);
    expect(computeBackoffSeconds(1)).toBe(60);
    expect(computeBackoffSeconds(2)).toBe(120);
    expect(computeBackoffSeconds(10)).toBe(900);
  });

  it('moves through collect->parse->store->completed', () => {
    expect(nextStage('collect')).toBe('parse');
    expect(nextStage('parse')).toBe('store');
    expect(nextStage('store')).toBe('completed');
    expect(nextStage('unknown')).toBe('completed');
  });
});
