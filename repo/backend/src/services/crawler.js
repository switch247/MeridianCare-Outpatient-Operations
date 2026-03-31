function computeBackoffSeconds(retries) {
  return Math.min(30 * (2 ** Math.max(0, Number(retries))), 900);
}

function nextStage(stage) {
  if (stage === 'collect') return 'parse';
  if (stage === 'parse') return 'store';
  if (stage === 'store') return 'completed';
  return 'completed';
}

module.exports = { computeBackoffSeconds, nextStage };
