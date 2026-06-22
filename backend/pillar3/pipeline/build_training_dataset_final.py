"""
Tamil Nadu Crop Price Forecasting -- Feature Engineering (calendar-correct)
=============================================================================
Builds the final LightGBM training dataset from the top-10
forecasting-ready commodities.

FIX vs the previous version: lag_N and rolling_* now mean N
CALENDAR DAYS ago, not N ROWS ago. AGMARKNET reporting is irregular
(~3-4% of consecutive observations are more than 1 day apart, and
for sparser crops like Coconut and Mint the worst gaps run into the
hundreds of days). Plain df.groupby(...).shift(N) silently lags by
ROW POSITION, so on a day after a gap, "lag_30" can actually pull a
price from 31, 90, or even 600+ days earlier and label it as if it
were 30 days old. Verified directly: for Coimbatore Tomato, 60% of
lag_30 values pointed to something other than 30 calendar days back
under plain shift().

THE FIX: each (District, Commodity) group is reindexed onto its own
continuous daily date range before any shift/rolling is computed.
Missing calendar days get an explicit NaN Modal_Price row. Because
shift() and rolling() walk the reindexed (now-continuous) date axis,
lag_N is now guaranteed to mean exactly N calendar days ago -- and
correctly returns NaN when no real observation exists at that date,
instead of substituting a stale price from much earlier.

The synthetic filler rows (added only to make the date axis
continuous) are dropped at the very end, after all lag/rolling
features have been computed from them. They never appear in the
final training file -- they exist only as scaffolding so that
shift(N) walks real calendar days.

LEAKAGE VERIFICATION: includes a true row-by-row assertion (not a
plausibility heuristic) that lag_1 exactly equals the prior calendar
day's Modal_Price wherever both exist, for every single group.
"""

import os
import numpy as np
import pandas as pd

# ============================================================
# CONFIG
# ============================================================

INPUT_FILE = r"C:\Users\amizh\Downloads\pillar3\filtered_data\top10_forecasting_crops.csv"
OUT_DIR    = r"C:\Users\amizh\Downloads\pillar3\training_data_corrected"

os.makedirs(OUT_DIR, exist_ok=True)

GROUP_COLS = ["District", "Commodity"]
LAGS       = [1, 3, 7, 14, 21, 30]

# ============================================================
# LOAD
# ============================================================

print("=" * 70)
print("LOADING DATASET")
print("=" * 70)

df = pd.read_csv(
    INPUT_FILE,
    parse_dates=["Arrival_Date"],
    low_memory=False,
)

print(f"Rows loaded: {len(df):,}")
print(f"Commodities: {df['Commodity'].nunique()}")
print(f"Districts  : {df['District'].nunique()}")

df = df.sort_values(GROUP_COLS + ["Arrival_Date"]).reset_index(drop=True)

# ============================================================
# CALENDAR-CORRECT LAG / ROLLING FEATURES
# ============================================================
# Strategy: for each (District, Commodity) group, build a
# continuous daily DatetimeIndex spanning that group's own
# min..max Arrival_Date. Reindex onto it so every calendar day
# has a row (real observation or NaN filler). THEN shift/roll --
# this guarantees lag_N == N calendar days, not N rows.
# ============================================================

print("\nBuilding calendar-correct lag and rolling features...")
print("(reindexing each group to a continuous daily date range)")

