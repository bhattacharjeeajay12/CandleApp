# CandleView

A lightweight Flask web app that reads OHLC data from an Excel file and displays an interactive dark-themed candlestick chart in your browser.

## Features

- Prompts for a full Excel file path (`.xlsx` or `.xls`) at startup
- Fuzzy, case-insensitive column detection for Date/Open/High/Low/Close
- Interactive Plotly candlestick chart:
  - Green candles for bullish (`Close >= Open`)
  - Red candles for bearish (`Close < Open`)
  - Pan by click-drag
  - Zoom using mouse wheel / touchpad pinch
  - Vertical zoom using `Shift + mouse wheel`
  - Auto-fit Y-axis to visible candles when panning/zooming in time
  - Tooltip on hover with Date, Open, High, Low, Close
- Built-in indicator pane:
  - Collapsible panel (Collapse/Expand) so chart remains visible
  - Dropdown-based indicator selection and visibility toggle
  - Tooltip controls: turn tooltip on/off and adjust tooltip transparency
- Standard vertical Volume Bars at chart base (separate from Volume Profile)
- Two VWAP modes:
  - Session VWAP (anchored at first candle)
  - Anchored VWAP (anchor at any candle using "Pick Placement / Anchor")
- Potential Reversal Candles indicator (toggle on/off)
- High Volume Candles indicator (toggle on/off):
  - Marks candles where volume is greater than average of last `N` candles
  - `N` is configurable from the indicator panel (`Volume N`)
- Multi-indicator Volume Profile system (uses `actual_volume`):
  - `Fixed Range Volume Profile` and `Anchored Volume Profile`
  - Add, remove, enable/disable each indicator independently
  - Apply multiple volume profiles simultaneously on one chart
  - Choose candle range with two-click range picker
  - Place profile bars anywhere horizontally (`Anchor %` slider or "Pick Placement")
  - Transparent horizontal bars so price candles remain visible
  - Profile analytics shown in panel: candle range, price range, POC, Value Area (VAL/VAH)
- Starts with ~70 candles visible by default (if enough rows exist)
- Opens automatically in your default browser

## Expected Excel Columns

The app expects OHLC columns and handles common name variations, such as:

- Date: `Date`, `date`, `DATE`, `Datetime`, `Timestamp`, `Trade Date`
- Open: `Open`, `Open Price`, `Opening`
- High: `High`, `High Price`
- Low: `Low`, `Low Price`
- Close: `Close`, `Close Price`, `Closing`
- Volume: `actual_volume`, `Actual Volume` (required for Volume Profile)

## Setup

1. Create and activate a Python virtual environment (recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

## How to use

1. Run the app:

```bash
python app.py
```

2. When prompted, enter the full path to your Excel file.
3. If the path or file format is invalid, the app shows an error and asks again.
4. Once parsed successfully, the chart opens in your default browser at:
   `http://127.0.0.1:5000`

### Indicator usage

1. Use **Add indicator** dropdown + **Add** button to add indicators.
2. Use **Selected** dropdown to choose which indicator to edit.
3. Use **Visible** toggle to show/hide the selected indicator.
4. For Volume Profile indicators, use **Pick Range (2 clicks)** and **Pick Placement**.
5. Tune profile **Bins**, **Width**, **Opacity**, and **Anchor %**.
6. Use **Collapse** on the panel when you want full chart visibility.
7. For Anchored VWAP, select it and click **Pick Placement / Anchor** then click desired candle.

## Notes

- Rows with invalid/missing Date, OHLC, or `actual_volume` values are skipped.
- Data is sorted by date before rendering.
- Indicator logic is modularized in separate files under `static/js/indicators/` for easy tweaking:
  - `volumeBarsIndicator.js`
  - `vwapIndicator.js`
  - `volumeProfileIndicator.js`
  - `potentialReversalIndicator.js`
