"""
Tamil Nadu Agricultural Market Intelligence — Data Cleaning Pipeline
=====================================================================
Outputs:
  cleaned_tamil_nadu_agri_data.csv      ← primary dataset for forecasting
  potential_key_duplicates.csv          ← multi-lot/grade rows for review
  suspicious_outliers.csv              ← IQR outliers for manual review
  district_summary.csv                 ← coverage metadata per district
  commodity_outlier_stats.csv          ← per-commodity IQR statistics
  data_quality_report.txt              ← full audit trail
Changes vs v1:
  - Key duplicates are NO LONGER removed; exported for review instead
  - Outlier flagging uses row_id (not DataFrame index) — no silent mismatch
  - Text standardisation uses smart_title() that preserves variety codes
    (ADT 37, RCH-2, MCU-7, HMT, LRA, Grade-II, etc.)
"""
import pandas as pd
import numpy as np
import re
import os
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_ROOT = os.path.join(_SCRIPT_DIR, "..", "..", "pillar3_data")

INPUT_FILE = os.environ.get("INPUT_FILE",
    os.path.join(_DEFAULT_ROOT, "combined_all_tamil_nadu.csv"))
OUT_DIR = os.environ.get("OUT_DIR",
    os.path.join(_DEFAULT_ROOT, "tn_agri_outputs"))
os.makedirs(OUT_DIR, exist_ok=True)

OUT_CLEANED   = os.path.join(OUT_DIR, "cleaned_tamil_nadu_agri_data.csv")
OUT_KEY_DUPES = os.path.join(OUT_DIR, "potential_key_duplicates.csv")
OUT_OUTLIERS  = os.path.join(OUT_DIR, "suspicious_outliers.csv")
OUT_DISTRICT  = os.path.join(OUT_DIR, "district_summary.csv")
OUT_REPORT    = os.path.join(OUT_DIR, "data_quality_report.txt")
OUT_OL_STATS  = os.path.join(OUT_DIR, "commodity_outlier_stats.csv")

# IQR multiplier — 3.0 is conservative (flags only extreme values)
IQR_MULTIPLIER = 3.0

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
log_lines = []

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    log_lines.append(msg)


def mem_mb(df: pd.DataFrame) -> str:
    return f"{df.memory_usage(deep=True).sum() / 1e6:.1f} MB"


def smart_title(s: str) -> str:
    """
    Safe capitalisation for AGMARKNET agricultural text.

    Rules applied per whitespace-separated token:
      - Contains any digit   → preserve exactly  (ADT 37, MTU-1010, 1st Sort, NO 1)
      - All alpha AND all-caps → preserve exactly  (LRA, HMT, ADT, RCH, NO)
      - All alpha AND all-lower → capitalise first alpha char  (green→Green, (whole)→(Whole))
      - Mixed-case (already has ≥1 upper) → leave alone  (Chilli, Banana, Moath)

    This correctly handles:
      CO-4, PKM-1, RCH-2, ADT 37, MDU 5, KKM 1, CO(H) 4, TMV 2,
      NLM-1, TMV(U) 2, MS(SH)1, Grade-II, 170-CO2, NO 1, NO 2,
      LRA, MCU 5, MCU-7, HMT, MTU-1010, DMV-7, ADT-36, TKM 9
    """
    if not isinstance(s, str):
        return s
    words = s.split()
    result = []
    for w in words:
        alpha_only = re.sub(r'[^A-Za-z]', '', w)
        has_digit  = bool(re.search(r'\d', w))

        if has_digit:
            # Codes with digits: preserve verbatim
            result.append(w)
        elif alpha_only.isupper():
            # All-caps codes: preserve verbatim
            result.append(w)
        elif alpha_only.islower():
            # All-lowercase: capitalise first alphabetic character
            result.append(re.sub(r'[a-z]', lambda m: m.group().upper(), w, count=1))
        else:
            # Mixed-case (already has uppercase): leave alone
            result.append(w)
    return ' '.join(result)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — LOAD
# ─────────────────────────────────────────────────────────────────────────────
log("=" * 65)
log("STEP 1 — Loading dataset")
log("=" * 65)

dtype_map = {
    "Commodity_Code": "Int32",
    "Max_Price":      "float32",
    "Min_Price":      "float32",
    "Modal_Price":    "float32",
}

