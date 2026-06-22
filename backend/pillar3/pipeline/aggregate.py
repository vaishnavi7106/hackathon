import os
import pandas as pd

# ============================================================
# CONFIG
# ============================================================

_SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_ROOT = os.path.join(_SCRIPT_DIR, "..", "..", "pillar3_data")

INPUT_FILE = os.environ.get("INPUT_FILE",
    os.path.join(_DEFAULT_ROOT, "tn_agri_outputs", "cleaned_tamil_nadu_agri_data.csv"))
OUT_DIR = os.environ.get("OUT_DIR",
    os.path.join(_DEFAULT_ROOT, "filtered_data"))

os.makedirs(OUT_DIR, exist_ok=True)

# Final selected commodities
TARGET_COMMODITIES = [
    "Bhindi(Ladies Finger)",
    "Green Chilli",
    "Tomato",
    "Onion",
    "Banana - Green",
    "Mint(Pudina)",
    "Coconut",
    "Bitter Gourd",
    "Cabbage",
    "Pumpkin"
]

# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("Loading dataset...")
print("=" * 70)

df = pd.read_csv(
    INPUT_FILE,
    low_memory=False,
    parse_dates=["Arrival_Date"]
)

print(f"Rows loaded: {len(df):,}")

# ============================================================
# FILTER TO TOP 10 CROPS
# ============================================================

df = df[df["Commodity"].isin(TARGET_COMMODITIES)].copy()

print(f"\nRows after crop filtering: {len(df):,}")

# ============================================================
# IDENTIFY DOMINANT VARIETY FOR EACH CROP
# ============================================================

print("\nFinding dominant varieties...")

variety_counts = (
    df.groupby(["Commodity", "Variety"])
      .size()
      .reset_index(name="Records")
)

dominant_varieties = (
    variety_counts
    .sort_values(
        ["Commodity", "Records"],
        ascending=[True, False]
    )
    .groupby("Commodity")
    .first()
    .reset_index()
)

dominant_varieties = dominant_varieties.rename(
    columns={"Variety": "Dominant_Variety"}
)

print("\nDominant Varieties:")
print(
    dominant_varieties[
        ["Commodity", "Dominant_Variety", "Records"]
    ]
)

# Save audit file
dominant_varieties.to_csv(
    os.path.join(
        OUT_DIR,
        "dominant_varieties.csv"
    ),
    index=False
)

# ============================================================
# KEEP ONLY DOMINANT VARIETY
# ============================================================

df = df.merge(
    dominant_varieties[
        ["Commodity", "Dominant_Variety"]
    ],
    on="Commodity",
    how="left"
)

before_rows = len(df)

df = df[
    df["Variety"] == df["Dominant_Variety"]
].copy()

after_rows = len(df)

print("\nDominant variety filtering:")
print(f"Before : {before_rows:,}")
print(f"After  : {after_rows:,}")
print(
    f"Removed: {before_rows - after_rows:,}"
)

# ============================================================
# AGGREGATE DUPLICATES
# ============================================================

print("\nAggregating...")

group_cols = [
    "Arrival_Date",
    "District",
    "Commodity"
]

forecast_df = (
    df.groupby(group_cols)
      .agg(
          Modal_Price=("Modal_Price", "median"),
          Min_Price=("Min_Price", "median"),
          Max_Price=("Max_Price", "median"),
          Price_Spread=("Price_Spread", "median"),
          Price_Spread_Pct=("Price_Spread_Pct", "median"),

          min_price_zero_flag=(
              "min_price_zero_flag",
              "max"
          ),

          is_outlier_iqr=(
              "is_outlier_iqr",
              "max"
          ),

          records_aggregated=(
              "row_id",
              "count"
          )
      )
      .reset_index()
)

# ============================================================
# REBUILD CALENDAR FEATURES
# ============================================================

forecast_df["Year"] = (
    forecast_df["Arrival_Date"].dt.year
)

forecast_df["Month"] = (
    forecast_df["Arrival_Date"].dt.month
)

forecast_df["DayOfWeek"] = (
    forecast_df["Arrival_Date"].dt.dayofweek
)

forecast_df["WeekOfYear"] = (
    forecast_df["Arrival_Date"]
    .dt.isocalendar()
    .week
    .astype(int)
)

forecast_df["Quarter"] = (
    forecast_df["Arrival_Date"].dt.quarter
)

# ============================================================
# SORT
# ============================================================

forecast_df = forecast_df.sort_values(
    [
        "Commodity",
        "District",
        "Arrival_Date"
    ]
)

# ============================================================
# SAVE OUTPUT
# ============================================================

output_file = os.path.join(
    OUT_DIR,
    "top10_forecasting_crops.csv"
)

forecast_df.to_csv(
    output_file,
    index=False
)

# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

print(f"Final rows: {len(forecast_df):,}")

print("\nRecords per commodity:")

summary = (
    forecast_df.groupby("Commodity")
               .size()
               .sort_values(
                   ascending=False
               )
)

print(summary)

print(
    f"\nSaved:\n{output_file}"
)

print("\nDone.")