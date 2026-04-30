(function () {
  function clamp(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
  }

  function fmt(num) {
    if (!Number.isFinite(num)) {
      return "N/A";
    }
    return Number(num).toFixed(4);
  }

  function computeSignals(data, profile, options) {
    const { rows, dates, opens, highs, lows, closes, volumes } = data;
    const cfg = options || {};
    const spikeThreshold = Number(cfg.spikeThreshold || 1.35);
    const out = { x: [], y: [], text: [], color: [], symbol: [] };
    if (!profile) {
      return out;
    }

    const profileStart = clamp(profile.start ?? 0, 0, rows.length - 1);
    const profileEnd = clamp(profile.end ?? rows.length - 1, 0, rows.length - 1);
    const priceTolerance = Math.max(
      (profile.maxPrice - profile.minPrice) * 0.012,
      profile.binSize * 1.1,
      1e-8
    );

    for (let i = 2; i < rows.length - 2; i += 1) {
      if (i < profileStart || i > profileEnd) {
        continue;
      }
      const body = Math.abs(closes[i] - opens[i]);
      const upperWick = highs[i] - Math.max(opens[i], closes[i]);
      const lowerWick = Math.min(opens[i], closes[i]) - lows[i];
      const lookbackStart = Math.max(0, i - 20);
      const avgVolume =
        volumes.slice(lookbackStart, i + 1).reduce((a, b) => a + b, 0) / (i - lookbackStart + 1);
      const volumeRatio = avgVolume > 0 ? volumes[i] / avgVolume : 0;
      const volSpike = volumeRatio >= spikeThreshold;
      const localLow = lows[i] <= lows[i - 1] && lows[i] <= lows[i + 1];
      const localHigh = highs[i] >= highs[i - 1] && highs[i] >= highs[i + 1];

      const nearVAL =
        Math.abs(lows[i] - profile.val) <= priceTolerance ||
        (lows[i] <= profile.val && closes[i] >= profile.val);
      const nearVAH =
        Math.abs(highs[i] - profile.vah) <= priceTolerance ||
        (highs[i] >= profile.vah && closes[i] <= profile.vah);
      const nearPOC = Math.abs(closes[i] - profile.poc) <= priceTolerance;

      const bullish =
        volSpike &&
        localLow &&
        closes[i] > opens[i] &&
        lowerWick > body * 1.2 &&
        (nearVAL || (nearPOC && closes[i] > profile.poc));

      const bearish =
        volSpike &&
        localHigh &&
        closes[i] < opens[i] &&
        upperWick > body * 1.2 &&
        (nearVAH || (nearPOC && closes[i] < profile.poc));

      if (bullish) {
        out.x.push(dates[i]);
        out.y.push(lows[i] * 0.9995);
        out.text.push(
          `Potential Upside Reversal<br>Date: ${dates[i]}<br>Close: ${fmt(closes[i])}` +
            `<br>Volume Spike: ${volumeRatio.toFixed(2)}x` +
            `<br>Near: ${nearVAL ? "VAL" : "POC"} | VAL: ${fmt(profile.val)} | POC: ${fmt(profile.poc)}`
        );
        out.color.push("rgba(34,197,94,0.95)");
        out.symbol.push("triangle-up");
      } else if (bearish) {
        out.x.push(dates[i]);
        out.y.push(highs[i] * 1.0005);
        out.text.push(
          `Potential Downside Reversal<br>Date: ${dates[i]}<br>Close: ${fmt(closes[i])}` +
            `<br>Volume Spike: ${volumeRatio.toFixed(2)}x` +
            `<br>Near: ${nearVAH ? "VAH" : "POC"} | VAH: ${fmt(profile.vah)} | POC: ${fmt(profile.poc)}`
        );
        out.color.push("rgba(239,68,68,0.95)");
        out.symbol.push("triangle-down");
      }
    }
    return out;
  }

  window.PotentialReversalIndicator = {
    computeSignals,
  };
})();