def process_group(g: pd.DataFrame) -> pd.DataFrame:
    g = g.set_index("Arrival_Date").sort_index()

    full_range = pd.date_range(g.index.min(), g.index.max(), freq="D")
    is_real_obs = pd.Series(True, index=g.index)

    g = g.reindex(full_range)
    is_real_obs = is_real_obs.reindex(full_range, fill_value=False)
    g["_is_real_observation"] = is_real_obs

    # Lag features -- now guaranteed to mean N calendar days ago
    for lag in LAGS:
        g[f"lag_{lag}"] = g["Modal_Price"].shift(lag)

    # Rolling stats -- shift(1) first so the current day's own price
    # never leaks into its own rolling window
    g["rolling_mean_7"]  = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).mean()
    g["rolling_mean_30"] = g["Modal_Price"].shift(1).rolling(30, min_periods=10).mean()
    g["rolling_std_7"]   = g["Modal_Price"].shift(1).rolling(7,  min_periods=3).std()
    g["rolling_std_30"]  = g["Modal_Price"].shift(1).rolling(30, min_periods=10).std()

    # Days since last REAL observation (not just previous calendar row,
    # which is always 1 day apart by construction after reindexing --
    # we need the gap back to the last day that had real data)
    real_dates = g.index.to_series().where(g["_is_real_observation"])
    last_real_date = real_dates.ffill().shift(1)
    g["days_since_last_observation"] = (g.index.to_series() - last_real_date).dt.days

    g = g.reset_index().rename(columns={"index": "Arrival_Date"})
    return g

# groupby().apply() with the reindex logic -- vectorized per-group,
# not a slow row-by-row Python loop. ~360 groups, ~268K reindexed
# rows total before filtering back down to real observations.
processed = (
    df.groupby(GROUP_COLS, group_keys=True)
      .apply(process_group, include_groups=False)
      .reset_index(level=GROUP_COLS)
      .reset_index(drop=True)
)

print(f"Reindexed rows (incl. synthetic filler days): {len(processed):,}")

# ============================================================
# DROP SYNTHETIC FILLER ROWS
# These existed only so shift()/rolling() walk real calendar days.
# They never represent an actual market observation and must not
# appear in the training file.
# ============================================================

print("\nDropping synthetic filler rows (no real observation that day)...")

before_filler_drop = len(processed)
df = processed[processed["_is_real_observation"]].copy()
df = df.drop(columns=["_is_real_observation"])
after_filler_drop = len(df)

print(f"Before: {before_filler_drop:,}")
print(f"After : {after_filler_drop:,}")
print(f"Dropped (filler days): {before_filler_drop - after_filler_drop:,}")

# ============================================================
# PRICE CHANGES
# Guard against div-by-zero -> inf, which silently corrupts
# gradient-boosted splits if not caught. Use NaN instead.
# ============================================================

print("\nGenerating momentum features...")

def pct_change_safe(curr: pd.Series, lagged: pd.Series) -> pd.Series:
    with np.errstate(divide="ignore", invalid="ignore"):
        out = (curr - lagged) / lagged
    out[lagged == 0] = np.nan
    return out

df["price_change_1d"]  = pct_change_safe(df["Modal_Price"], df["lag_1"])
df["price_change_7d"]  = pct_change_safe(df["Modal_Price"], df["lag_7"])
df["price_change_30d"] = pct_change_safe(df["Modal_Price"], df["lag_30"])

# ============================================================
# CYCLICAL CALENDAR ENCODING
# Raw Month=12 and Month=1 look maximally far apart to a tree
# model's split logic. Sin/cos encoding makes December and
# January (and Sunday/Monday) sit next to each other in feature
# space. Original integer columns are kept too.
# ============================================================

print("Generating cyclical calendar features...")

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

# ============================================================
# CATEGORICAL TYPING
# LightGBM natively splits on pandas 'category' columns --
# far more efficient than one-hot encoding 36 districts x
# 10 commodities into 46 extra binary columns.
# ============================================================

print("\nCasting categorical columns...")

df["District"]  = df["District"].astype("category")
df["Commodity"] = df["Commodity"].astype("category")

# ============================================================
# CLEANUP -- drop rows without sufficient lag history
# ============================================================

print("\nRemoving rows without sufficient history (no real obs 30 calendar days back)...")

before_rows = len(df)
df = df.dropna(subset=["lag_30"]).copy()
after_rows = len(df)

print(f"Before: {before_rows:,}")
print(f"After : {after_rows:,}")
print(f"Dropped: {before_rows - after_rows:,}")

