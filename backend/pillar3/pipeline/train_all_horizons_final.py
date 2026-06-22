"""
Tamil Nadu Crop Price Forecasting
Per-Commodity LightGBM — All Horizons Pipeline
================================================
Trains 10 commodities × 5 horizons = 50 models.
(7-day models already trained separately; this covers 1d/3d/14d/21d/30d.
 You can include 7d here too by adding it to HORIZONS — it will just retrain.)

Key design vs the 7d-only script
---------------------------------
  - Feature selection runs ONCE per commodity (on target_7d as the reference
    target for the probe model).  The retained feature set is then REUSED for
    all horizons of that commodity.  Rationale: the same price-history signals
    that predict 7-day-ahead prices are the relevant ones for other horizons;
    running 5 separate probe models would be slower and produce inconsistent
    feature sets for the same crop.

  - Horizon-aware feature masking: for horizon N, any lag feature whose lag
    index is LESS than N is DROPPED before training (it would be unavailable
    at real inference time — you can't know lag_1 when forecasting 14 days ahead
    without also knowing the intervening prices).
    Example: for target_14d, lag_1, lag_3, lag_7 are dropped; lag_14/21/30 kept.

  - Output folder structure:
      outputs_all_horizons/
        tomato/
          h1d/
            tomato_h1d_model.pkl
            tomato_h1d_feature_importance.csv
            tomato_h1d_metrics.csv
            tomato_h1d_best_params.json
          h3d/
            ...
          h14d/
          h21d/
          h30d/
        onion/
          ...
        overall_summary.csv     ← all commodities × horizons in one table

Usage
-----
  python train_all_horizons.py
  python train_all_horizons.py --train train.csv --val val.csv --test test.csv
  python train_all_horizons.py --commodity Tomato --trials 30
  python train_all_horizons.py --horizons 14 21 30   (run specific horizons only)
"""

# ── stdlib ────────────────────────────────────────────────────────────────────
import argparse
import json
import os
import pickle
import warnings
from pathlib import Path

# ── third-party ───────────────────────────────────────────────────────────────
import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG  — edit paths to match your machine
# ══════════════════════════════════════════════════════════════════════════════

TRAIN_FILE_DEFAULT = r"C:\Users\amizh\Downloads\pillar3\latest\train.csv"
VAL_FILE_DEFAULT   = r"C:\Users\amizh\Downloads\pillar3\latest\val.csv"
TEST_FILE_DEFAULT  = r"C:\Users\amizh\Downloads\pillar3\latest\test.csv"
OUTPUT_ROOT        = Path(r"C:\Users\amizh\Downloads\pillar3\models_final\models_all_horizons")

COMMODITIES = [
    "Bhindi(Ladies Finger)",
    "Green Chilli",
    "Tomato",
    "Onion",
    "Banana - Green",
    "Mint(Pudina)",
    "Coconut",
    "Bitter Gourd",
    "Cabbage",
    "Pumpkin",
]

# Horizons to train (add or remove as needed; 7 is included so you can retrain
# everything in one shot, or remove it if you want to skip the already-done run)
ALL_HORIZONS = [1, 3, 7, 14]   # exclude 7 since already trained

# Lag features in the dataset and the minimum horizon they are valid for
# lag_N is only available at inference time when forecasting >= N days ahead
LAG_FEATURES = {
    "lag_1":  1,
    "lag_3":  3,
    "lag_7":  7,
    "lag_14": 14,
    "lag_21": 21,
    "lag_30": 30,
}

# Non-lag candidate features (always valid regardless of horizon)
BASE_FEATURES = [
    "District",
    "Year", "Month", "DayOfWeek", "WeekOfYear", "Quarter",
    "rolling_mean_7", "rolling_mean_30",
    "rolling_std_7",  "rolling_std_30",
    "days_since_last_observation",
    "price_change_1d", "price_change_7d", "price_change_30d",
    "month_sin", "month_cos",
    "dow_sin",   "dow_cos",
    "min_price_zero_flag", "is_outlier_iqr", "records_aggregated",
]

