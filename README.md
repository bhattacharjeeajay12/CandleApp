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
- Multi-indicator Volume Profile system (uses `actual_volume`):
  - `Fixed Range Volume Profile` and `Anchored Volume Profile`
  - Add, remove, enable/disable each indicator independently
  - Apply multiple volume profiles simultaneously on one chart
  - Choose candle range with two-click range picker
  - Place profile bars anywhere horizontally (`Anchor %` slider or "Pick Placement")
  - Transparent horizontal bars so price candles remain visible
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

### Volume Profile usage

1. Use **Add** to add `Fixed` or `Anchored` profile indicators.
2. Use the checkbox to show/hide an indicator and the radio button to make one active.
3. Click **Pick Range (2 clicks)**, then click start and end candles on chart.
4. Click **Pick Placement**, then click a candle where profile bars should be anchored.
5. Tune **Bins**, **Width**, **Opacity**, and **Anchor %**.
6. You can keep multiple indicators enabled together.

## Notes

- Rows with invalid/missing Date, OHLC, or `actual_volume` values are skipped.
- Data is sorted by date before rendering.