df = pd.read_csv(INPUT_FILE, dtype=dtype_map, low_memory=False)

original_rows = len(df)
log(f"  Loaded  : {original_rows:,} rows × {df.shape[1]} columns")
log(f"  Memory  : {mem_mb(df)}")

# ── Assign row_id immediately after load ─────────────────────────────────────
# This is the stable identity key used throughout the pipeline.
# It never changes: filtering, sorting, and concat operations all preserve it.
df["row_id"] = np.arange(len(df), dtype="int32")
log(f"  Assigned row_id 0 … {len(df)-1:,}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — MISSING VALUE ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 2 — Missing value analysis")

mv_report = []
for col in df.columns:
    missing = df[col].isna().sum()
    pct     = missing / len(df) * 100
    mv_report.append({"Column": col, "Missing_Count": missing, "Missing_Pct": round(pct, 4)})
    log(f"  {col:<22}: {missing:>8,}  ({pct:.4f}%)")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — DROP UNUSABLE RECORDS
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 3 — Remove rows missing key identifiers")

critical_cols = ["Arrival_Date", "District", "Market", "Commodity"]
before = len(df)
df.dropna(subset=critical_cols, inplace=True)
rows_dropped_missing = before - len(df)
log(f"  Dropped (missing identifiers): {rows_dropped_missing:,} rows")
log(f"  Remaining: {len(df):,} rows")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — DATA TYPE CONVERSION
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 4 — Data type conversion")

df["Arrival_Date"] = pd.to_datetime(df["Arrival_Date"], dayfirst=True, errors="coerce")
bad_dates = df["Arrival_Date"].isna().sum()
log(f"  Invalid dates coerced to NaT: {bad_dates:,}")
if bad_dates > 0:
    df.dropna(subset=["Arrival_Date"], inplace=True)
    log(f"  Dropped rows with unparseable dates: {bad_dates:,}")

for col in ["Min_Price", "Modal_Price", "Max_Price"]:
    df[col] = pd.to_numeric(df[col], errors="coerce").astype("float32")

log(f"  Arrival_Date  → datetime64")
log(f"  Price columns → float32")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — PRICE CLEANING
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 5 — Price cleaning")

before = len(df)

# 5a — Drop rows where ALL three prices are NaN
all_nan_mask = df[["Min_Price", "Modal_Price", "Max_Price"]].isna().all(axis=1)
df = df[~all_nan_mask]
log(f"  Dropped (all prices NaN)       : {all_nan_mask.sum():,}")

# 5b — Drop rows with ANY negative price
neg_mask = (df[["Min_Price", "Modal_Price", "Max_Price"]] < 0).any(axis=1)
df = df[~neg_mask]
log(f"  Dropped (any negative price)   : {neg_mask.sum():,}")

# 5c — Flag but KEEP rows where Min_Price == 0 and Modal/Max are valid
#      (AGMARKNET sometimes omits Min when only one lot traded)
zero_min_mask = (df["Min_Price"] == 0) & (df["Modal_Price"] > 0)
df["min_price_zero_flag"] = zero_min_mask.astype("bool")
log(f"  Flagged (Min_Price=0, Modal>0) : {zero_min_mask.sum():,}  → kept, flagged")

# 5d — Drop rows where Modal_Price == 0  (forecasting target cannot be zero)
modal_zero = df["Modal_Price"] == 0
df = df[~modal_zero]
log(f"  Dropped (Modal_Price = 0)      : {modal_zero.sum():,}")

# 5e — Drop rows with invalid price ordering
inv_min_modal = df["Min_Price"] > df["Modal_Price"]
inv_modal_max = df["Modal_Price"] > df["Max_Price"]
inv_min_max   = df["Min_Price"]  > df["Max_Price"]
invalid_price_mask = inv_min_modal | inv_modal_max | inv_min_max
df = df[~invalid_price_mask]
log(f"  Dropped (invalid price order)  : {invalid_price_mask.sum():,}")
log(f"    Min>Modal : {inv_min_modal.sum():,}")
log(f"    Modal>Max : {inv_modal_max.sum():,}")
log(f"    Min>Max   : {inv_min_max.sum():,}")