# price_change_Nd features are also horizon-constrained
# (price_change_1d = (price_today - lag_1) / lag_1, so unavailable when horizon < 1)
PRICE_CHANGE_MIN_HORIZON = {
    "price_change_1d":  1,
    "price_change_7d":  7,
    "price_change_30d": 30,
}

CATEGORICAL_FEATURES      = ["District"]
CUMULATIVE_GAIN_THRESHOLD = 0.995   # keep features covering 99.5% of cumulative gain
PROBE_TARGET              = "target_7d"   # reference target for feature selection probe

N_TRIALS          = 50
OPTUNA_METRIC     = "rmse"
EARLY_STOP_ROUNDS = 50
MAX_BOOST_ROUNDS  = 2000
FINAL_ROUND_SCALE = 1.1
SEED              = 42

# Split boundaries — used to gap-buffer rows whose target window crosses
# from one split into the next (prevents train/val and val/test leakage).
VAL_START_DATE  = pd.Timestamp("2026-01-01")
TEST_START_DATE = pd.Timestamp("2026-04-01")

# ══════════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ══════════════════════════════════════════════════════════════════════════════

def parse_args():
    p = argparse.ArgumentParser(
        description="Per-commodity LightGBM trainer — all horizons"
    )
    p.add_argument("--train",    default=TRAIN_FILE_DEFAULT)
    p.add_argument("--val",      default=VAL_FILE_DEFAULT)
    p.add_argument("--test",     default=TEST_FILE_DEFAULT)
    p.add_argument("--trials",   type=int, default=N_TRIALS,
                   help=f"Optuna trials per commodity×horizon (default {N_TRIALS})")
    p.add_argument("--commodity", default=None,
                   help="Single commodity name (default: all)")
    p.add_argument("--horizons", type=int, nargs="+", default=ALL_HORIZONS,
                   help="Horizons to train e.g. --horizons 14 21 30")
    return p.parse_args()

# ══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

def safe_name(commodity: str) -> str:
    return (
        commodity.lower()
        .replace("(", "").replace(")", "")
        .replace(" ", "_").replace("-", "_").replace("/", "_")
    )


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae  = float(mean_absolute_error(y_true, y_pred))
    r2   = float(r2_score(y_true, y_pred))
    mask = y_true != 0
    mape = (
        float(np.mean(np.abs(y_pred[mask] - y_true[mask]) / y_true[mask]) * 100)
        if mask.any() else float("nan")
    )
    return {
        "RMSE":   round(rmse, 4),
        "MAE":    round(mae,  4),
        "MAPE_%": round(mape, 4),
        "R2":     round(r2,   6),
    }


def valid_features_for_horizon(retained: list, horizon: int) -> list:
    """
    From the retained feature set, drop lag_N where N < horizon
    and price_change_Nd where the implied lag < horizon.
    These features require knowing prices fewer than `horizon` days ago,
    which we won't have at real inference time.
    """
    out = []
    for f in retained:
        if f in LAG_FEATURES and LAG_FEATURES[f] < horizon:
            continue
        if f in PRICE_CHANGE_MIN_HORIZON and PRICE_CHANGE_MIN_HORIZON[f] < horizon:
            continue
        out.append(f)
    return out


def make_lgb_datasets(tr, vl, features, target):
    cats = [f for f in CATEGORICAL_FEATURES if f in features]
    dtrain = lgb.Dataset(
        tr[features], label=tr[target],
        categorical_feature=cats, free_raw_data=False,
    )
    dval = lgb.Dataset(
        vl[features], label=vl[target],
        reference=dtrain,
    )
    return dtrain, dval, cats

# ══════════════════════════════════════════════════════════════════════════════
# FEATURE SELECTION  (runs once per commodity on probe target)
# ══════════════════════════════════════════════════════════════════════════════

