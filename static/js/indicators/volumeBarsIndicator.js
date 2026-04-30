(function () {
  function getBarColors(rows) {
    return rows.map((row) =>
      row.close >= row.open ? "rgba(74,222,128,0.75)" : "rgba(239,68,68,0.75)"
    );
  }

  window.VolumeBarsIndicator = {
    getBarColors,
  };
})();
