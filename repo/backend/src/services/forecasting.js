const DAY_MS = 24 * 60 * 60 * 1000;

const forecastStrategies = new Map();

function registerForecastStrategy(key, strategy) {
  if (!key || typeof strategy !== 'function') throw new Error('Invalid forecasting strategy');
  forecastStrategies.set(key, strategy);
}

function movingAverage(values, windowSize = 3) {
  if (!values.length) return 0;
  const slice = values.slice(Math.max(0, values.length - windowSize));
  const sum = slice.reduce((acc, v) => acc + Number(v || 0), 0);
  return sum / slice.length;
}

function baselineMovingAverageStrategy(dailyCounts) {
  const values = dailyCounts.map((d) => Number(d.count || 0));
  const avg = movingAverage(values, 7);
  return Array.from({ length: 7 }, (_, idx) => ({
    dayOffset: idx + 1,
    predictedVisits: Number(avg.toFixed(2)),
  }));
}

function trendRegressionStrategy(dailyCounts) {
  const values = dailyCounts.map((d) => Number(d.count || 0));
  if (values.length < 2) return baselineMovingAverageStrategy(dailyCounts);
  const first = values[0];
  const last = values[values.length - 1];
  const slope = (last - first) / Math.max(1, values.length - 1);
  const base = movingAverage(values, 5);
  return Array.from({ length: 7 }, (_, idx) => ({
    dayOffset: idx + 1,
    predictedVisits: Number((base + slope * (idx + 1)).toFixed(2)),
  }));
}

registerForecastStrategy('baseline_moving_average', baselineMovingAverageStrategy);
registerForecastStrategy('baseline', baselineMovingAverageStrategy);
registerForecastStrategy('trend_regression', trendRegressionStrategy);
registerForecastStrategy('regression', trendRegressionStrategy);

function resolveStrategyKey(algorithm) {
  const normalized = String(algorithm || '').toLowerCase();
  if (forecastStrategies.has(normalized)) return normalized;
  if (normalized.includes('trend') || normalized.includes('regression')) return 'trend_regression';
  return 'baseline_moving_average';
}

function forecastFromModel(dailyCounts, deployedModel) {
  const requestedAlgorithm = (deployedModel && deployedModel.algorithm) || 'baseline_moving_average';
  const strategyKey = resolveStrategyKey(requestedAlgorithm);
  const strategy = forecastStrategies.get(strategyKey) || baselineMovingAverageStrategy;
  return { algorithm: strategyKey, points: strategy(dailyCounts) };
}

function topMedicationRecommendations(prescriptionRows, limit = 5) {
  const counts = new Map();
  for (const row of prescriptionRows || []) {
    const key = String(row.drug_name || '').trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([drugName, occurrences]) => ({ drugName, occurrences }));
}

function toVector(row) {
  const doseNum = Number(String(row.dose || '').replace(/[^\d.]/g, '')) || 0;
  const qty = Number(row.quantity || 0);
  const route = String(row.route || '').toLowerCase();
  return [doseNum, qty, route === 'oral' ? 1 : 0, route === 'iv' ? 1 : 0, route === 'topical' ? 1 : 0];
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function similarPrescriptionSuggestions(rows, limit = 5) {
  if (!rows || rows.length < 2) return [];
  const latest = rows[0];
  const latestVec = toVector(latest);
  return rows
    .slice(1)
    .map((r) => ({
      prescriptionId: r.id,
      drugName: r.drug_name,
      score: Number(cosineSimilarity(latestVec, toVector(r)).toFixed(4)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function dateSeriesFromRows(rows, now = Date.now(), days = 30) {
  const byDay = new Map();
  for (const row of rows || []) {
    const day = new Date(row.created_at || row.updated_at || now).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    series.push({ day: d, count: byDay.get(d) || 0 });
  }
  return series;
}

module.exports = {
  forecastFromModel,
  registerForecastStrategy,
  topMedicationRecommendations,
  similarPrescriptionSuggestions,
  dateSeriesFromRows,
};