def select_features(tr, vl, all_features, commodity):
    """
    Two-stage probe on PROBE_TARGET (target_7d).
    Returns (retained_features_list, full_importance_df).
    """
    probe_target = PROBE_TARGET
    if probe_target not in tr.columns:
        # fallback: use first available target
        probe_target = next(c for c in tr.columns if c.startswith("target_"))

    tr_p = tr.dropna(subset=[probe_target])
    vl_p = vl.dropna(subset=[probe_target])

    print(f"    [feat-sel] probe on {len(all_features)} features "
          f"(target={probe_target}, train={len(tr_p)})...")

    probe_params = {
        "objective": "regression", "metric": "rmse",
        "learning_rate": 0.05, "num_leaves": 63,
        "min_child_samples": 30, "feature_fraction": 0.8,
        "bagging_fraction": 0.8, "bagging_freq": 1,
        "verbosity": -1, "seed": SEED,
        "feature_pre_filter": False,
    }
    cats = [f for f in CATEGORICAL_FEATURES if f in all_features]
    d_tr = lgb.Dataset(tr_p[all_features], label=tr_p[probe_target],
                       categorical_feature=cats, free_raw_data=False)
    d_vl = lgb.Dataset(vl_p[all_features], label=vl_p[probe_target],
                       reference=d_tr)

    probe = lgb.train(
        probe_params, d_tr, num_boost_round=500,
        valid_sets=[d_vl],
        callbacks=[
            lgb.early_stopping(30, verbose=False),
            lgb.log_evaluation(period=-1),
        ],
    )

    gains  = probe.feature_importance(importance_type="gain")
    splits = probe.feature_importance(importance_type="split")
    imp_df = pd.DataFrame({
        "Feature": all_features,
        "Gain":    gains,
        "Split":   splits,
    }).sort_values("Gain", ascending=False).reset_index(drop=True)

    # Stage 1 — zero gain
    nonzero      = imp_df[imp_df["Gain"] > 0]["Feature"].tolist()
    dropped_zero = [f for f in all_features if f not in nonzero]
    if dropped_zero:
        print(f"    [feat-sel] zero-gain dropped: {dropped_zero}")

    # Stage 2 — cumulative threshold
    nz = imp_df[imp_df["Gain"] > 0].copy()
    nz["cum_pct"] = nz["Gain"].cumsum() / nz["Gain"].sum()
    retained_df   = nz[nz["cum_pct"].shift(1, fill_value=0) < CUMULATIVE_GAIN_THRESHOLD]
    retained      = retained_df["Feature"].tolist()

    dropped_low = [f for f in nonzero if f not in retained]
    if dropped_low:
        print(f"    [feat-sel] low-gain dropped (cum<{CUMULATIVE_GAIN_THRESHOLD}): "
              f"{dropped_low}")

    # Always keep District
    if "District" in all_features and "District" not in retained:
        retained = ["District"] + retained
        print("    [feat-sel] District force-retained")

    print(f"    [feat-sel] retained {len(retained)} / {len(all_features)} features")

    imp_df["Retained"] = imp_df["Feature"].isin(retained)
    return retained, imp_df

# ══════════════════════════════════════════════════════════════════════════════
# OPTUNA OBJECTIVE
# ══════════════════════════════════════════════════════════════════════════════

def make_objective(tr, vl, features, target):
    dtrain, dval, _ = make_lgb_datasets(tr, vl, features, target)

    def objective(trial):
        params = {
            "objective": "regression", "metric": OPTUNA_METRIC,
            "verbosity": -1, "seed": SEED,
            "feature_pre_filter": False,
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "num_leaves":    trial.suggest_int("num_leaves", 20, 300),
            "max_depth":     trial.suggest_int("max_depth", 4, 12),
            "min_child_samples": trial.suggest_int("min_child_samples", 20, 200),
            "feature_fraction":  trial.suggest_float("feature_fraction", 0.5, 1.0),
            "bagging_fraction":  trial.suggest_float("bagging_fraction", 0.5, 1.0),
            "bagging_freq": 1,
            "lambda_l1": trial.suggest_float("lambda_l1", 1e-8, 10.0, log=True),
            "lambda_l2": trial.suggest_float("lambda_l2", 1e-8, 10.0, log=True),
        }
        model = lgb.train(
            params, dtrain,
            num_boost_round=MAX_BOOST_ROUNDS,
            valid_sets=[dval],
            callbacks=[
                lgb.early_stopping(EARLY_STOP_ROUNDS, verbose=False),
                lgb.log_evaluation(period=-1),
            ],
        )
        preds = model.predict(vl[features], num_iteration=model.best_iteration)
        rmse  = float(np.sqrt(mean_squared_error(vl[target].values, preds)))
        trial.set_user_attr("best_iteration", model.best_iteration)
        return rmse

    return objective

