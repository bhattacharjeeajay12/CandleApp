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
  - Tooltip on hover with Date, Open, High, Low, Close
- Starts with ~70 candles visible by default (if enough rows exist)
- Opens automatically in your default browser

## Expected Excel Columns

The app expects OHLC columns and handles common name variations, such as:

- Date: `Date`, `date`, `DATE`, `Datetime`, `Timestamp`, `Trade Date`
- Open: `Open`, `Open Price`, `Opening`
- High: `High`, `High Price`
- Low: `Low`, `Low Price`
- Close: `Close`, `Close Price`, `Closing`

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

## Notes

- Rows with invalid/missing Date or OHLC values are skipped.
- Data is sorted by date before rendering.
