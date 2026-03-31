const DAY_MS = 24 * 60 * 60 * 1000;

function movingAverage(values, windowSize = 3) {
  if (!values.length) return 0;
  const slice = values.slice(Math.max(0, values.length - windowSize));
  const sum = slice.reduce((acc, v) => acc + Number(v || 0), 0);
  return sum / slice.length;
}

function baselineForecast(dailyCounts) {
  const values = dailyCounts.map((d) => Number(d.count || 0));
  const avg = movingAverage(values, 7);
  return Array.from({ length: 7 }, (_, idx) => ({
    dayOffset: idx + 1,
    predictedVisits: Number(avg.toFixed(2)),
  }));
}

function trendForecast(dailyCounts) {
  const values = dailyCounts.map((d) => Number(d.count || 0));
  if (values.length < 2) return baselineForecast(dailyCounts);
  const first = values[0];
  const last = values[values.length - 1];
  const slope = (last - first) / Math.max(1, values.length - 1);
  const base = movingAverage(values, 5);
  return Array.from({ length: 7 }, (_, idx) => ({
    dayOffset: idx + 1,
    predictedVisits: Number((base + slope * (idx + 1)).toFixed(2)),
  }));
}

function forecastFromModel(dailyCounts, deployedModel) {
  const algorithm = (deployedModel && deployedModel.algorithm) || 'baseline_moving_average';
  if (algorithm.includes('trend') || algorithm.includes('regression')) {
    return { algorithm, points: trendForecast(dailyCounts) };
  }
  return { algorithm, points: baselineForecast(dailyCounts) };
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
  topMedicationRecommendations,
  dateSeriesFromRows,
};
