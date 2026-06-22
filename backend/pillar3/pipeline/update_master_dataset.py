"""
Layer 2 — Incremental Master Dataset + Top-10 Crop Tracker
===========================================================
Reads the pointer file written by fetch_latest_data.py and does two things:

1. Appends new rows to combined_all_tamil_nadu.csv (full master — used for
   monthly retrain only).

2. Incrementally updates top10_forecasting_crops.csv — the lean, already-
   cleaned-and-aggregated file that build_features.py --mode serve reads
   directly, making the daily feature build fast (seconds, not minutes).

   Cleaning applied to new data only:
     • smart_title() text normalisation (same as clean_tamilnadu_agri.py)
     • Drop rows with missing/zero Modal_Price
     • Filter to top-10 commodities + their dominant variety (frozen from
       the last monthly retrain — doesn't change between retrains)
     • Aggregate to one median-price row per (Arrival_Date, District, Commodity)
     • Dedup against existing top10 file, append atomically

Usage:
  python update_master_dataset.py
"""
import os
import re
from pathlib import Path

import pandas as pd

_SCRIPT_DIR   = Path(__file__).parent
_DEFAULT_ROOT = _SCRIPT_DIR.parent.parent / "pillar3_data"

RAW_INCOMING_DIR = Path(os.environ.get("RAW_INCOMING_DIR",
                         str(_DEFAULT_ROOT / "raw_incoming")))
MASTER_FILE = Path(os.environ.get("MASTER_FILE",
                    str(_DEFAULT_ROOT / "combined_all_tamil_nadu.csv")))
TOP10_FILE  = Path(os.environ.get("TOP10_FILE",
                    str(_DEFAULT_ROOT / "filtered_data" / "top10_forecasting_crops.csv")))

KEY_COLS = ["Arrival_Date", "District", "Market", "Commodity", "Variety"]

# Dominant variety per commodity — determined from full training data.
# Only changes after a monthly retrain if aggregate.py finds a new dominant variety.
_DOMINANT_VARIETIES: dict[str, str] = {
    "Banana - Green":        "Banana - Green",
    "Bhindi(Ladies Finger)": "Bhindi",
    "Bitter Gourd":          "Bitter Gourd",
    "Cabbage":               "Cabbage",
    "Coconut":               "Coconut",
    "Green Chilli":          "Green Chilly",
    "Mint(Pudina)":          "Mint(Pudina)",
    "Onion":                 "Bellary",
    "Pumpkin":               "Pumpkin",
    "Tomato":                "Deshi",
}


def _smart_title(s: str) -> str:
    """Mirrors clean_tamilnadu_agri.py smart_title() exactly."""
    words = str(s).split()
    result = []
    for w in words:
        alpha_only = re.sub(r'[^A-Za-z]', '', w)
        if re.search(r'\d', w):
            result.append(w)
        elif alpha_only and alpha_only.isupper():
            result.append(w)
        elif alpha_only and alpha_only.islower():
            result.append(re.sub(r'[a-z]', lambda m: m.group().upper(), w, count=1))
        else:
            result.append(w)
    return ' '.join(result)


def _update_top10(raw_df: pd.DataFrame) -> None:
    """Clean new rows, filter to top-10 crops, aggregate, append to top10 file."""
    df = raw_df.copy()

    # Normalise text the same way clean_tamilnadu_agri.py does
    df["Commodity"] = df["Commodity"].apply(_smart_title)
    df["Variety"]   = df["Variety"].apply(_smart_title)
    df["District"]  = df["District"].str.title()
    df["Arrival_Date"] = pd.to_datetime(df["Arrival_Date"], dayfirst=True, errors="coerce")
    df["Modal_Price"]  = pd.to_numeric(df["Modal_Price"], errors="coerce")
    df = df.dropna(subset=["Arrival_Date", "Modal_Price"])
    df = df[df["Modal_Price"] > 0]

    # Filter to top-10 commodities + their dominant variety
    parts = []
    for commodity, dom_var in _DOMINANT_VARIETIES.items():
        mask = (df["Commodity"] == commodity) & (df["Variety"] == dom_var)
        parts.append(df[mask])

    filtered = pd.concat([p for p in parts if not p.empty], ignore_index=True)
    if filtered.empty:
        print("  top10: no matching rows in new data — file unchanged.")
        return

    # Aggregate: one median-price row per (Date, District, Commodity)
    new_agg = (
        filtered
        .groupby(["Arrival_Date", "District", "Commodity"])
        .agg(
            Modal_Price=("Modal_Price", "median"),
            records_aggregated=("Modal_Price", "count"),
        )
        .reset_index()
    )

    # Merge with existing top10 file, dedup on natural key
    if TOP10_FILE.exists():
        existing = pd.read_csv(TOP10_FILE, parse_dates=["Arrival_Date"], low_memory=False)
        before = len(existing)
        combined = pd.concat([existing, new_agg], ignore_index=True)
        combined = combined.drop_duplicates(
            subset=["Arrival_Date", "District", "Commodity"], keep="last"
        ).sort_values(["Commodity", "District", "Arrival_Date"]).reset_index(drop=True)
        added = len(combined) - before
    else:
        TOP10_FILE.parent.mkdir(parents=True, exist_ok=True)
        combined = new_agg.sort_values(
            ["Commodity", "District", "Arrival_Date"]
        ).reset_index(drop=True)
        added = len(combined)

    tmp = TOP10_FILE.with_suffix(".tmp.csv")
    combined.to_csv(tmp, index=False)
    tmp.replace(TOP10_FILE)
    print(f"  top10_forecasting_crops.csv: +{added:,} new rows  "
          f"(total {len(combined):,})")


def main():
    new_path = RAW_INCOMING_DIR / "_latest.csv"
    if not new_path.exists():
        print(f"No incoming file at {new_path} — fetch was skipped or not yet run. "
              f"Master dataset unchanged.")
        return

    new_data = pd.read_csv(new_path, low_memory=False)
    new_data["Arrival_Date"] = pd.to_datetime(new_data["Arrival_Date"], errors="coerce")
    print(f"Incoming: {len(new_data):,} rows")

    # ── 1. Update full master CSV ─────────────────────────────────────────────
    if MASTER_FILE.exists():
        master = pd.read_csv(MASTER_FILE, low_memory=False)
        master["Arrival_Date"] = pd.to_datetime(master["Arrival_Date"], errors="coerce")
        before = len(master)
    else:
        master = pd.DataFrame(columns=new_data.columns)
        before = 0

    combined = pd.concat([master, new_data], ignore_index=True)
    combined["_key"] = combined[KEY_COLS].astype(str).agg("|".join, axis=1)
    n_before_dedup = len(combined)
    combined = combined.drop_duplicates(subset="_key", keep="last").drop(columns=["_key"])

    print(f"Master before: {before:,} rows")
    print(f"After concat : {n_before_dedup:,} rows")
    print(f"After dedup  : {len(combined):,} rows  "
          f"({n_before_dedup - len(combined):,} duplicates removed)")

    MASTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = MASTER_FILE.with_suffix(".tmp.csv")
    combined.to_csv(tmp_path, index=False)
    tmp_path.replace(MASTER_FILE)
    print(f"Saved master -> {MASTER_FILE}")

    # ── 2. Incrementally update top10_forecasting_crops.csv ──────────────────
    print("Updating top10_forecasting_crops.csv...")
    _update_top10(new_data)


if __name__ == "__main__":
    main()
