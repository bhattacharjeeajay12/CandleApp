(function () {
  function clamp(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
  }

  function computeProfile(data, config) {
    const { highs, lows, volumes, rowCount } = data;
    const start = clamp(Math.min(config.startIndex, config.endIndex), 0, rowCount - 1);
    const end = clamp(Math.max(config.startIndex, config.endIndex), 0, rowCount - 1);
    if (end < start) {
      return null;
    }

    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = Number.NEGATIVE_INFINITY;
    for (let i = start; i <= end; i += 1) {
      minPrice = Math.min(minPrice, lows[i]);
      maxPrice = Math.max(maxPrice, highs[i]);
    }
    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      return null;
    }

    const bins = clamp(Number(config.bins) || 24, 8, 80);
    const span = Math.max(maxPrice - minPrice, 1e-9);
    const binSize = span / bins;
    const binVolume = new Array(bins).fill(0);

    for (let i = start; i <= end; i += 1) {
      const cLow = lows[i];
      const cHigh = highs[i];
      const cVol = Math.max(0, volumes[i] || 0);
      if (cVol <= 0) {
        continue;
      }

      const range = cHigh - cLow;
      if (range <= 1e-12) {
        const idx = clamp(Math.floor((cLow - minPrice) / binSize), 0, bins - 1);
        binVolume[idx] += cVol;
        continue;
      }

      for (let b = 0; b < bins; b += 1) {
        const bLow = minPrice + b * binSize;
        const bHigh = bLow + binSize;
        const overlap = Math.max(0, Math.min(cHigh, bHigh) - Math.max(cLow, bLow));
        if (overlap > 0) {
          binVolume[b] += cVol * (overlap / range);
        }
      }
    }

    const maxVolume = Math.max(...binVolume, 1e-9);
    const pocIndex = binVolume.reduce(
      (bestIdx, value, idx, arr) => (value > arr[bestIdx] ? idx : bestIdx),
      0
    );

    const totalVolume = binVolume.reduce((acc, val) => acc + val, 0);
    const target = totalVolume * 0.7;
    let accumulated = binVolume[pocIndex];
    let left = pocIndex;
    let right = pocIndex;
    while (accumulated < target && (left > 0 || right < bins - 1)) {
      const leftCandidate = left > 0 ? binVolume[left - 1] : -1;
      const rightCandidate = right < bins - 1 ? binVolume[right + 1] : -1;
      if (rightCandidate >= leftCandidate) {
        right += 1;
        accumulated += Math.max(0, rightCandidate);
      } else {
        left -= 1;
        accumulated += Math.max(0, leftCandidate);
      }
    }

    const poc = minPrice + (pocIndex + 0.5) * binSize;
    const val = minPrice + left * binSize;
    const vah = minPrice + (right + 1) * binSize;

    return {
      minPrice,
      maxPrice,
      bins,
      binSize,
      binVolume,
      maxVolume,
      poc,
      val,
      vah,
      start,
      end,
    };
  }

  function getShapesAndAnnotations(indicator, profile) {
    if (!profile) {
      return { shapes: [], annotations: [] };
    }

    const shapes = [];
    const annotations = [];
    const safeAnchor = clamp(indicator.anchorPaper, 0.02, 0.98);
    const maxWidth = clamp(indicator.widthPaper, 0.05, 0.45);

    for (let b = 0; b < profile.bins; b += 1) {
      const v = profile.binVolume[b];
      if (v <= 0) {
        continue;
      }
      const normalized = v / profile.maxVolume;
      const width = maxWidth * normalized;
      let x0 = safeAnchor - width;
      let x1 = safeAnchor;
      if (indicator.side === "right") {
        x0 = safeAnchor;
        x1 = safeAnchor + width;
      }
      x0 = clamp(x0, 0, 1);
      x1 = clamp(x1, 0, 1);
      if (x1 <= x0) {
        continue;
      }
      const y0 = profile.minPrice + b * profile.binSize;
      const y1 = y0 + profile.binSize;
      shapes.push({
        type: "rect",
        xref: "paper",
        yref: "y",
        x0,
        x1,
        y0,
        y1,
        fillcolor: `rgba(${indicator.color},${indicator.opacity})`,
        line: { color: `rgba(${indicator.color},0.5)`, width: 0.4 },
        layer: "above",
      });
    }

    const midPrice = (profile.minPrice + profile.maxPrice) / 2;
    annotations.push({
      xref: "paper",
      yref: "y",
      x: safeAnchor,
      y: midPrice,
      text: indicator.name,
      showarrow: false,
      font: { size: 10, color: "#cbd5e1" },
      bgcolor: "rgba(15,17,26,0.65)",
      bordercolor: "rgba(148,163,184,0.4)",
      borderwidth: 1,
    });

    const lineX0 = clamp(safeAnchor - maxWidth, 0, 1);
    const lineX1 = clamp(safeAnchor, 0, 1);
    const levels = [
      { label: "POC", y: profile.poc, color: "rgba(251,191,36,0.95)" },
      { label: "VAH", y: profile.vah, color: "rgba(45,212,191,0.9)" },
      { label: "VAL", y: profile.val, color: "rgba(45,212,191,0.9)" },
    ];
    levels.forEach((level) => {
      shapes.push({
        type: "line",
        xref: "paper",
        yref: "y",
        x0: lineX0,
        x1: lineX1,
        y0: level.y,
        y1: level.y,
        line: { color: level.color, width: 1.1, dash: "dot" },
        layer: "above",
      });
      annotations.push({
        xref: "paper",
        yref: "y",
        x: lineX0,
        y: level.y,
        text: level.label,
        showarrow: false,
        xanchor: "right",
        font: { size: 9, color: "#e2e8f0" },
        bgcolor: "rgba(15,17,26,0.65)",
        bordercolor: "rgba(148,163,184,0.35)",
        borderwidth: 1,
      });
    });

    return { shapes, annotations };
  }

  window.VolumeProfileIndicator = {
    computeProfile,
    getShapesAndAnnotations,
  };
})();
