"""
Tamil Nadu Crop Price Forecasting — Training Data Preparation v2
================================================================
Applies all fixes to training_dataset_final.csv:

  FIX 1 — Remove Coconut unit-switch anomaly
           30 rows in Erode/Kanyakumari/Dindigul where Modal_Price < 200
           (Jun 19 – Jul 7, 2024) are physically impossible coconut prices
           per 100 units; confirmed per-nut pricing error in AGMARKNET.

  FIX 2 — Drop same-day leaky features
           Min_Price, Max_Price, Price_Spread, Price_Spread_Pct are
           0.977–0.997 correlated with Modal_Price on the SAME day.
           At inference time you won't have the same-day Min/Max, so
           including them lets the model reconstruct the target trivially.

  FIX 3 — Clip price_change_* at 1st/99th percentile
           Computed AFTER FIX 1 so the Coconut anomaly doesn't skew
           the clip bounds. Remaining outliers (Mint/Green Chilli group
           starts, genuine spike-and-revert events) are bounded rather
           than removed — they are real market signal, just extreme.

  FIX 4 — Build multi-horizon forward targets
           target_1d  ... target_30d: Modal_Price N calendar days ahead.
           Uses the same reindex-to-daily strategy as the backward lags
           so "30 days ahead" means 30 CALENDAR days, not 30 rows.
           The target column used at training time depends on your
           chosen forecast horizon (see HORIZON_DAYS below).

  FIX 5 — Time-based train / val / test split
           train : < 2026-01-01   (~87% of data)
           val   : 2026-01-01 – 2026-03-31  (tune hyperparams here)
           test  : >= 2026-04-01  (held-out; touch only for final eval)
           NO random shuffling — that would leak future into past.

OUTPUT
------
  training_data_v2/
    dataset_v2.csv           — full cleaned dataset with all targets
    train.csv / val.csv / test.csv — splits ready for lgb.Dataset()
    clip_bounds.csv          — clip bounds used (for inference pipeline)
    fix_summary.txt          — human-readable audit trail
"""

import os
import numpy as np
import pandas as pd

# ============================================================
# CONFIG
# ============================================================

INPUT_FILE   = r"C:\Users\amizh\Downloads\pillar3\training_data_corrected\training_dataset_final.csv"
OUT_DIR      = r"C:\Users\amizh\Downloads\pillar3\latest"

os.makedirs(OUT_DIR, exist_ok=True)

GROUP_COLS      = ["District", "Commodity"]
HORIZONS        = [1, 3, 7, 14, 21, 30]   # calendar days ahead
TRAIN_END       = "2025-12-31"
VAL_END         = "2026-03-31"

PRICE_CHANGE_COLS = ["price_change_1d", "price_change_7d", "price_change_30d"]

LEAKY_COLS = ["Min_Price", "Max_Price", "Price_Spread", "Price_Spread_Pct"]

log_lines = []

def log(msg=""):
    print(msg)
    log_lines.append(msg)

# ============================================================
# LOAD
# ============================================================

log("=" * 70)
log("LOAD")
log("=" * 70)

df = pd.read_csv(INPUT_FILE, parse_dates=["Arrival_Date"], low_memory=False)
log(f"Rows loaded  : {len(df):,}")
log(f"Date range   : {df['Arrival_Date'].min().date()} → {df['Arrival_Date'].max().date()}")
log(f"Commodities  : {df['Commodity'].nunique()}")
log(f"Districts    : {df['District'].nunique()}")

# ============================================================
# FIX 1 — Remove Coconut unit-switch anomaly
# ============================================================

log()
log("=" * 70)
log("FIX 1 — COCONUT UNIT-SWITCH ANOMALY")
log("=" * 70)

coconut_anomaly_mask = (df["Commodity"] == "Coconut") & (df["Modal_Price"] < 200)
n_anomaly = coconut_anomaly_mask.sum()

log(f"Anomaly rows (Coconut Modal_Price < 200): {n_anomaly}")
log("Affected rows:")
log(df[coconut_anomaly_mask][["Commodity","District","Arrival_Date","Modal_Price"]].to_string(index=False))

df = df[~coconut_anomaly_mask].copy()

# After removing anomaly rows, the lag/rolling features that USED those
# rows as their lookback anchor are now stale for the immediately following
# rows (e.g. lag_1 on 2024-07-10 in Erode Coconut now points to the
# deleted row of 2024-07-07).  We must recompute lag/rolling features
# for the affected groups from scratch on the cleaned price series.
#
# Strategy: identify groups that contained anomaly rows, recompute their
# lag/rolling/price_change features, then splice back.

