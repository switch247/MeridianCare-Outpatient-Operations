const { findHighSeverityConflict } = require('../../src/services/allergy');

describe('allergy conflict detection', () => {
  it('returns high severity conflict from allergies', () => {
    const patient = { allergies: [{ drug: 'amoxicillin', severity: 'high' }], contraindications: [] };
    const c = findHighSeverityConflict(patient, 'Amoxicillin');
    expect(c).toBeTruthy();
  });

  it('ignores non-high severity entries', () => {
    const patient = { allergies: [{ drug: 'amoxicillin', severity: 'medium' }], contraindications: [] };
    const c = findHighSeverityConflict(patient, 'Amoxicillin');
    expect(c).toBeNull();
  });
});
