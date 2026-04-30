(function () {
  function clamp(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
  }

  function computeSessionVWAP(data) {
    const { highs, lows, closes, volumes } = data;
    const output = [];
    let cumPV = 0;
    let cumV = 0;
    for (let i = 0; i < closes.length; i += 1) {
      const typical = (highs[i] + lows[i] + closes[i]) / 3;
      const vol = Math.max(0, volumes[i] || 0);
      cumPV += typical * vol;
      cumV += vol;
      output.push(cumV > 0 ? cumPV / cumV : closes[i]);
    }
    return output;
  }

  function computeAnchoredVWAP(data, startIndex) {
    const { highs, lows, closes, volumes } = data;
    const output = new Array(closes.length).fill(null);
    let cumPV = 0;
    let cumV = 0;
    const start = clamp(startIndex, 0, closes.length - 1);
    for (let i = start; i < closes.length; i += 1) {
      const typical = (highs[i] + lows[i] + closes[i]) / 3;
      const vol = Math.max(0, volumes[i] || 0);
      cumPV += typical * vol;
      cumV += vol;
      output[i] = cumV > 0 ? cumPV / cumV : closes[i];
    }
    return output;
  }

  window.VwapIndicator = {
    computeSessionVWAP,
    computeAnchoredVWAP,
  };
})();
