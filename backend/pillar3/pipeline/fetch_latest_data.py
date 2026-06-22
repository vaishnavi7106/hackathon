"""
Layer 1 — Daily Data Ingestion
================================
Pulls the trailing N days from the AGMARKNET API and writes a dated
raw file. Does NOT touch the master dataset — that's update_master_dataset.py.

If AGMARKNET_API_KEY is not set, logs a warning and exits without error —
the rest of the daily pipeline (update_master_dataset, build_features) still
runs and will serve predictions from the existing master dataset.

Usage:
  python fetch_latest_data.py
  python fetch_latest_data.py --lookback-days 10
"""
import argparse
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests

API_BASE = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
PAGE_LIMIT = 200   # small pages to avoid IncompleteRead on the AGMARKNET server

FIELD_MAP = {
    "state": "State", "district": "District", "market": "Market",
    "commodity": "Commodity", "variety": "Variety", "grade": "Grade",
    "arrival_date": "Arrival_Date", "min_price": "Min_Price",
    "max_price": "Max_Price", "modal_price": "Modal_Price",
    "commodity_code": "Commodity_Code",
}

_SCRIPT_DIR = Path(__file__).parent
_DEFAULT_ROOT = _SCRIPT_DIR.parent.parent / "pillar3_data"

RAW_INCOMING_DIR = Path(os.environ.get("RAW_INCOMING_DIR",
                         str(_DEFAULT_ROOT / "raw_incoming")))


def _fetch_page(api_key: str, state: str, offset: int, retries: int = 3) -> list:
    """Fetch one page with retry on connection errors."""
    url = (
        f"{API_BASE}?api-key={api_key}"
        f"&format=json&offset={offset}&limit={PAGE_LIMIT}"
        f"&filters[State]={state.replace(' ', '+')}"
    )
    for attempt in range(retries):
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
            r.raise_for_status()
            return r.json().get("records", [])
        except Exception as exc:
            if attempt < retries - 1:
                wait = 2 ** attempt  # 1s, 2s backoff
                print(f"  Page offset={offset} attempt {attempt+1} failed ({exc}), "
                      f"retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise


def fetch_all(api_key: str, state: str) -> pd.DataFrame:
    records, offset = [], 0
    while True:
        try:
            page = _fetch_page(api_key, state, offset)
        except Exception as exc:
            # Return whatever we collected — partial history is better than nothing
            if records:
                print(f"  Page offset={offset} failed after all retries ({exc}).")
                print(f"  Returning {len(records):,} records collected before failure.")
                break
            raise  # nothing collected yet → propagate so main() can log and exit
        if not page:
            break
        records.extend(page)
        print(f"  Fetched {len(records):,} records so far (offset {offset})...")
        offset += PAGE_LIMIT
        time.sleep(0.3)
    return pd.DataFrame(records)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default="Tamil Nadu")
    ap.add_argument("--lookback-days", type=int, default=10,
                    help="Overlap with previous fetches is fine — "
                         "dedup happens in update_master_dataset.py")
    args = ap.parse_args()

    api_key = os.environ.get("AGMARKNET_API_KEY", "").strip()
    if not api_key:
        print("WARNING: AGMARKNET_API_KEY not set — skipping live fetch. "
              "Predictions will use the existing master dataset.")
        return

    RAW_INCOMING_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Fetching state={args.state}, lookback={args.lookback_days}d...")
    try:
        raw = fetch_all(api_key, args.state)
    except Exception as exc:
        print(f"WARNING: AGMARKNET API fetch failed ({exc}) — skipping.")
        return

    print(f"  Fetched {len(raw):,} raw records")

    if raw.empty:
        print("No records returned.")
        return

    raw = raw.rename(columns=FIELD_MAP)
    raw["Arrival_Date"] = pd.to_datetime(raw["Arrival_Date"], dayfirst=True, errors="coerce")
    cutoff = datetime.now() - timedelta(days=args.lookback_days)
    raw = raw[raw["Arrival_Date"] >= cutoff]

    keep_cols = [c for c in FIELD_MAP.values() if c in raw.columns]
    raw = raw[keep_cols]

    out_path = RAW_INCOMING_DIR / f"raw_{datetime.now():%Y%m%d_%H%M%S}.csv"
    raw.to_csv(out_path, index=False)
    print(f"Saved {len(raw):,} rows -> {out_path}")

    latest_path = RAW_INCOMING_DIR / "_latest.csv"
    raw.to_csv(latest_path, index=False)
    print(f"Updated pointer -> {latest_path}")


if __name__ == "__main__":
    main()