rows_dropped_price = before - len(df)
log(f"  Total dropped in price cleaning: {rows_dropped_price:,}")
log(f"  Remaining: {len(df):,} rows")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — TEXT STANDARDISATION  (smart_title — preserves variety codes)
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 6 — Text standardisation (code-safe smart_title)")

# District and State: purely natural-language names → standard title() is safe
for col in ["District", "State"]:
    df[col] = (
        df[col].astype(str)
               .str.strip()
               .str.replace(r"\s+", " ", regex=True)
               .str.title()
               .replace("", np.nan)
               .replace("Nan", np.nan)
    )

# Commodity, Variety, Grade, Market: may contain codes → use smart_title
for col in ["Commodity", "Variety", "Grade", "Market"]:
    df[col] = (
        df[col].astype(str)
               .str.strip()
               .str.replace(r"\s+", " ", regex=True)
               .apply(smart_title)
               .replace("", np.nan)
               .replace("Nan", np.nan)
    )

log(f"  District, State     → str.title()")
log(f"  Commodity, Variety, Grade, Market → smart_title()")

# Known district name corrections
district_fix = {
    "Nagercoil (Kannyiakumari)": "Kanyakumari",
    "Nagercoil (Kanyiakumari)":  "Kanyakumari",
    "The Nilgiris":              "Nilgiris",
}
df["District"] = df["District"].replace(district_fix)
log(f"  District corrections applied  : {district_fix}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — DUPLICATE HANDLING
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 7 — Duplicate detection")

# 7a — Exact duplicates: safe to remove (identical on every column including prices)
before = len(df)
exact_dupes = df.duplicated(subset=df.columns.drop("row_id")).sum()
df.drop_duplicates(subset=df.columns.drop("row_id"), keep="first", inplace=True)
log(f"  Exact duplicates removed : {exact_dupes:,}")

# 7b — Key duplicates: identify, report, export — DO NOT remove
#      These can be legitimate multi-grade, multi-lot, or multi-auction records
key_cols = ["Arrival_Date", "District", "Market", "Commodity", "Variety"]
key_dup_mask = df.duplicated(subset=key_cols, keep=False)
key_dup_df   = df[key_dup_mask].copy()

n_key_dup_rows   = len(key_dup_df)
n_key_dup_groups = df[key_dup_mask].groupby(key_cols).ngroups

log(f"  Key duplicate rows (kept)   : {n_key_dup_rows:,}")
log(f"  Key duplicate groups        : {n_key_dup_groups:,}")

# Top districts and commodities with most key duplicates
kd_by_district   = key_dup_df.groupby("District").size().sort_values(ascending=False).head(10)
kd_by_commodity  = key_dup_df.groupby("Commodity").size().sort_values(ascending=False).head(10)

log(f"  Top 5 districts by key dupe rows:")
for dist, cnt in kd_by_district.head(5).items():
    log(f"    {dist:<28}: {cnt:>6,}")
log(f"  Top 5 commodities by key dupe rows:")
for comm, cnt in kd_by_commodity.head(5).items():
    log(f"    {comm:<28}: {cnt:>6,}")

# Add group label for analyst convenience
if n_key_dup_rows > 0:
    key_dup_df["key_dup_group_size"] = (
        key_dup_df.groupby(key_cols)["row_id"].transform("count")
    )
    # Do prices differ within the group? (distinguishes multi-lot from true dupe)
    key_dup_df["prices_differ_in_group"] = (
        key_dup_df.groupby(key_cols)["Modal_Price"].transform("nunique") > 1
    )

log(f"  Remaining after step 7: {len(df):,} rows")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8 — DISTRICT CONSISTENCY SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 8 — District consistency summary")

district_summary = (
    df.groupby("District")
    .agg(
        Record_Count       = ("Arrival_Date", "count"),
        Earliest_Date      = ("Arrival_Date", "min"),
        Latest_Date        = ("Arrival_Date", "max"),
        Unique_Commodities = ("Commodity",    "nunique"),
        Unique_Markets     = ("Market",       "nunique"),
        Unique_Varieties   = ("Variety",      "nunique"),
        Median_Modal_Price = ("Modal_Price",  "median"),
    )
    .reset_index()
    .sort_values("Record_Count", ascending=False)
)
district_summary["Coverage_Days"] = (
    district_summary["Latest_Date"] - district_summary["Earliest_Date"]
).dt.days

log(f"  Districts covered: {len(district_summary)}")
for _, row in district_summary.head(5).iterrows():
    log(f"    {row['District']:<25}: {row['Record_Count']:>8,} records  "
        f"({row['Earliest_Date'].date()} → {row['Latest_Date'].date()})")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 9 — OUTLIER DETECTION  (row_id–based, never drops rows)
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 9 — Outlier detection (IQR per commodity, row_id based)")

outlier_row_ids = []   # collect row_id values of all flagged rows
outlier_records = []   # collect full rows for the export file
outlier_stats   = []

for commodity, grp in df.groupby("Commodity"):
    prices = grp["Modal_Price"].dropna()
    if len(prices) < 10:
        continue

    q1, q3 = prices.quantile(0.25), prices.quantile(0.75)
    iqr     = q3 - q1
    lower   = q1 - IQR_MULTIPLIER * iqr
    upper   = q3 + IQR_MULTIPLIER * iqr

    outlier_mask = (grp["Modal_Price"] < lower) | (grp["Modal_Price"] > upper)
    n_outliers   = outlier_mask.sum()

    outlier_stats.append({
        "Commodity":     commodity,
        "Record_Count":  len(grp),
        "Q1":            round(q1, 2),
        "Q3":            round(q3, 2),
        "IQR":           round(iqr, 2),
        "Lower_Fence":   round(lower, 2),
        "Upper_Fence":   round(upper, 2),
        "Outlier_Count": n_outliers,
        "Outlier_Pct":   round(n_outliers / len(grp) * 100, 2),
    })

    if n_outliers > 0:
        flagged = grp[outlier_mask].copy()
        flagged["Outlier_Reason"]    = np.where(
            flagged["Modal_Price"] > upper, "HIGH", "LOW"
        )
        flagged["IQR_Lower_Fence"]   = round(lower, 2)
        flagged["IQR_Upper_Fence"]   = round(upper, 2)

        # Store the row_ids — this is the ground truth for flagging
        outlier_row_ids.extend(flagged["row_id"].tolist())
        outlier_records.append(flagged)

outlier_stats_df    = pd.DataFrame(outlier_stats).sort_values("Outlier_Count", ascending=False)
suspicious_outliers = pd.concat(outlier_records, ignore_index=True) if outlier_records else pd.DataFrame()

# ── Flag rows in the main dataset using row_id membership ────────────────────
# row_id is the stable identifier assigned in Step 1 and never reset.
# This avoids the index-mismatch bug that occurs when pd.concat(ignore_index=True)
# resets indices, causing df.index.isin(suspicious.index) to produce wrong results.
outlier_id_set       = set(outlier_row_ids)
df["is_outlier_iqr"] = df["row_id"].isin(outlier_id_set)

# ── Integrity verification ────────────────────────────────────────────────────
n_flagged_in_df    = df["is_outlier_iqr"].sum()
n_flagged_in_file  = len(suspicious_outliers)
match_ok           = n_flagged_in_df == n_flagged_in_file

log(f"  IQR multiplier          : {IQR_MULTIPLIER}×")
log(f"  Rows in suspicious file : {n_flagged_in_file:,}")
log(f"  is_outlier_iqr == True  : {n_flagged_in_df:,}")
log(f"  Counts match            : {'✓ YES' if match_ok else '✗ MISMATCH — investigate'}")

if not match_ok:
    log("  WARNING: outlier count mismatch — check commodity grouping logic")

log(f"  Top 8 commodities by outlier count:")
for _, row in outlier_stats_df.head(8).iterrows():
    log(f"    {row['Commodity'][:35]:<35}: {row['Outlier_Count']:>5} "
        f"({row['Outlier_Pct']:.1f}%)  fence=[{row['Lower_Fence']:.0f}, {row['Upper_Fence']:.0f}]")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 10 — FORECASTING-READY FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 10 — Adding forecasting-ready features")

df.sort_values(["District", "Commodity", "Variety", "Market", "Arrival_Date"], inplace=True)
df.reset_index(drop=True, inplace=True)

# Calendar features
df["Year"]       = df["Arrival_Date"].dt.year.astype("Int16")
df["Month"]      = df["Arrival_Date"].dt.month.astype("Int8")
df["DayOfWeek"]  = df["Arrival_Date"].dt.dayofweek.astype("Int8")   # Mon=0
df["WeekOfYear"] = df["Arrival_Date"].dt.isocalendar().week.astype("Int8")
df["Quarter"]    = df["Arrival_Date"].dt.quarter.astype("Int8")

# Price spread (volatility proxy)
df["Price_Spread"]     = (df["Max_Price"] - df["Min_Price"]).astype("float32")
df["Price_Spread_Pct"] = (
    df["Price_Spread"] / df["Modal_Price"].replace(0, np.nan) * 100
).round(2).astype("float32")

log(f"  Calendar: Year, Month, DayOfWeek, WeekOfYear, Quarter")
log(f"  Volatility: Price_Spread, Price_Spread_Pct")
log(f"  Quality flags: min_price_zero_flag, is_outlier_iqr, row_id")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 11 — DATA QUALITY REPORT
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 11 — Generating data quality report")

final_rows = len(df)

report_lines = [
    "=" * 65,
    "TAMIL NADU AGRICULTURAL MARKET DATA — QUALITY REPORT",
    f"Generated : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    "=" * 65,
    "",
    "─── ROW COUNTS ───",
    f"  Original rows              : {original_rows:>10,}",
    f"  Dropped (missing keys)     : {rows_dropped_missing:>10,}",
    f"  Dropped (price issues)     : {rows_dropped_price:>10,}",
    f"  Dropped (exact duplicates) : {exact_dupes:>10,}",
    f"  Key duplicates (KEPT)      : {n_key_dup_rows:>10,}  ← see potential_key_duplicates.csv",
    f"  FINAL cleaned rows         : {final_rows:>10,}",
    f"  Retention rate             : {final_rows/original_rows*100:.2f}%",
    "",
    "─── COVERAGE ───",
    f"  Districts                  : {df['District'].nunique()}",
    f"  Markets                    : {df['Market'].nunique()}",
    f"  Commodities                : {df['Commodity'].nunique()}",
    f"  Varieties                  : {df['Variety'].nunique()}",
    f"  Date range                 : {df['Arrival_Date'].min().date()} → {df['Arrival_Date'].max().date()}",
    "",
    "─── KEY DUPLICATE ANALYSIS ───",
    f"  Key duplicate groups       : {n_key_dup_groups:,}",
    f"  Key duplicate rows         : {n_key_dup_rows:,}",
    f"  (Key = Arrival_Date + District + Market + Commodity + Variety)",
    f"  These are KEPT — may be multi-grade, multi-lot, or multi-auction.",
    f"  Review potential_key_duplicates.csv to decide per-group.",
    "",
    "  Top 10 districts with most key duplicates:",
]
for dist, cnt in kd_by_district.items():
    report_lines.append(f"    {dist:<28}: {cnt:>6,} rows")

report_lines += [
    "",
    "  Top 10 commodities with most key duplicates:",
]
for comm, cnt in kd_by_commodity.items():
    report_lines.append(f"    {comm:<28}: {cnt:>6,} rows")

report_lines += [
    "",
    "─── PRICE FLAGS ───",
    f"  Rows with Min_Price = 0    : {df['min_price_zero_flag'].sum():>10,}  (kept, flagged)",
    f"  IQR outliers in export     : {n_flagged_in_file:>10,}",
    f"  is_outlier_iqr == True     : {n_flagged_in_df:>10,}",
    f"  Counts match               : {'YES ✓' if match_ok else 'MISMATCH ✗ — investigate'}",
    "",
    "─── MISSING VALUES IN CLEANED DATA ───",
]
any_missing = False
for col in df.columns:
    m = df[col].isna().sum()
    if m > 0:
        any_missing = True
        report_lines.append(f"  {col:<28}: {m:,} ({m/final_rows*100:.3f}%)")
if not any_missing:
    report_lines.append("  All columns: 0 missing")

report_lines += [
    "",
    "─── DISTRICT COVERAGE (by record count) ───",
]
for _, row in district_summary.iterrows():
    report_lines.append(
        f"  {row['District']:<28}: {row['Record_Count']:>8,} rows  "
        f"{str(row['Earliest_Date'].date())} → {str(row['Latest_Date'].date())}  "
        f"({row['Unique_Commodities']} commodities)"
    )

report_lines += [
    "",
    "─── TEXT STANDARDISATION NOTES ───",
    "  District, State     : str.title() — purely natural-language names",
    "  Commodity, Variety,",
    "  Grade, Market       : smart_title() — preserves all-caps codes",
    "    Preserved: ADT 37, RCH-2, MCU-7, HMT, LRA, TKM 9, NO 1, ...",
    "    Capitalised: green chilli→Green Chilli, api→Api, other→Other",
    "    Left alone: Green Chilli, Banana - Green (already correct)",
    "",
    "─── NOTES FOR FORECASTING ───",
    "  1. Data is NOT continuous — expect gaps per district/commodity.",
    "  2. 15 districts only have data from mid-2024 onwards.",
    "     Models on those districts need shorter lookback windows.",
    "  3. Flowers (Jasmine, Kakada, Tube Flower): legitimately ₹1L–₹8L/qtl.",
    "     Do NOT treat as errors. IQR is computed per-commodity.",
    "  4. is_outlier_iqr=True rows are KEPT in main dataset.",
    "     Review suspicious_outliers.csv before model training.",
    "  5. min_price_zero_flag=True: use Modal_Price only for those rows.",
    "  6. Price_Spread/_Pct are volatility proxies for model features.",
    "  7. Calendar columns encode Tamil Nadu's Kharif (Jun–Nov) and",
    "     Rabi (Dec–Mar) harvest seasonality.",
    "",
    "─── RECOMMENDED FORECASTING APPROACH ───",
    "  Query interface: (district, commodity, date_range)",
    "  Group by       : District + Commodity + Variety",
    "  Target variable: Modal_Price",
    "  Minimum rows   : ~30 per group before fitting any model",
    "  Suggested models:",
    "    • Prophet    — handles gaps + multi-seasonality natively",
    "    • LightGBM   — lag features, fast, handles tabular patterns",
    "    • SARIMA     — for commodities with clear seasonal cycles",
    "  For districts with <2 years data: prefer LightGBM over SARIMA.",
    "=" * 65,
]

report_text = "\n".join(report_lines)
print("\n" + report_text)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 12 — SAVE OUTPUTS
# ─────────────────────────────────────────────────────────────────────────────
log("\nSTEP 12 — Saving outputs")

log(f"  Writing cleaned dataset …")
df.to_csv(OUT_CLEANED, index=False)
log(f"  Saved: {OUT_CLEANED}  ({final_rows:,} rows)")

log(f"  Writing key duplicates …")
if n_key_dup_rows > 0:
    key_dup_df.to_csv(OUT_KEY_DUPES, index=False)
    log(f"  Saved: {OUT_KEY_DUPES}  ({n_key_dup_rows:,} rows, {n_key_dup_groups:,} groups)")
else:
    log("  No key duplicates found — file skipped")

log(f"  Writing suspicious outliers …")
if not suspicious_outliers.empty:
    suspicious_outliers.to_csv(OUT_OUTLIERS, index=False)
    log(f"  Saved: {OUT_OUTLIERS}  ({n_flagged_in_file:,} rows)")
else:
    log("  No outliers flagged — file skipped")

log(f"  Writing district summary …")
district_summary.to_csv(OUT_DISTRICT, index=False)
log(f"  Saved: {OUT_DISTRICT}  ({len(district_summary)} districts)")

log(f"  Writing commodity outlier stats …")
outlier_stats_df.to_csv(OUT_OL_STATS, index=False)
log(f"  Saved: {OUT_OL_STATS}")

log(f"  Writing quality report …")
with open(OUT_REPORT, "w", encoding="utf-8-sig") as f:
    f.write(report_text)
log(f"  Saved: {OUT_REPORT}")

log("\n" + "=" * 65)
log("PIPELINE COMPLETE")
log(f"  cleaned_tamil_nadu_agri_data.csv    : {final_rows:,} rows")
log(f"  potential_key_duplicates.csv        : {n_key_dup_rows:,} rows  ({n_key_dup_groups:,} groups)")
log(f"  suspicious_outliers.csv             : {n_flagged_in_file:,} rows")
log(f"  district_summary.csv                : {len(district_summary)} districts")
log(f"  commodity_outlier_stats.csv         : {len(outlier_stats_df)} commodities")
log(f"  data_quality_report.txt             : written")
log("=" * 65)
