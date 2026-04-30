import threading
import webbrowser
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd
from flask import Flask, render_template

app = Flask(__name__)

OHLC_DATA: List[Dict[str, object]] = []


def _normalize_column_name(name: object) -> str:
    text = str(name).strip().lower()
    return "".join(ch for ch in text if ch.isalnum())


def _score_column(target: str, column_name: str) -> int:
    normalized = _normalize_column_name(column_name)
    score = 0

    alias_map = {
        "date": ["date", "datetime", "timestamp", "tradedate", "time", "candledate", "pricedate"],
        "open": ["open", "openprice", "opening", "openingprice"],
        "high": ["high", "highprice"],
        "low": ["low", "lowprice"],
        "close": ["close", "closeprice", "closing", "closingprice"],
    }
    avoid_map = {
        "date": ["open", "high", "low", "close", "price", "volume", "interest"],
        "open": ["interest", "time", "date", "timestamp", "volume"],
        "high": ["time", "date", "timestamp", "volume"],
        "low": ["time", "date", "timestamp", "volume"],
        "close": ["time", "date", "timestamp", "volume"],
    }

    for alias in alias_map[target]:
        if normalized == alias:
            score += 120
        elif normalized.startswith(alias):
            score += 70
        elif alias in normalized:
            score += 40

    for term in avoid_map[target]:
        if term in normalized:
            score -= 45

    # Token-based boost helps variants like "Open Price USD".
    tokens = [token for token in str(column_name).lower().replace("_", " ").split() if token]
    if target in tokens:
        score += 35
    if f"{target}price" in normalized:
        score += 25

    return score


def _assign_best_columns(columns: List[str]) -> Dict[str, Optional[str]]:
    targets = ["date", "open", "high", "low", "close"]
    candidate_scores: Dict[str, List[Tuple[str, int]]] = {}
    for target in targets:
        scored = [(col, _score_column(target, col)) for col in columns]
        scored = [pair for pair in scored if pair[1] > 0]
        scored.sort(key=lambda item: item[1], reverse=True)
        candidate_scores[target] = scored

    best_total = -1
    best_mapping: Dict[str, Optional[str]] = {target: None for target in targets}

    def backtrack(idx: int, used: Set[str], running_total: int, current: Dict[str, Optional[str]]) -> None:
        nonlocal best_total, best_mapping
        if idx == len(targets):
            if running_total > best_total:
                best_total = running_total
                best_mapping = dict(current)
            return

        target = targets[idx]
        picked_any = False
        for col, score in candidate_scores[target]:
            if col in used:
                continue
            picked_any = True
            current[target] = col
            used.add(col)
            backtrack(idx + 1, used, running_total + score, current)
            used.remove(col)
            current[target] = None

        # Allow a target to remain unmapped so we can still get a partial best candidate.
        if not picked_any:
            current[target] = None
            backtrack(idx + 1, used, running_total, current)

    backtrack(0, set(), 0, {target: None for target in targets})
    return best_mapping


def _find_actual_volume_column(columns: List[str]) -> Optional[str]:
    normalized_pairs = [(_normalize_column_name(col), col) for col in columns]
    preferred = {
        "actualvolume",
        "actualvol",
        "volumeactual",
        "realvolume",
    }

    for normalized, original in normalized_pairs:
        if normalized in preferred:
            return original

    for normalized, original in normalized_pairs:
        if "actual" in normalized and "volume" in normalized:
            return original

    # Fallback: accept plain "volume" only when there is no better candidate.
    for normalized, original in normalized_pairs:
        if normalized == "volume":
            return original

    return None


def _coerce_numeric_series(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.replace(",", "", regex=False)
    cleaned = cleaned.str.replace(r"[^0-9eE\.\-\+]", "", regex=True)
    return pd.to_numeric(cleaned, errors="coerce")


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
    mapped = _assign_best_columns(columns)
    volume_col = _find_actual_volume_column(columns)

    missing = [key for key, value in mapped.items() if value is None]
    if missing:
        raise ValueError(
            "Could not identify required column(s): "
            + ", ".join(missing).upper()
            + ". Expected Date/Open/High/Low/Close (common naming variations are supported)."
        )
    if volume_col is None:
        raise ValueError(
            "Could not identify required volume column. Expected 'actual_volume' "
            "(or close variation like 'Actual Volume')."
        )

    print(
        "Detected columns -> "
        f"Date: {mapped['date']}, Open: {mapped['open']}, High: {mapped['high']}, "
        f"Low: {mapped['low']}, Close: {mapped['close']}, Volume: {volume_col}"
    )

    selected = df[
        [mapped["date"], mapped["open"], mapped["high"], mapped["low"], mapped["close"], volume_col]
    ].copy()
    selected.columns = ["Date", "Open", "High", "Low", "Close", "Volume"]

    selected["Date"] = pd.to_datetime(selected["Date"], errors="coerce")
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        selected[col] = _coerce_numeric_series(selected[col])

    selected = selected.dropna(subset=["Date", "Open", "High", "Low", "Close", "Volume"])
    if selected.empty:
        raise ValueError("No valid OHLC + actual_volume rows were found after parsing and cleaning.")

    # Reject incorrect fuzzy mappings (for example "Open Interest" used as Open).
    ohlc_ok = (
        (selected["High"] >= selected[["Open", "Close"]].max(axis=1))
        & (selected["Low"] <= selected[["Open", "Close"]].min(axis=1))
        & (selected["High"] >= selected["Low"])
    )
    valid_ratio = float(ohlc_ok.mean())
    if valid_ratio < 0.75:
        raise ValueError(
            "Detected columns do not look like valid OHLC data. "
            f"Matched columns were Date='{mapped['date']}', Open='{mapped['open']}', "
            f"High='{mapped['high']}', Low='{mapped['low']}', Close='{mapped['close']}'. "
            "Please verify your file has standard OHLC columns."
        )

    selected = selected.sort_values("Date")

    return [
        {
            "date": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "open": float(opn),
            "high": float(high),
            "low": float(low),
            "close": float(close),
            "volume": max(float(volume), 0.0),
        }
        for dt, opn, high, low, close, volume in selected.itertuples(index=False, name=None)
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