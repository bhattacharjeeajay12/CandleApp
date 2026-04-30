(function () {
  const rows = JSON.parse(document.getElementById("ohlc-data").textContent || "[]");
  const dates = rows.map((r) => r.date);
  const opens = rows.map((r) => r.open);
  const highs = rows.map((r) => r.high);
  const lows = rows.map((r) => r.low);
  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => Number(r.volume || 0));

  const dataBundle = { rows, dates, opens, highs, lows, closes, volumes };
  const profileData = { highs, lows, volumes, rowCount: rows.length };

  const volumeColors = window.VolumeBarsIndicator.getBarColors(rows);
  const sessionVwapValues = window.VwapIndicator.computeSessionVWAP(dataBundle);
  const defaultSignalProfile = window.VolumeProfileIndicator.computeProfile(profileData, {
    startIndex: Math.max(0, rows.length - 160),
    endIndex: rows.length - 1,
    bins: 24,
  });
  const potentialSignals = window.PotentialReversalIndicator.computeSignals(dataBundle, defaultSignalProfile);

  const CANDLE_TRACE = 0;
  const VOLUME_TRACE = 1;
  const SESSION_VWAP_TRACE = 2;
  const ANCHORED_VWAP_TRACE = 3;
  const SIGNAL_TRACE = 4;
  const HIGH_VOLUME_TRACE = 5;

  const chartDiv = document.getElementById("chart");
  const controls = document.getElementById("controls");
  const togglePanelBtn = document.getElementById("togglePanelBtn");
  const modeNote = document.getElementById("modeNote");
  const indicatorInfo = document.getElementById("indicatorInfo");
  const addTypeSelect = document.getElementById("addTypeSelect");
  const indicatorSelect = document.getElementById("indicatorSelect");
  const visibleToggle = document.getElementById("visibleToggle");
  const binsInput = document.getElementById("binsInput");
  const widthInput = document.getElementById("widthInput");
  const opacityInput = document.getElementById("opacityInput");
  const anchorInput = document.getElementById("anchorInput");
  const volumeLookbackInput = document.getElementById("volumeLookbackInput");
  const pickRangeBtn = document.getElementById("pickRangeBtn");
  const pickPlacementBtn = document.getElementById("pickPlacementBtn");
  const addIndicatorBtn = document.getElementById("addIndicatorBtn");
  const removeIndicatorBtn = document.getElementById("removeIndicatorBtn");

  const indicators = [];
  let nextProfileId = 1;
  let activeIndicatorId = null;
  let rangePickState = null;
  let placementPickMode = false;

  function clamp(value, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, value));
  }

  function formatNum(num) {
    if (!Number.isFinite(num)) {
      return "N/A";
    }
    return Number(num).toFixed(4);
  }

  function isProfileIndicator(ind) {
    return ind && (ind.type === "fixed-profile" || ind.type === "anchored-profile");
  }

  function isAnchoredVwapIndicator(ind) {
    return ind && ind.type === "vwap-anchored";
  }

  function isHighVolumeIndicator(ind) {
    return ind && ind.type === "high-volume-candles";
  }

  function getActiveIndicator() {
    return indicators.find((ind) => ind.id === activeIndicatorId) || null;
  }

  function setModeNote(text) {
    modeNote.textContent = text;
  }

  function indicatorExists(type) {
    return indicators.some((ind) => ind.type === type);
  }

  function computeVolumeProfile(indicator) {
    return window.VolumeProfileIndicator.computeProfile(profileData, {
      startIndex: indicator.startIndex,
      endIndex: indicator.endIndex,
      bins: indicator.bins,
    });
  }

  function getSignalReferenceProfileRef() {
    const enabledProfiles = indicators.filter((ind) => isProfileIndicator(ind) && ind.enabled);
    if (enabledProfiles.length > 0) {
      const activeProfile = enabledProfiles.find((ind) => ind.id === activeIndicatorId);
      const chosen = activeProfile || enabledProfiles[enabledProfiles.length - 1];
      return { profile: computeVolumeProfile(chosen), source: chosen.name };
    }

    const fallback = window.VolumeProfileIndicator.computeProfile(profileData, {
      startIndex: Math.max(0, rows.length - 160),
      endIndex: rows.length - 1,
      bins: 24,
    });
    return { profile: fallback, source: "Fallback Last 160 Candles" };
  }

  function updateIndicatorInfo() {
    const active = getActiveIndicator();
    if (!active) {
      indicatorInfo.textContent = "No indicator selected.";
      return;
    }
    if (isProfileIndicator(active)) {
      const profile = computeVolumeProfile(active);
      if (!profile) {
        indicatorInfo.textContent = `${active.name}\nNo profile data for current range.`;
        return;
      }
      indicatorInfo.textContent =
        `${active.name}\n` +
        `Candle Range: ${dates[profile.start]} -> ${dates[profile.end]} (${profile.end - profile.start + 1} candles)\n` +
        `Price Range: ${formatNum(profile.minPrice)} -> ${formatNum(profile.maxPrice)}\n` +
        `POC: ${formatNum(profile.poc)}\n` +
        `Value Area: ${formatNum(profile.val)} -> ${formatNum(profile.vah)}`;
      return;
    }
    if (isAnchoredVwapIndicator(active)) {
      indicatorInfo.textContent =
        `${active.name}\n` +
        `Anchor Candle: ${dates[active.startIndex]}\n` +
        `Anchor Index: ${active.startIndex}`;
      return;
    }
    if (active.type === "vwap-session") {
      indicatorInfo.textContent = "Session VWAP starts from first chart candle.";
      return;
    }
    if (active.type === "volume-bars") {
      indicatorInfo.textContent = "Vertical base volume bars (independent of Volume Profile).";
      return;
    }
    if (active.type === "potential-candles") {
      const signalProfileRef = getSignalReferenceProfileRef();
      const signalProfile = signalProfileRef.profile;
      indicatorInfo.textContent =
        "Potential Reversal Candles:\n" +
        "Uses: Volume Spike + Volume Profile levels (POC/VAL/VAH)\n" +
        `Profile Source: ${signalProfileRef.source}\n` +
        `POC: ${formatNum(signalProfile?.poc)} | VAL: ${formatNum(signalProfile?.val)} | VAH: ${formatNum(signalProfile?.vah)}\n` +
        "Green marker = potential upside reversal\n" +
        "Red marker = potential downside reversal";
      return;
    }
    if (isHighVolumeIndicator(active)) {
      indicatorInfo.textContent =
        "High Volume Candles:\n" +
        "Rule: Candle Volume > average volume of N past candles\n" +
        `N = ${active.lookback}\n` +
        "Blue diamond = relative bullish pressure\n" +
        "Orange open diamond = relative bearish pressure";
    }
  }

  function createIndicator(type) {
    if (
      (type === "volume-bars" ||
        type === "vwap-session" ||
        type === "vwap-anchored" ||
        type === "potential-candles" ||
        type === "high-volume-candles") &&
      indicatorExists(type)
    ) {
      const labelMap = {
        "volume-bars": "Volume Bars",
        "vwap-session": "Session VWAP",
        "vwap-anchored": "Anchored VWAP",
        "potential-candles": "Potential Reversal Candles",
        "high-volume-candles": "High Volume Candles",
      };
      setModeNote(`${labelMap[type]} already exists.`);
      return null;
    }

    if (type === "volume-bars") {
      const ind = { id: "volume-bars", name: "Volume Bars", type, enabled: true, locked: true };
      indicators.push(ind);
      activeIndicatorId = ind.id;
      return ind;
    }
    if (type === "vwap-session") {
      const ind = { id: "vwap-session", name: "Session VWAP", type, enabled: false, locked: true };
      indicators.push(ind);
      activeIndicatorId = ind.id;
      return ind;
    }
    if (type === "vwap-anchored") {
      const ind = {
        id: "vwap-anchored",
        name: "Anchored VWAP",
        type,
        enabled: false,
        locked: true,
        startIndex: Math.max(0, dates.length - 120),
      };
      indicators.push(ind);
      activeIndicatorId = ind.id;
      return ind;
    }
    if (type === "potential-candles") {
      const ind = {
        id: "potential-candles",
        name: "Potential Reversal Candles",
        type,
        enabled: false,
        locked: true,
      };
      indicators.push(ind);
      activeIndicatorId = ind.id;
      return ind;
    }
    if (type === "high-volume-candles") {
      const ind = {
        id: "high-volume-candles",
        name: "High Volume Candles",
        type,
        enabled: false,
        locked: true,
        lookback: 20,
      };
      indicators.push(ind);
      activeIndicatorId = ind.id;
      return ind;
    }

    const id = `${type}-${nextProfileId}`;
    nextProfileId += 1;
    const rangeStart = Math.max(0, dates.length - 120);
    const profile = {
      id,
      name: type === "fixed-profile" ? `FRVP ${nextProfileId - 1}` : `AVP ${nextProfileId - 1}`,
      type,
      enabled: true,
      locked: false,
      startIndex: rangeStart,
      endIndex: dates.length - 1,
      bins: 24,
      widthPaper: type === "fixed-profile" ? 0.22 : 0.18,
      opacity: 0.35,
      anchorPaper: type === "fixed-profile" ? 0.98 : 0.2,
      side: "left",
      color: type === "fixed-profile" ? "56,189,248" : "167,139,250",
    };
    indicators.push(profile);
    activeIndicatorId = profile.id;
    return profile;
  }

  function removeActiveIndicator() {
    const active = getActiveIndicator();
    if (!active) {
      return;
    }
    if (active.locked) {
      setModeNote("Core indicators cannot be removed, only toggled.");
      return;
    }
    const idx = indicators.findIndex((ind) => ind.id === active.id);
    indicators.splice(idx, 1);
    activeIndicatorId = indicators.length ? indicators[0].id : null;
  }

  function renderIndicatorDropdown() {
    const prev = activeIndicatorId;
    indicatorSelect.innerHTML = "";
    indicators.forEach((ind) => {
      const opt = document.createElement("option");
      const state = ind.enabled ? "On" : "Off";
      opt.value = ind.id;
      opt.textContent = `${ind.name} (${state})`;
      indicatorSelect.appendChild(opt);
    });
    if (prev && indicators.some((ind) => ind.id === prev)) {
      indicatorSelect.value = prev;
    } else if (indicators.length) {
      activeIndicatorId = indicators[0].id;
      indicatorSelect.value = activeIndicatorId;
    }
  }

  function refreshControlValues() {
    const active = getActiveIndicator();
    visibleToggle.checked = Boolean(active?.enabled);
    const profileMode = isProfileIndicator(active);
    const canAnchor = profileMode || isAnchoredVwapIndicator(active);
    const highVolumeMode = isHighVolumeIndicator(active);
    binsInput.disabled = !profileMode;
    widthInput.disabled = !profileMode;
    opacityInput.disabled = !profileMode;
    anchorInput.disabled = !profileMode;
    volumeLookbackInput.disabled = !highVolumeMode;
    pickRangeBtn.disabled = !profileMode;
    pickPlacementBtn.disabled = !canAnchor;

    if (!profileMode) {
      binsInput.value = 24;
      widthInput.value = 0.2;
      opacityInput.value = 0.35;
      anchorInput.value = 50;
    } else {
      binsInput.value = active.bins;
      widthInput.value = active.widthPaper.toFixed(2);
      opacityInput.value = active.opacity;
      anchorInput.value = Math.round(active.anchorPaper * 100);
    }

    volumeLookbackInput.value = highVolumeMode ? active.lookback : 20;
  }

  function getVisibleYBounds() {
    const xRange = chartDiv.layout?.xaxis?.range;
    if (!xRange || xRange.length !== 2) {
      return [Math.min(...lows), Math.max(...highs)];
    }
    const start = new Date(xRange[0]).getTime();
    const end = new Date(xRange[1]).getTime();
    const minX = Math.min(start, end);
    const maxX = Math.max(start, end);
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < dates.length; i += 1) {
      const ts = new Date(dates[i]).getTime();
      if (ts >= minX && ts <= maxX) {
        yMin = Math.min(yMin, lows[i]);
        yMax = Math.max(yMax, highs[i]);
      }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      return [Math.min(...lows), Math.max(...highs)];
    }
    if (yMin === yMax) {
      const pad = Math.max(1e-6, Math.abs(yMin) * 0.005);
      return [yMin - pad, yMax + pad];
    }
    return [yMin, yMax];
  }

  function zoomYAxis(direction) {
    const yAxis = chartDiv.layout?.yaxis || {};
    let currentRange = yAxis.range;
    if (!currentRange || currentRange.length !== 2) {
      currentRange = getVisibleYBounds();
    }
    const low = Number(currentRange[0]);
    const high = Number(currentRange[1]);
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
      return;
    }
    const span = high - low;
    const center = (low + high) / 2;
    const zoomStep = 0.12;
    const factor = direction > 0 ? 1 + zoomStep : 1 - zoomStep;
    const newHalfSpan = clamp((span * factor) / 2, 1e-8, Number.MAX_SAFE_INTEGER);
    Plotly.relayout(chartDiv, {
      "yaxis.autorange": false,
      "yaxis.range": [center - newHalfSpan, center + newHalfSpan],
    });
  }

  function xValueToPaper(xValue) {
    const xRange = chartDiv.layout?.xaxis?.range;
    if (!xRange || xRange.length !== 2) {
      return 0.5;
    }
    const start = new Date(xRange[0]).getTime();
    const end = new Date(xRange[1]).getTime();
    const minX = Math.min(start, end);
    const maxX = Math.max(start, end);
    const xTs = new Date(xValue).getTime();
    if (!Number.isFinite(xTs) || maxX <= minX) {
      return 0.5;
    }
    return clamp((xTs - minX) / (maxX - minX), 0, 1);
  }

  function updateAllIndicators() {
    const volumeEnabled = indicators.some((ind) => ind.type === "volume-bars" && ind.enabled);
    const sessionVwapEnabled = indicators.some((ind) => ind.type === "vwap-session" && ind.enabled);
    const anchoredVwapInd = indicators.find((ind) => ind.type === "vwap-anchored");
    const anchoredVwapEnabled = Boolean(anchoredVwapInd?.enabled);
    const signalEnabled = indicators.some((ind) => ind.type === "potential-candles" && ind.enabled);
    const highVolumeInd = indicators.find((ind) => ind.type === "high-volume-candles");
    const highVolumeEnabled = Boolean(highVolumeInd?.enabled);

    Plotly.restyle(chartDiv, { visible: volumeEnabled }, [VOLUME_TRACE]);
    Plotly.restyle(chartDiv, { visible: sessionVwapEnabled }, [SESSION_VWAP_TRACE]);
    Plotly.restyle(chartDiv, { visible: anchoredVwapEnabled }, [ANCHORED_VWAP_TRACE]);
    Plotly.restyle(chartDiv, { visible: signalEnabled }, [SIGNAL_TRACE]);
    Plotly.restyle(chartDiv, { visible: highVolumeEnabled }, [HIGH_VOLUME_TRACE]);

    if (anchoredVwapInd) {
      const series = window.VwapIndicator.computeAnchoredVWAP(dataBundle, anchoredVwapInd.startIndex);
      Plotly.restyle(chartDiv, { y: [series] }, [ANCHORED_VWAP_TRACE]);
    }

    const signalProfileRef = getSignalReferenceProfileRef();
    const refreshedSignals = window.PotentialReversalIndicator.computeSignals(
      dataBundle,
      signalProfileRef.profile
    );
    Plotly.restyle(
      chartDiv,
      {
        x: [refreshedSignals.x],
        y: [refreshedSignals.y],
        text: [refreshedSignals.text],
        "marker.color": [refreshedSignals.color],
        "marker.symbol": [refreshedSignals.symbol],
      },
      [SIGNAL_TRACE]
    );

    const highVolumeSignals = window.HighVolumeCandlesIndicator.computeSignals(
      dataBundle,
      highVolumeInd?.lookback || 20
    );
    Plotly.restyle(
      chartDiv,
      {
        x: [highVolumeSignals.x],
        y: [highVolumeSignals.y],
        text: [highVolumeSignals.text],
        "marker.color": [highVolumeSignals.color],
        "marker.symbol": [highVolumeSignals.symbol],
      },
      [HIGH_VOLUME_TRACE]
    );

    const allShapes = [];
    const allAnnotations = [];
    indicators
      .filter((ind) => isProfileIndicator(ind) && ind.enabled)
      .forEach((ind) => {
        const profile = computeVolumeProfile(ind);
        const rendered = window.VolumeProfileIndicator.getShapesAndAnnotations(ind, profile);
        allShapes.push(...rendered.shapes);
        allAnnotations.push(...rendered.annotations);
      });
    Plotly.relayout(chartDiv, { shapes: allShapes, annotations: allAnnotations });

    renderIndicatorDropdown();
    refreshControlValues();
    updateIndicatorInfo();
  }

  const candlestickTrace = {
    type: "candlestick",
    x: dates,
    open: opens,
    high: highs,
    low: lows,
    close: closes,
    yaxis: "y",
    whiskerwidth: 0.6,
    increasing: { line: { color: "#4ade80", width: 1.2 }, fillcolor: "#4ade80" },
    decreasing: { line: { color: "#ef4444", width: 1.2 }, fillcolor: "#ef4444" },
    hovertemplate:
      "Date: %{x}<br>" +
      "Open: %{open:.4f}<br>" +
      "High: %{high:.4f}<br>" +
      "Low: %{low:.4f}<br>" +
      "Close: %{close:.4f}<br>" +
      "Volume: %{customdata:.2f}<extra></extra>",
    customdata: volumes,
  };

  const volumeBarsTrace = {
    type: "bar",
    x: dates,
    y: volumes,
    yaxis: "y2",
    marker: { color: volumeColors },
    opacity: 0.9,
    name: "Volume Bars",
    hovertemplate: "Date: %{x}<br>Volume: %{y:.2f}<extra></extra>",
  };

  const vwapTrace = {
    type: "scatter",
    mode: "lines",
    x: dates,
    y: sessionVwapValues,
    yaxis: "y",
    line: { color: "#f59e0b", width: 1.6 },
    name: "Session VWAP",
    hovertemplate: "Date: %{x}<br>Session VWAP: %{y:.4f}<extra></extra>",
  };

  const anchoredVwapTrace = {
    type: "scatter",
    mode: "lines",
    x: dates,
    y: new Array(dates.length).fill(null),
    yaxis: "y",
    line: { color: "#22d3ee", width: 1.6, dash: "dot" },
    name: "Anchored VWAP",
    hovertemplate: "Date: %{x}<br>Anchored VWAP: %{y:.4f}<extra></extra>",
  };

  const signalTrace = {
    type: "scatter",
    mode: "markers",
    x: potentialSignals.x,
    y: potentialSignals.y,
    yaxis: "y",
    marker: {
      color: potentialSignals.color,
      size: 10,
      symbol: potentialSignals.symbol,
      line: { color: "#0f111a", width: 1 },
    },
    text: potentialSignals.text,
    hovertemplate: "%{text}<extra></extra>",
    name: "Potential Reversal Candles",
  };

  const highVolumeSignals = window.HighVolumeCandlesIndicator.computeSignals(dataBundle, 20);
  const highVolumeTrace = {
    type: "scatter",
    mode: "markers",
    x: highVolumeSignals.x,
    y: highVolumeSignals.y,
    yaxis: "y",
    marker: {
      color: highVolumeSignals.color,
      size: 9,
      symbol: highVolumeSignals.symbol,
      line: { color: "#0f111a", width: 1 },
    },
    text: highVolumeSignals.text,
    hovertemplate: "%{text}<extra></extra>",
    name: "High Volume Candles",
  };

  const visibleCount = 70;
  const startIndex = Math.max(0, dates.length - visibleCount);
  const initialRange = dates.length > 0 ? [dates[startIndex], dates[dates.length - 1]] : undefined;

  const layout = {
    paper_bgcolor: "#0f111a",
    plot_bgcolor: "#0f111a",
    margin: { t: 24, r: 24, b: 42, l: 60 },
    dragmode: "pan",
    barmode: "overlay",
    xaxis: {
      title: "Date",
      type: "date",
      color: "#e5e7eb",
      gridcolor: "#2a2f3a",
      rangeslider: { visible: false },
      range: initialRange,
      anchor: "y2",
    },
    yaxis: {
      title: "Price",
      color: "#e5e7eb",
      gridcolor: "#2a2f3a",
      rangemode: "normal",
      autorange: true,
      zeroline: false,
      fixedrange: false,
      domain: [0.28, 1],
    },
    yaxis2: {
      title: "Volume",
      color: "#a7b2c5",
      gridcolor: "#202733",
      zeroline: false,
      fixedrange: false,
      domain: [0, 0.22],
    },
    hovermode: "x",
    shapes: [],
    annotations: [],
    showlegend: false,
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
    doubleClick: "reset",
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
  };

  togglePanelBtn.addEventListener("click", () => {
    controls.classList.toggle("collapsed");
    togglePanelBtn.textContent = controls.classList.contains("collapsed") ? "Expand" : "Collapse";
  });

  addIndicatorBtn.addEventListener("click", () => {
    const ind = createIndicator(addTypeSelect.value);
    if (!ind) {
      return;
    }
    setModeNote(`Added ${ind.name}.`);
    updateAllIndicators();
  });

  removeIndicatorBtn.addEventListener("click", () => {
    removeActiveIndicator();
    updateAllIndicators();
  });

  indicatorSelect.addEventListener("change", () => {
    activeIndicatorId = indicatorSelect.value;
    rangePickState = null;
    placementPickMode = false;
    refreshControlValues();
    updateIndicatorInfo();
  });

  visibleToggle.addEventListener("change", () => {
    const active = getActiveIndicator();
    if (!active) {
      return;
    }
    active.enabled = visibleToggle.checked;
    updateAllIndicators();
    setModeNote(`${active.name} is now ${active.enabled ? "visible" : "hidden"}.`);
  });

  pickRangeBtn.addEventListener("click", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active)) {
      setModeNote("Select a volume profile indicator first.");
      return;
    }
    rangePickState = { step: 1, startIndex: null };
    placementPickMode = false;
    setModeNote("Range mode: click first candle, then ending candle.");
  });

  pickPlacementBtn.addEventListener("click", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active) && !isAnchoredVwapIndicator(active)) {
      setModeNote("Select a profile or Anchored VWAP first.");
      return;
    }
    placementPickMode = true;
    rangePickState = null;
    setModeNote("Placement mode: click any candle to set anchor.");
  });

  binsInput.addEventListener("change", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active)) {
      return;
    }
    active.bins = clamp(Number(binsInput.value) || 24, 8, 80);
    binsInput.value = active.bins;
    updateAllIndicators();
  });

  widthInput.addEventListener("change", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active)) {
      return;
    }
    active.widthPaper = clamp(Number(widthInput.value) || 0.2, 0.05, 0.45);
    widthInput.value = active.widthPaper.toFixed(2);
    updateAllIndicators();
  });

  opacityInput.addEventListener("input", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active)) {
      return;
    }
    active.opacity = clamp(Number(opacityInput.value) || 0.35, 0.1, 0.8);
    updateAllIndicators();
  });

  anchorInput.addEventListener("input", () => {
    const active = getActiveIndicator();
    if (!isProfileIndicator(active)) {
      return;
    }
    active.anchorPaper = clamp((Number(anchorInput.value) || 50) / 100, 0, 1);
    updateAllIndicators();
  });

  volumeLookbackInput.addEventListener("change", () => {
    const active = getActiveIndicator();
    if (!isHighVolumeIndicator(active)) {
      return;
    }
    active.lookback = clamp(Number(volumeLookbackInput.value) || 20, 2, 500);
    volumeLookbackInput.value = active.lookback;
    updateAllIndicators();
  });

  Plotly.newPlot(
    chartDiv,
    [candlestickTrace, volumeBarsTrace, vwapTrace, anchoredVwapTrace, signalTrace, highVolumeTrace],
    layout,
    config
  ).then(() => {
    chartDiv.addEventListener(
      "wheel",
      (event) => {
        if (!event.shiftKey) {
          return;
        }
        event.preventDefault();
        const direction = event.deltaY > 0 ? 1 : -1;
        zoomYAxis(direction);
      },
      { passive: false }
    );

    chartDiv.on("plotly_click", (evt) => {
      if (!evt.points || evt.points.length === 0) {
        return;
      }
      const point = evt.points[0];
      const idx = Number(point.pointNumber);
      if (!Number.isFinite(idx)) {
        return;
      }
      const active = getActiveIndicator();
      if (!active) {
        return;
      }

      if (rangePickState && isProfileIndicator(active)) {
        if (rangePickState.step === 1) {
          rangePickState.startIndex = idx;
          rangePickState.step = 2;
          setModeNote("Now click the ending candle.");
          return;
        }
        active.startIndex = Math.min(rangePickState.startIndex, idx);
        active.endIndex = Math.max(rangePickState.startIndex, idx);
        rangePickState = null;
        setModeNote(`Range set for ${active.name}.`);
        updateAllIndicators();
        return;
      }

      if (placementPickMode) {
        if (isProfileIndicator(active)) {
          active.anchorPaper = xValueToPaper(point.x);
          anchorInput.value = Math.round(active.anchorPaper * 100);
        } else if (isAnchoredVwapIndicator(active)) {
          active.startIndex = idx;
        }
        placementPickMode = false;
        setModeNote(`Anchor set for ${active.name}.`);
        updateAllIndicators();
      }
    });

    chartDiv.on("plotly_relayout", (evt) => {
      const changedXRange =
        Object.prototype.hasOwnProperty.call(evt, "xaxis.range[0]") ||
        Object.prototype.hasOwnProperty.call(evt, "xaxis.range[1]") ||
        Object.prototype.hasOwnProperty.call(evt, "xaxis.autorange");

      if (changedXRange) {
        const [yMin, yMax] = getVisibleYBounds();
        const padding = Math.max((yMax - yMin) * 0.08, Math.abs(yMax) * 0.001, 1e-6);
        Plotly.relayout(chartDiv, {
          "yaxis.autorange": false,
          "yaxis.range": [yMin - padding, yMax + padding],
        });
      }
    });

    createIndicator("volume-bars");
    createIndicator("vwap-session");
    createIndicator("vwap-anchored");
    createIndicator("potential-candles");
    createIndicator("high-volume-candles");
    createIndicator("fixed-profile");
    activeIndicatorId = indicators[0]?.id || null;
    updateAllIndicators();
    setModeNote("Indicators are now split into separate JS files under static/js/indicators.");
  });
})();