# ══════════════════════════════════════════════════════════════════════════════
# PER-COMMODITY × PER-HORIZON TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train_horizon(
    commodity, horizon,
    tr, vl, te,
    retained_all,       # full retained set from feature selection
    n_trials,
    out_dir,
    cname,              # safe folder name
):
    """Train one model for (commodity, horizon). Returns metrics dict or None."""

    target  = f"target_{horizon}d"
    h_label = f"h{horizon}d"

    # Drop rows where forward target is NaN (tail of each group)
    # AND gap-buffer rows whose target window crosses into the next split —
    # otherwise the model is trained/evaluated on rows whose label (the
    # actual future price) physically falls inside the *next* split's date
    # range, which is leakage (see explanation in chat).
    horizon_td = pd.Timedelta(days=horizon)

    tr_h = tr.dropna(subset=[target])
    if "Arrival_Date" in tr_h.columns:
        train_gap_cutoff = VAL_START_DATE - horizon_td
        tr_h = tr_h[tr_h["Arrival_Date"] < train_gap_cutoff]

    vl_h = vl.dropna(subset=[target])
    if "Arrival_Date" in vl_h.columns:
        val_gap_cutoff = TEST_START_DATE - horizon_td
        vl_h = vl_h[vl_h["Arrival_Date"] < val_gap_cutoff]

    te_h = te.dropna(subset=[target])

    if len(tr_h) < 100 or len(vl_h) < 20:
        print(f"    [{h_label}] SKIPPED — insufficient rows "
              f"(train={len(tr_h)}, val={len(vl_h)})")
        return None

    # Apply horizon-aware feature masking
    features = valid_features_for_horizon(retained_all, horizon)

    dropped_by_horizon = [f for f in retained_all if f not in features]
    if dropped_by_horizon:
        print(f"    [{h_label}] horizon-masked (not available at inference): "
              f"{dropped_by_horizon}")

    if len(features) < 3:
        print(f"    [{h_label}] SKIPPED — too few features after horizon masking")
        return None

    print(f"    [{h_label}] {len(features)} features, "
          f"train={len(tr_h):,} val={len(vl_h):,} test={len(te_h):,}")

    # ── Optuna ───────────────────────────────────────────────────────────────
    print(f"    [{h_label}] Optuna ({n_trials} trials)...")

    study = optuna.create_study(
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=SEED),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=10, n_warmup_steps=50),
    )
    study.optimize(
        make_objective(tr_h, vl_h, features, target),
        n_trials=n_trials,
        show_progress_bar=False,
    )

    best_params = study.best_trial.params
    best_iter   = study.best_trial.user_attrs.get("best_iteration", 300)
    best_val_rmse = study.best_value

    print(f"    [{h_label}] best val RMSE={best_val_rmse:.4f}  "
          f"iter={best_iter}  trial=#{study.best_trial.number}")

    # ── Final model on train+val ──────────────────────────────────────────────
    final_rounds = max(int(best_iter * FINAL_ROUND_SCALE), 100)
    combined     = pd.concat([tr_h, vl_h], ignore_index=True)
    cats         = [f for f in CATEGORICAL_FEATURES if f in features]

    final_params = {
        "objective": "regression", "metric": "rmse",
        "verbosity": -1, "seed": SEED,
        "feature_pre_filter": False,
        **best_params,
    }

    d_combined = lgb.Dataset(
        combined[features], label=combined[target],
        categorical_feature=cats, free_raw_data=False,
    )
    final_model = lgb.train(final_params, d_combined, num_boost_round=final_rounds)

    # ── Val metrics (re-train to best_iter on train-only) ────────────────────
    dtrain_only, dval_lgb, _ = make_lgb_datasets(tr_h, vl_h, features, target)
    val_model = lgb.train(
        final_params, dtrain_only,
        num_boost_round=best_iter,
        valid_sets=[dval_lgb],
        callbacks=[lgb.log_evaluation(period=-1)],
    )
    val_preds   = val_model.predict(vl_h[features])
    val_metrics = compute_metrics(vl_h[target].values, val_preds)

    # ── Test metrics ─────────────────────────────────────────────────────────
    te_preds     = final_model.predict(te_h[features])
    test_metrics = compute_metrics(te_h[target].values, te_preds)

    print(f"    [{h_label}] val  RMSE={val_metrics['RMSE']:.2f}  "
          f"MAE={val_metrics['MAE']:.2f}  "
          f"MAPE={val_metrics['MAPE_%']:.2f}%  R²={val_metrics['R2']:.4f}")
    print(f"    [{h_label}] test RMSE={test_metrics['RMSE']:.2f}  "
          f"MAE={test_metrics['MAE']:.2f}  "
          f"MAPE={test_metrics['MAPE_%']:.2f}%  R²={test_metrics['R2']:.4f}")

    # ── Feature importance ────────────────────────────────────────────────────
    gains  = final_model.feature_importance(importance_type="gain")
    splits = final_model.feature_importance(importance_type="split")
    imp_df = pd.DataFrame({
        "Feature": features, "Gain": gains, "Split": splits,
    }).sort_values("Gain", ascending=False).reset_index(drop=True)
    imp_df["Gain_pct"] = (imp_df["Gain"] / imp_df["Gain"].sum() * 100).round(3)

    # ── Save ─────────────────────────────────────────────────────────────────
    h_dir = out_dir / h_label
    h_dir.mkdir(parents=True, exist_ok=True)

    with open(h_dir / f"{cname}_{h_label}_model.pkl", "wb") as f:
        pickle.dump(final_model, f)

    imp_df.to_csv(h_dir / f"{cname}_{h_label}_feature_importance.csv", index=False)

    metrics_row = {
        "Commodity": commodity, "Horizon": horizon,
        "Train_rows": len(tr_h), "Val_rows": len(vl_h), "Test_rows": len(te_h),
        "Features_used": len(features),
        "Features_horizon_masked": len(dropped_by_horizon),
        "Best_HPO_iteration": best_iter, "Final_rounds": final_rounds,
        "Val_RMSE":   val_metrics["RMSE"],  "Val_MAE":   val_metrics["MAE"],
        "Val_MAPE_%": val_metrics["MAPE_%"],"Val_R2":    val_metrics["R2"],
        "Test_RMSE":  test_metrics["RMSE"], "Test_MAE":  test_metrics["MAE"],
        "Test_MAPE_%":test_metrics["MAPE_%"],"Test_R2":  test_metrics["R2"],
    }
    pd.DataFrame([metrics_row]).to_csv(
        h_dir / f"{cname}_{h_label}_metrics.csv", index=False
    )

    params_out = {
        "best_params":            best_params,
        "best_iteration":         best_iter,
        "final_rounds":           final_rounds,
        "features_used":          features,
        "features_horizon_masked": dropped_by_horizon,
        "val_rmse":               best_val_rmse,
    }
    with open(h_dir / f"{cname}_{h_label}_best_params.json", "w") as f:
        json.dump(params_out, f, indent=2)

    # Top-15 console print
    print(f"\n    [{h_label}] Top 10 features:")
    for i, row in imp_df.head(10).iterrows():
        print(f"      {i+1:>2}. {row['Feature']:<32} {row['Gain_pct']:>6.2f}%")

    return metrics_row


