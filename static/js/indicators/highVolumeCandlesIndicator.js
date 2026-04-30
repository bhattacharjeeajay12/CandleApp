(function () {
  function clamp(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
  }

  function computeSignals(data, lookbackInput) {
    const { dates, highs, lows, closes, volumes } = data;
    const lookback = clamp(Number(lookbackInput) || 20, 2, 500);
    const out = { x: [], y: [], text: [], color: [], symbol: [] };

    for (let i = lookback; i < dates.length; i += 1) {
      const start = i - lookback;
      let sum = 0;
      for (let j = start; j < i; j += 1) {
        sum += volumes[j];
      }
      const avg = sum / lookback;
      if (!(avg > 0) || volumes[i] <= avg) {
        continue;
      }

      const ratio = volumes[i] / avg;
      const isBullish = closes[i] >= closes[Math.max(0, i - 1)];
      out.x.push(dates[i]);
      out.y.push(isBullish ? highs[i] * 1.0005 : lows[i] * 0.9995);
      out.text.push(
        `High Volume Candle<br>Date: ${dates[i]}` +
          `<br>Volume: ${volumes[i].toFixed(2)}` +
          `<br>Avg(${lookback}): ${avg.toFixed(2)}` +
          `<br>Ratio: ${ratio.toFixed(2)}x`
      );
      out.color.push(isBullish ? "rgba(59,130,246,0.95)" : "rgba(234,88,12,0.95)");
      out.symbol.push(isBullish ? "diamond" : "diamond-open");
    }
    return out;
  }

  window.HighVolumeCandlesIndicator = {
    computeSignals,
  };
})();