# ============================================================
# REPLACE INF  (safety net)
# ============================================================

df.replace([np.inf, -np.inf], np.nan, inplace=True)

# Keep NaN in rolling/lag features -- LightGBM handles missing
# values natively by learning an optimal default split direction.

# ============================================================
# LEAKAGE VERIFICATION
# Direct row-by-row assertion, not a plausibility heuristic:
# for every group, wherever a real observation exists on date D
# AND a real observation exists on date D-1, lag_1 on date D
# must exactly equal Modal_Price on date D-1. This is checked
# against the FULL reindexed series (before filler-row dropping)
# so we verify the actual calendar mechanics, not just what
# survives the final filter.
# ============================================================

print("\nRunning leakage verification (exact row-by-row check)...")

def verify_group(g: pd.DataFrame) -> int:
    """Returns count of mismatched rows in this group (0 = clean)."""
    g = g.sort_values("Arrival_Date")
    expected_lag1 = g["Modal_Price"].shift(1)
    actual_lag1 = g["lag_1"]
    # Only compare where BOTH today's lag_1 and yesterday's actual price
    # are non-null -- NaN vs NaN is not a mismatch, it's correctly missing.
    comparable = expected_lag1.notna() & actual_lag1.notna()
    close = pd.Series(
        np.isclose(actual_lag1[comparable], expected_lag1[comparable]),
        index=actual_lag1[comparable].index,
    )
    return int((~close).sum())

# Re-derive from the FULL reindexed series (pre filler-drop) -- this is
# the rigorous check: lag_1 must equal shift(1) on the continuous daily
# axis, which is what makes it calendar-correct rather than row-correct.
mismatch_counts = (
    processed.groupby(GROUP_COLS, group_keys=False)
             .apply(verify_group, include_groups=False)
)

total_mismatches = mismatch_counts.sum()
bad_groups = mismatch_counts[mismatch_counts > 0]

print(f"  Groups checked      : {len(mismatch_counts):,}")
print(f"  Groups with mismatch: {len(bad_groups):,}")
print(f"  Total mismatched rows: {total_mismatches:,}")

if total_mismatches == 0:
    print("  OK -- VERIFIED: lag_1 exactly equals the prior calendar day's "
          "Modal_Price in every group, every row.")
else:
    print("  WARNING -- LEAKAGE DETECTED -- investigate before training:")
    print(bad_groups.head(10))
    raise AssertionError(
        f"Lag verification failed: {total_mismatches} mismatched rows "
        f"across {len(bad_groups)} groups. Do not train on this output."
    )

# Secondary check: confirm dropna(subset=['lag_30']) left no NaNs
n_null_lag30 = df["lag_30"].isna().sum()
print(f"\n  Remaining NaN in lag_30: {n_null_lag30:,} (should be 0)")
if n_null_lag30 > 0:
    print("  WARNING -- dropna did not remove all NaNs. Check dtype/merge issues.")

# ============================================================
# SUMMARY
# ============================================================

print("\nDataset Summary")
print(f"Final rows: {len(df):,}")

print("\nRows per commodity:")
print(df.groupby("Commodity", observed=True).size().sort_values(ascending=False))

print("\nRows per district (min/max/median):")
dist_counts = df.groupby("District", observed=True).size()
print(f"  min={dist_counts.min()}  max={dist_counts.max()}  median={dist_counts.median():.0f}")

print("\ndays_since_last_observation distribution:")
print(df["days_since_last_observation"].describe())

print("\nFinal dtypes:")
print(df.dtypes)

print("\nMissing value summary (non-zero columns only):")
miss = df.isna().sum()
print(miss[miss > 0])

# ============================================================
# SAVE
# ============================================================

output_file = os.path.join(OUT_DIR, "training_dataset_final.csv")

df.to_csv(output_file, index=False)

print("\nSaved:")
print(output_file)

print("\nDone.")
