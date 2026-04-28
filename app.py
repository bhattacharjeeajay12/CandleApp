import os
import threading
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from flask import Flask, render_template

app = Flask(__name__)

OHLC_DATA: List[Dict[str, object]] = []


def _normalize_column_name(name: object) -> str:
    text = str(name).strip().lower()
    return "".join(ch for ch in text if ch.isalnum())


def _pick_best_column(columns: List[str], target: str) -> Optional[str]:
    normalized_map = {_normalize_column_name(col): col for col in columns}

    alias_map = {
        "date": [
            "date",
            "datetime",
            "timestamp",
            "tradedate",
            "time",
            "candledate",
            "pricedate",
        ],
        "open": ["open", "openprice", "opening", "openingprice", "o"],
        "high": ["high", "highprice", "h"],
        "low": ["low", "lowprice", "l"],
        "close": ["close", "closeprice", "closing", "closingprice", "c"],
    }

    for alias in alias_map[target]:
        if alias in normalized_map:
            return normalized_map[alias]

    for norm_name, original_name in normalized_map.items():
        if target in norm_name:
            return original_name

    return None


def _read_excel_file(file_path: Path) -> pd.DataFrame:
    suffix = file_path.suffix.lower()
    if suffix == ".xlsx":
        return pd.read_excel(file_path, engine="openpyxl")
    if suffix == ".xls":
        return pd.read_excel(file_path)
    raise ValueError("Only .xlsx and .xls files are supported.")


def parse_ohlc_data(file_path: str) -> List[Dict[str, object]]:
    path = Path(file_path.strip().strip('"')).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    if path.suffix.lower() not in {".xlsx", ".xls"}:
        raise ValueError("Please provide an Excel file with .xlsx or .xls extension.")

    try:
        df = _read_excel_file(path)
    except Exception as exc:
        raise ValueError(f"Unable to read Excel file: {exc}") from exc

    if df.empty:
        raise ValueError("The Excel file is empty.")

    columns = list(df.columns)
    mapped = {
        "date": _pick_best_column(columns, "date"),
        "open": _pick_best_column(columns, "open"),
        "high": _pick_best_column(columns, "high"),
        "low": _pick_best_column(columns, "low"),
        "close": _pick_best_column(columns, "close"),
    }

    missing = [key for key, value in mapped.items() if value is None]
    if missing:
        raise ValueError(
            "Could not identify required column(s): "
            + ", ".join(missing).upper()
            + ". Expected Date/Open/High/Low/Close (common naming variations are supported)."
        )

    selected = df[[mapped["date"], mapped["open"], mapped["high"], mapped["low"], mapped["close"]]].copy()
    selected.columns = ["Date", "Open", "High", "Low", "Close"]

    selected["Date"] = pd.to_datetime(selected["Date"], errors="coerce")
    for col in ["Open", "High", "Low", "Close"]:
        selected[col] = pd.to_numeric(selected[col], errors="coerce")

    selected = selected.dropna(subset=["Date", "Open", "High", "Low", "Close"])
    if selected.empty:
        raise ValueError("No valid OHLC rows were found after parsing and cleaning.")

    selected = selected.sort_values("Date")

    return [
        {
            "date": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "open": float(opn),
            "high": float(high),
            "low": float(low),
            "close": float(close),
        }
        for dt, opn, high, low, close in selected.itertuples(index=False, name=None)
    ]


def prompt_for_file_path() -> str:
    while True:
        user_input = input("Enter full path to Excel file (.xlsx/.xls): ").strip()
        try:
            global OHLC_DATA
            OHLC_DATA = parse_ohlc_data(user_input)
            print(f"Loaded {len(OHLC_DATA)} candles from file.")
            return user_input
        except Exception as exc:
            print(f"Error: {exc}")
            print("Please try again with a valid Excel file path.\n")


@app.route("/")
def index():
    return render_template("index.html", ohlc_data=OHLC_DATA)


def open_browser_after_delay():
    webbrowser.open("http://127.0.0.1:5000")


def main():
    prompt_for_file_path()
    threading.Timer(1.0, open_browser_after_delay).start()
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
