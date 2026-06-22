"""
Layers 3-5 — Cleaning, Aggregation, Feature Engineering
==========================================================
Reuses clean_tamilnadu_agri.py and aggregate.py UNCHANGED (calls them as
subprocesses with env-var paths). Then applies the same lag/rolling/
calendar feature logic as build_training_dataset_final.py.

Two modes:

  --mode serve    (daily) — produces live_features.csv: ONE latest row
                  per (District, Commodity), feature columns only, using
                  the FROZEN clip_bounds.csv from the last monthly retrain.
                  No target columns (nothing to predict from — that's
                  what predict.py is for). No quantiles are recomputed.

  --mode retrain  (monthly) — produces the full feature+target dataset
                  exactly as build_training_dataset_final.py +
                  prepare_training_data_v2.py did, INCLUDING recomputing
                  clip_bounds.csv fresh and the time-based split. This is
                  called by monthly_retrain.py, not run standalone.

Usage:
  python build_features.py --mode serve
  python build_features.py --mode retrain
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SCRIPT_DIR   = Path(__file__).parent
_DEFAULT_ROOT = SCRIPT_DIR.parent.parent / "pillar3_data"
ROOT = Path(os.environ.get("PIPELINE_ROOT", str(_DEFAULT_ROOT)))

# Models dir holds clip_bounds from last monthly retrain
_DEFAULT_MODELS = SCRIPT_DIR.parent / "models" / "latest"

MASTER_FILE      = Path(os.environ.get("MASTER_FILE",    str(ROOT / "combined_all_tamil_nadu.csv")))
CLEAN_OUT        = ROOT / "tn_agri_outputs"
AGG_OUT          = ROOT / "filtered_data"
BUILD_OUT        = ROOT / "training_data_corrected"
LIVE_DIR         = ROOT / "live"
CLIP_BOUNDS_FILE = Path(os.environ.get("CLIP_BOUNDS_FILE",
                         str(_DEFAULT_MODELS / "clip_bounds.csv")))

LEAKY_COLS = ["Min_Price", "Max_Price", "Price_Spread", "Price_Spread_Pct"]
PRICE_CHANGE_COLS = ["price_change_1d", "price_change_7d", "price_change_30d"]


def run_subprocess(cmd, env):
    print(f"\n--- {' '.join(str(c) for c in cmd)} ---")
    result = subprocess.run([str(c) for c in cmd], env=env)
    if result.returncode != 0:
        sys.exit(result.returncode)


def run_clean_and_aggregate():
    """Stages 3-4, unchanged logic, called as subprocesses."""
    base_env = os.environ.copy()

    env = base_env.copy()
    env["INPUT_FILE"] = str(MASTER_FILE)
    env["OUT_DIR"] = str(CLEAN_OUT)
    run_subprocess([sys.executable, SCRIPT_DIR / "clean_tamilnadu_agri.py"], env)

    env = base_env.copy()
    env["INPUT_FILE"] = str(CLEAN_OUT / "cleaned_tamil_nadu_agri_data.csv")
    env["OUT_DIR"] = str(AGG_OUT)
    run_subprocess([sys.executable, SCRIPT_DIR / "aggregate.py"], env)

    return AGG_OUT / "top10_forecasting_crops.csv"


def build_calendar_correct_features(df, group_cols, lags):
    """Same reindex-to-daily-then-shift logic as build_training_dataset_final.py."""
    def process_group(g):
        g = g.set_index("Arrival_Date").sort_index()
        full_range = pd.date_range(g.index.min(), g.index.max(), freq="D")
        is_real = pd.Series(True, index=g.index).reindex(full_range, fill_value=False)
        g = g.reindex(full_range)
        g["_is_real_observation"] = is_real

        for lag in lags:
            g[f"lag_{lag}"] = g["Modal_Price"].shift(lag)

        g["rolling_mean_7"]  = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).mean()
        g["rolling_mean_30"] = g["Modal_Price"].shift(1).rolling(30, min_periods=10).mean()
        g["rolling_std_7"]   = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).std()
        g["rolling_std_30"]  = g["Modal_Price"].shift(1).rolling(30, min_periods=10).std()

        real_dates = g.index.to_series().where(g["_is_real_observation"])
        last_real_date = real_dates.ffill().shift(1)
        g["days_since_last_observation"] = (g.index.to_series() - last_real_date).dt.days

        return g.reset_index().rename(columns={"index": "Arrival_Date"})

    processed = (
        df.groupby(group_cols, group_keys=True)
          .apply(process_group, include_groups=False)
          .reset_index(level=group_cols)
          .reset_index(drop=True)
    )
    real = processed[processed["_is_real_observation"]].copy()
    real = real.drop(columns=["_is_real_observation"])
    return real


def add_calendar_and_changes(df, clip_bounds=None):
    if "Month" not in df.columns:
        df["Month"] = df["Arrival_Date"].dt.month
    if "DayOfWeek" not in df.columns:
        df["DayOfWeek"] = df["Arrival_Date"].dt.dayofweek
    if "WeekOfYear" not in df.columns:
        df["WeekOfYear"] = df["Arrival_Date"].dt.isocalendar().week.astype(int)
    if "Quarter" not in df.columns:
        df["Quarter"] = df["Arrival_Date"].dt.quarter
    if "Year" not in df.columns:
        df["Year"] = df["Arrival_Date"].dt.year

    df["month_sin"] = np.sin(2 * np.pi * df["Month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["Month"] / 12)
    df["dow_sin"]   = np.sin(2 * np.pi * df["DayOfWeek"] / 7)
    df["dow_cos"]   = np.cos(2 * np.pi * df["DayOfWeek"] / 7)

    def pct_change_safe(curr, lagged):
        with np.errstate(divide="ignore", invalid="ignore"):
            out = (curr - lagged) / lagged
        out[lagged == 0] = np.nan
        return out

    df["price_change_1d"]  = pct_change_safe(df["Modal_Price"], df["lag_1"])
    df["price_change_7d"]  = pct_change_safe(df["Modal_Price"], df["lag_7"])
    df["price_change_30d"] = pct_change_safe(df["Modal_Price"], df["lag_30"])

    for col in [c for c in LEAKY_COLS if c in df.columns]:
        df = df.drop(columns=[col])

    if clip_bounds is not None:
        # SERVE mode — reuse frozen bounds from the last retrain, never recompute
        for _, row in clip_bounds.iterrows():
            col = row["feature"]
            if col in df.columns:
                df[col] = df[col].clip(lower=row["clip_lower"], upper=row["clip_upper"])

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    return df


def mode_serve():
    """Daily: read top10_forecasting_crops.csv directly (already clean + aggregated),
    build lag/rolling features, keep latest row per (District, Commodity).

    Skips the slow clean_tamilnadu_agri.py + aggregate.py subprocess calls — those
    are only needed for monthly retrain. update_master_dataset.py maintains
    top10_forecasting_crops.csv incrementally so this step stays fast (seconds).
    """
    top10_file = AGG_OUT / "top10_forecasting_crops.csv"
    if not top10_file.exists():
        print(f"ERROR: {top10_file} not found.")
        print("Run the full pipeline once: clean_tamilnadu_agri.py → aggregate.py → "
              "build_features.py --mode serve, or monthly_retrain.py.")
        sys.exit(1)

    print(f"Loading {top10_file} ...")
    df = pd.read_csv(top10_file, parse_dates=["Arrival_Date"], low_memory=False)
    print(f"  {len(df):,} rows, {df['Commodity'].nunique()} commodities, "
          f"{df['District'].nunique()} districts")
    df = df.sort_values(["District", "Commodity", "Arrival_Date"]).reset_index(drop=True)

    df = build_calendar_correct_features(df, ["District", "Commodity"], [1, 3, 7, 14, 21, 30])

    if not CLIP_BOUNDS_FILE.exists():
        print(f"WARNING: {CLIP_BOUNDS_FILE} not found — proceeding without clipping.")
        clip_bounds = None
    else:
        clip_bounds = pd.read_csv(CLIP_BOUNDS_FILE)

    df = add_calendar_and_changes(df, clip_bounds=clip_bounds)
    df["District"]  = df["District"].astype("category")
    df["Commodity"] = df["Commodity"].astype("category")

    latest = (
        df.sort_values("Arrival_Date")
          .groupby(["District", "Commodity"], observed=True)
          .tail(1)
          .reset_index(drop=True)
    )

    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = LIVE_DIR / "live_features.csv"
    latest.to_csv(out_path, index=False)
    print(f"\nServe-mode features: {len(latest):,} (District, Commodity) rows -> {out_path}")
    print(f"Most recent Arrival_Date in output: {latest['Arrival_Date'].max()}")


def mode_retrain():
    """Monthly: full feature build, target columns, fresh clip bounds — delegated
    to the existing build_training_dataset_final.py + prepare_training_data_v2.py
    so the retrain path stays byte-for-byte identical to what your models were
    validated against. This function just chains them."""
    agg_file = run_clean_and_aggregate()

    base_env = os.environ.copy()
    env = base_env.copy()
    env["INPUT_FILE"] = str(agg_file)
    env["OUT_DIR"] = str(BUILD_OUT)
    run_subprocess([sys.executable, SCRIPT_DIR / "build_training_dataset_final.py"], env)
    print(f"\nRetrain-mode feature build complete -> {BUILD_OUT / 'training_dataset_final.csv'}")
    print("Next: prepare_training_data_v2.py (called by monthly_retrain.py) builds "
          "targets, fresh clip_bounds, and the train/val/test split.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["serve", "retrain"], required=True)
    args = ap.parse_args()
    if args.mode == "serve":
        mode_serve()
    else:
        mode_retrain()


if __name__ == "__main__":
    main()