affected_groups = (
    df[["District","Commodity"]]   # already removed anomaly rows
    .merge(
        df[coconut_anomaly_mask.reindex(df.index, fill_value=False)
           | pd.Series(False, index=df.index)]   # trick: we need original affected group keys
        if False else
        pd.DataFrame([{"District": "Erode", "Commodity": "Coconut"},
                      {"District": "Kanyakumari", "Commodity": "Coconut"},
                      {"District": "Dindigul", "Commodity": "Coconut"}]),
        on=["District","Commodity"],
        how="inner"
    )[["District","Commodity"]].drop_duplicates()
)

log(f"\nGroups needing lag recomputation: {len(affected_groups)}")

LAGS = [1, 3, 7, 14, 21, 30]

def recompute_lags_for_group(g: pd.DataFrame) -> pd.DataFrame:
    """Recompute all lag/rolling/price_change features on a continuous date axis."""
    g = g.set_index("Arrival_Date").sort_index()
    full_range = pd.date_range(g.index.min(), g.index.max(), freq="D")
    is_real = pd.Series(True, index=g.index).reindex(full_range, fill_value=False)
    g = g.reindex(full_range)
    g["_real"] = is_real

    for lag in LAGS:
        g[f"lag_{lag}"] = g["Modal_Price"].shift(lag)

    g["rolling_mean_7"]  = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).mean()
    g["rolling_mean_30"] = g["Modal_Price"].shift(1).rolling(30, min_periods=10).mean()
    g["rolling_std_7"]   = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).std()
    g["rolling_std_30"]  = g["Modal_Price"].shift(1).rolling(30, min_periods=10).std()

    real_dates    = g.index.to_series().where(g["_real"])
    last_real     = real_dates.ffill().shift(1)
    g["days_since_last_observation"] = (g.index.to_series() - last_real).dt.days

    g = g[g["_real"]].drop(columns=["_real"])
    g = g.reset_index().rename(columns={"index": "Arrival_Date"})

    with np.errstate(divide="ignore", invalid="ignore"):
        g["price_change_1d"]  = (g["Modal_Price"] - g["lag_1"])  / g["lag_1"]
        g["price_change_7d"]  = (g["Modal_Price"] - g["lag_7"])  / g["lag_7"]
        g["price_change_30d"] = (g["Modal_Price"] - g["lag_30"]) / g["lag_30"]

    for col in ["price_change_1d", "price_change_7d", "price_change_30d"]:
        lag_col = col.replace("price_change_", "lag_").replace("d", "")
        # lag col is lag_1, lag_7, lag_30
        lag_name = "lag_" + col.split("_")[2].replace("d","")
        g.loc[g[lag_name] == 0, col] = np.nan

    return g

# Splice recomputed rows back
for _, row in affected_groups.iterrows():
    dist, comm = row["District"], row["Commodity"]
    group_mask = (df["District"] == dist) & (df["Commodity"] == comm)
    group_df   = df[group_mask].copy()
    recomputed  = recompute_lags_for_group(group_df)
    # align columns
    for col in df.columns:
        if col not in recomputed.columns:
            recomputed[col] = np.nan
    df = df[~group_mask]
    df = pd.concat([df, recomputed[df.columns]], ignore_index=True)

df = df.sort_values(GROUP_COLS + ["Arrival_Date"]).reset_index(drop=True)
log(f"\nRows after FIX 1: {len(df):,}")

# ============================================================
# FIX 2 — Drop leaky same-day features
# ============================================================

log()
log("=" * 70)
log("FIX 2 — DROP LEAKY SAME-DAY FEATURES")
log("=" * 70)

log(f"Dropping: {LEAKY_COLS}")
df = df.drop(columns=LEAKY_COLS)
log(f"Remaining columns: {len(df.columns)}")

# ============================================================
# FIX 3 — Clip price_change_* at 1st/99th percentile
# ============================================================

log()
log("=" * 70)
log("FIX 3 — CLIP PRICE_CHANGE FEATURES")
log("=" * 70)

clip_records = []
for col in PRICE_CHANGE_COLS:
    q01 = df[col].quantile(0.01)
    q99 = df[col].quantile(0.99)
    n_clipped = ((df[col] < q01) | (df[col] > q99)).sum()
    df[col] = df[col].clip(lower=q01, upper=q99)
    log(f"  {col}: clipped at [{q01:.4f}, {q99:.4f}]  →  {n_clipped:,} values bounded")
    clip_records.append({"feature": col, "clip_lower": q01, "clip_upper": q99})

clip_df = pd.DataFrame(clip_records)
clip_df.to_csv(os.path.join(OUT_DIR, "clip_bounds.csv"), index=False)
log(f"\nClip bounds saved → clip_bounds.csv  (apply these at inference time)")

