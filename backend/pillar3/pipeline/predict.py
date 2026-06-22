"""
predict.py — Backend-facing prediction interface
====================================================
Given (district, commodity), loads the latest engineered feature row
from live_features.csv (produced daily by build_features.py --mode serve)
and the saved per-horizon LightGBM models, returns predictions for horizons
1, 3, 7, 14 days.

Designed to be imported directly by the FastAPI backend:

    from predict import predict

    result = predict("Coimbatore", "Tomato")
    # {"district": "Coimbatore", "commodity": "Tomato",
    #  "as_of": "2026-06-20",
    #  "predictions": {"1d": 1842.3, "3d": 1790.1, "7d": 1755.0, "14d": 1820.4}}

Commodity and district matching is case-insensitive — "tomato", "Tomato",
and "TOMATO" all resolve to the same stored value.

Or run standalone for a quick CLI check:
  python predict.py --district Coimbatore --commodity Tomato
  python predict.py --district coimbatore --commodity tomato   (normalised automatically)
"""
import argparse
import json
import os
import pickle
from pathlib import Path

import pandas as pd

_SCRIPT_DIR    = Path(__file__).parent
_DEFAULT_ROOT  = _SCRIPT_DIR.parent.parent / "pillar3_data"
_DEFAULT_MODELS = _SCRIPT_DIR.parent / "models" / "models_all_horizons"

LIVE_FEATURES_FILE = Path(os.environ.get("PIPELINE_ROOT",
                           str(_DEFAULT_ROOT))) / "live" / "live_features.csv"
MODELS_ROOT = Path(os.environ.get("MODELS_ROOT", str(_DEFAULT_MODELS)))

HORIZONS = [1, 3, 7, 14]


def safe_name(commodity: str) -> str:
    return (
        commodity.lower()
        .replace("(", "").replace(")", "")
        .replace(" ", "_").replace("-", "_").replace("/", "_")
    )


# Alternate spellings used in farmer registration vs AGMARKNET canonical names.
# AGMARKNET consistently uses "Thiru-" while many sources write "Tiru-".
_DISTRICT_ALIASES: dict[str, str] = {
    "tiruvarur":        "Thiruvarur",
    "tirupur":          "Thirupur",
    "tiruchirappalli":  "Thiruchirappalli",
    "tirunelveli":      "Thirunelveli",
    "tiruvannamalai":   "Thiruvannamalai",
    "tirupathur":       "Thirupathur",
    "tiruvallur":       "Thiruvellore",   # also a name change
    "thiruvallur":      "Thiruvellore",
}


def _normalize(df_col: pd.Series, value: str) -> str:
    """Return the stored string that case-insensitively matches `value`.

    Tries exact match first, then the alias map (Tiru- / Thiru- variants),
    then a full case-insensitive scan. Returns `value` unchanged if no match.
    """
    if value in df_col.values:
        return value
    # Alias map for known spelling variants
    canonical = _DISTRICT_ALIASES.get(value.lower())
    if canonical and canonical in df_col.values:
        return canonical
    lower_val = value.lower()
    for stored in df_col.unique():
        if isinstance(stored, str) and stored.lower() == lower_val:
            return stored
    return value


def _load_model(commodity: str, horizon: int):
    cname = safe_name(commodity)
    h_label = f"h{horizon}d"
    model_path = MODELS_ROOT / cname / h_label / f"{cname}_{h_label}_model.pkl"
    params_path = MODELS_ROOT / cname / h_label / f"{cname}_{h_label}_best_params.json"
    if not model_path.exists():
        return None, None
    with open(model_path, "rb") as f:
        model = pickle.load(f)
    with open(params_path) as f:
        params = json.load(f)
    return model, params


def predict(district: str, commodity: str) -> dict:
    if not LIVE_FEATURES_FILE.exists():
        return {
            "district": district, "commodity": commodity,
            "error": (
                f"live_features.csv not found at {LIVE_FEATURES_FILE}. "
                f"Run `build_features.py --mode serve` to seed it."
            ),
        }

    # Always reload fresh — file is updated daily by the pipeline
    df = pd.read_csv(LIVE_FEATURES_FILE, parse_dates=["Arrival_Date"], low_memory=False)

    # Case-insensitive normalisation so callers don't need to match AGMARKNET casing exactly
    norm_district  = _normalize(df["District"],  district)
    norm_commodity = _normalize(df["Commodity"], commodity)

    row = df[(df["District"] == norm_district) & (df["Commodity"] == norm_commodity)]

    if row.empty:
        available = sorted(df["Commodity"].dropna().unique().tolist())
        return {
            "district": district, "commodity": commodity,
            "error": (
                f"No live feature row for district='{norm_district}', "
                f"commodity='{norm_commodity}'. "
                f"Available commodities (first 20): {available[:20]}"
            ),
        }

    row = row.sort_values("Arrival_Date").tail(1)
    as_of = row["Arrival_Date"].iloc[0]

    predictions: dict[str, float | None] = {}
    for h in HORIZONS:
        model, params = _load_model(norm_commodity, h)
        if model is None:
            predictions[f"{h}d"] = None
            continue
        features = params["features_used"]
        missing = [f for f in features if f not in row.columns]
        if missing:
            predictions[f"{h}d"] = None
            continue

        X = row[features].copy()

        # LightGBM stores the training-time Categorical mapping for each
        # categorical feature (CATEGORICAL_FEATURES = ["District"]).
        # At prediction time we must re-apply that exact mapping so the
        # integer codes match what the model saw during training.
        stored_cats = getattr(model, "pandas_categorical", None)
        if stored_cats:
            cat_cols = [f for f in features if f == "District"]
            for i, col in enumerate(cat_cols):
                if i < len(stored_cats) and col in X.columns:
                    X[col] = pd.Categorical(
                        X[col].values,
                        categories=stored_cats[i],  # already a list of category values
                    )

        pred = model.predict(X)[0]
        predictions[f"{h}d"] = round(float(pred), 2)

    return {
        "district": norm_district,
        "commodity": norm_commodity,
        "as_of": str(as_of.date()),
        "predictions": predictions,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--district",  required=True)
    ap.add_argument("--commodity", required=True)
    args = ap.parse_args()
    print(json.dumps(predict(args.district, args.commodity), indent=2))


if __name__ == "__main__":
    main()