def train_commodity(commodity, train_df, val_df, test_df, horizons, n_trials):
    cname = safe_name(commodity)
    out_dir = OUTPUT_ROOT / cname
    out_dir.mkdir(parents=True, exist_ok=True)

    print()
    print("═" * 70)
    print(f"  COMMODITY: {commodity}")
    print("═" * 70)

    tr = train_df[train_df["Commodity"] == commodity].copy()
    vl = val_df[val_df["Commodity"]     == commodity].copy()
    te = test_df[test_df["Commodity"]   == commodity].copy()

    print(f"  Total rows — train:{len(tr):,}  val:{len(vl):,}  test:{len(te):,}")

    if len(tr) < 100:
        print("  ⚠ Skipping — insufficient training data.")
        return []

    # ── Feature selection (once per commodity) ────────────────────────────────
    all_candidate = [
        f for f in (list(LAG_FEATURES.keys()) + BASE_FEATURES)
        if f in tr.columns
    ]
    missing = [
        f for f in (list(LAG_FEATURES.keys()) + BASE_FEATURES)
        if f not in tr.columns
    ]
    if missing:
        print(f"  ⚠ Missing columns: {missing}")

    retained_all, feat_sel_df = select_features(tr, vl, all_candidate, commodity)

    # Save feature selection detail once (commodity level)
    feat_sel_df.to_csv(out_dir / f"{cname}_feature_selection.csv", index=False)

    # ── Train each horizon ────────────────────────────────────────────────────
    results = []
    for horizon in sorted(horizons):
        result = train_horizon(
            commodity=commodity, horizon=horizon,
            tr=tr, vl=vl, te=te,
            retained_all=retained_all,
            n_trials=n_trials,
            out_dir=out_dir,
            cname=cname,
        )
        if result:
            results.append(result)

    return results

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    args = parse_args()

    print("=" * 70)
    print("Tamil Nadu Crop Price Forecasting — All Horizons")
    print(f"Horizons: {sorted(args.horizons)}")
    print("=" * 70)

    print(f"\nLoading data...")
    train_df = pd.read_csv(args.train, low_memory=False)
    val_df   = pd.read_csv(args.val,   low_memory=False)
    test_df  = pd.read_csv(args.test,  low_memory=False)

    for df in [train_df, val_df, test_df]:
        if "District" in df.columns:
            df["District"] = df["District"].astype("category")
        if "Arrival_Date" in df.columns:
            df["Arrival_Date"] = pd.to_datetime(df["Arrival_Date"])

    print(f"  train: {len(train_df):,}  val: {len(val_df):,}  test: {len(test_df):,}")

    commodities = [args.commodity] if args.commodity else COMMODITIES
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    all_metrics = []
    for commodity in commodities:
        results = train_commodity(
            commodity=commodity,
            train_df=train_df, val_df=val_df, test_df=test_df,
            horizons=args.horizons,
            n_trials=args.trials,
        )
        all_metrics.extend(results)

    # ── Overall summary ───────────────────────────────────────────────────────
    if all_metrics:
        summary_df = pd.DataFrame(all_metrics)
        summary_path = OUTPUT_ROOT / "overall_summary.csv"
        summary_df.to_csv(summary_path, index=False)

        print()
        print("=" * 70)
        print("OVERALL SUMMARY")
        print("=" * 70)

        # Pivot: commodities × horizons, showing test MAPE
        pivot = summary_df.pivot(
            index="Commodity", columns="Horizon", values="Test_MAPE_%"
        )
        pivot.columns = [f"h{c}d_TestMAPE%" for c in pivot.columns]
        print("\nTest MAPE (%) — lower is better:")
        print(pivot.round(2).to_string())

        pivot_r2 = summary_df.pivot(
            index="Commodity", columns="Horizon", values="Test_R2"
        )
        pivot_r2.columns = [f"h{c}d_TestR2" for c in pivot_r2.columns]
        print("\nTest R² — higher is better:")
        print(pivot_r2.round(4).to_string())

        print(f"\nAverage test MAPE across all commodity×horizon: "
              f"{summary_df['Test_MAPE_%'].mean():.2f}%")
        print(f"Average test R²: {summary_df['Test_R2'].mean():.4f}")
        print(f"\nSaved → {summary_path}")

    print()
    print("=" * 70)
    print("DONE")
    print("=" * 70)


if __name__ == "__main__":
    main()