# ============================================================
# FIX 4 — Multi-horizon forward targets
# ============================================================

log()
log("=" * 70)
log("FIX 4 — MULTI-HORIZON FORWARD TARGETS")
log("=" * 70)
log(f"Building targets: {HORIZONS} calendar days ahead")

def build_forward_targets(g: pd.DataFrame, horizons: list) -> pd.DataFrame:
    """
    For each (District, Commodity) group, reindex to a continuous daily
    date range and shift Modal_Price FORWARD by N days.  Dropping filler
    rows at the end guarantees target_N means exactly N calendar days ahead.
    """
    g = g.set_index("Arrival_Date").sort_index()
    full_range = pd.date_range(g.index.min(), g.index.max(), freq="D")
    is_real = pd.Series(True, index=g.index).reindex(full_range, fill_value=False)
    g = g.reindex(full_range)
    g["_real"] = is_real

    for h in horizons:
        # shift(-h): row at date D gets the price from date D+h
        g[f"target_{h}d"] = g["Modal_Price"].shift(-h)

    g = g[g["_real"]].drop(columns=["_real"])
    return g.reset_index().rename(columns={"index": "Arrival_Date"})

target_cols = [f"target_{h}d" for h in HORIZONS]

processed = (
    df.groupby(GROUP_COLS, group_keys=True)
      .apply(build_forward_targets, horizons=HORIZONS, include_groups=False)
      .reset_index(level=GROUP_COLS)
      .reset_index(drop=True)
)

df = processed.copy()

log()
log("Rows with valid target per horizon:")
for col in target_cols:
    log(f"  {col}: {df[col].notna().sum():,} valid  ({df[col].isna().sum():,} NaN — tail of each group)")

# ============================================================
# ENFORCE lag_30 completeness (carry forward from v1 filter)
# ============================================================

log()
log("Enforcing lag_30 not-null (rows without 30-day lookback history)...")
before = len(df)
df = df.dropna(subset=["lag_30"]).copy()
log(f"  Dropped {before - len(df):,} rows  →  {len(df):,} remaining")

# ============================================================
# REPLACE INF
# ============================================================

df.replace([np.inf, -np.inf], np.nan, inplace=True)

# ============================================================
# FIX 5 — Time-based split
# ============================================================

log()
log("=" * 70)
log("FIX 5 — TIME-BASED TRAIN / VAL / TEST SPLIT")
log("=" * 70)

train = df[df["Arrival_Date"] <= TRAIN_END].copy()
val   = df[(df["Arrival_Date"] > TRAIN_END) & (df["Arrival_Date"] <= VAL_END)].copy()
test  = df[df["Arrival_Date"] > VAL_END].copy()

log(f"  train : ≤ {TRAIN_END}          → {len(train):,} rows")
log(f"  val   : {TRAIN_END[:7]} – {VAL_END} → {len(val):,} rows")
log(f"  test  : > {VAL_END}          → {len(test):,} rows")

for split, name in [(train,"train"),(val,"val"),(test,"test")]:
    log(f"\n  {name} commodity distribution:")
    log("  " + str(split.groupby("Commodity").size().sort_values(ascending=False).to_dict()))

# ============================================================
# FEATURE LIST (for reference at training time)
# ============================================================

NON_FEATURE_COLS = ["Arrival_Date"] + target_cols
FEATURE_COLS = [c for c in df.columns if c not in NON_FEATURE_COLS]

log()
log("=" * 70)
log("FEATURE COLUMNS")
log("=" * 70)
for c in FEATURE_COLS:
    log(f"  {c}")

log()
log("TARGET COLUMNS (choose one per training run):")
for c in target_cols:
    log(f"  {c}")

# ============================================================
# SAVE
# ============================================================

log()
log("=" * 70)
log("SAVING")
log("=" * 70)

df.to_csv(os.path.join(OUT_DIR, "dataset_v2.csv"), index=False)
train.to_csv(os.path.join(OUT_DIR, "train.csv"), index=False)
val.to_csv(os.path.join(OUT_DIR, "val.csv"), index=False)
test.to_csv(os.path.join(OUT_DIR, "test.csv"), index=False)

with open(
    os.path.join(OUT_DIR, "fix_summary.txt"),
    "w",
    encoding="utf-8"
) as f:
    f.write("\n".join(log_lines))
log(f"  dataset_v2.csv  : {len(df):,} rows, {len(df.columns)} columns")
log(f"  train.csv       : {len(train):,} rows")
log(f"  val.csv         : {len(val):,} rows")
log(f"  test.csv        : {len(test):,} rows")
log(f"  clip_bounds.csv : 3 rows")
log(f"  fix_summary.txt : audit log")
log()
log("Done.")
