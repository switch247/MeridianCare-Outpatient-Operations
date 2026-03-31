function findHighSeverityConflict(patient, drugName) {
  const name = String(drugName || '').toLowerCase().trim();
  const allergies = Array.isArray(patient?.allergies) ? patient.allergies : [];
  const contraindications = Array.isArray(patient?.contraindications) ? patient.contraindications : [];
  return [...allergies, ...contraindications].find((entry) => {
    const entryDrug = String(entry?.drug || '').toLowerCase().trim();
    const severity = String(entry?.severity || '').toLowerCase().trim();
    return entryDrug && entryDrug === name && severity === 'high';
  }) || null;
}

module.exports = { findHighSeverityConflict };
