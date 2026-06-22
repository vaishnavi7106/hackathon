"""
monthly_retrain.py — Layer 6, monthly model update
=====================================================
Re-runs the full retrain path: build_features.py --mode retrain ->
prepare_training_data_v2.py -> train_all_horizons_final.py, with a
rolling train/val/test split that slides forward each month.

Horizons restricted to 1/3/7/14 (21d/30d dropped, per current model set).

Writes new clip_bounds.csv and new models to a TEMP location, then
atomically swaps them into place only if the run completes successfully
— predict.py never sees a half-written model directory.

Usage:
  python monthly_retrain.py
  python monthly_retrain.py --commodity Tomato   # test a single crop
"""
import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR    = Path(__file__).parent
_DEFAULT_ROOT  = SCRIPT_DIR.parent.parent / "pillar3_data"
ROOT = Path(os.environ.get("PIPELINE_ROOT", str(_DEFAULT_ROOT)))

# Models live inside the backend/pillar3/models/ tree (committed to git)
_DEFAULT_MODELS_DIR = SCRIPT_DIR.parent / "models" / "models_all_horizons"

BUILD_OUT  = ROOT / "training_data_corrected"
PREP_OUT   = ROOT / "latest"
MODELS_OUT = Path(os.environ.get("MODELS_ROOT", str(_DEFAULT_MODELS_DIR)))

HORIZONS = [1, 3, 7, 14]
VAL_MONTHS = 3
TEST_DAYS_BACK = 75


def compute_split_dates():
    today = datetime.now()
    val_end = today - timedelta(days=TEST_DAYS_BACK)
    train_end = val_end - timedelta(days=VAL_MONTHS * 30)
    return train_end.strftime("%Y-%m-%d"), val_end.strftime("%Y-%m-%d")


def run(cmd, env):
    print(f"\n{'='*70}\n{' '.join(str(c) for c in cmd)}\n{'='*70}")
    result = subprocess.run([str(c) for c in cmd], env=env)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commodity", default=None)
    ap.add_argument("--trials", type=int, default=50)
    args = ap.parse_args()

    train_end, val_end = compute_split_dates()
    print(f"Rolling split: train <= {train_end} | val <= {val_end} | test = rest")

    base_env = os.environ.copy()

    # ── build_features.py --mode retrain (clean -> aggregate -> build) ──
    run([sys.executable, SCRIPT_DIR / "build_features.py", "--mode", "retrain"], base_env)

    # ── prepare_training_data_v2.py (fixes, targets, fresh clip bounds, split) ──
    env = base_env.copy()
    env["INPUT_FILE"] = str(BUILD_OUT / "training_dataset_final.csv")
    env["OUT_DIR"] = str(PREP_OUT)
    env["TRAIN_END"] = train_end
    env["VAL_END"] = val_end
    run([sys.executable, SCRIPT_DIR / "prepare_training_data_v2.py"], env)

    # ── train_all_horizons_final.py, h=1,3,7,14 only, to a staging dir ──
    staging_root = MODELS_OUT.parent / "models_all_horizons_staging"
    if staging_root.exists():
        shutil.rmtree(staging_root)

    env = base_env.copy()
    env["OUTPUT_ROOT"] = str(staging_root)
    env["TRAIN_END"] = train_end
    env["VAL_END"] = val_end
    train_cmd = [
        sys.executable, SCRIPT_DIR / "train_all_horizons_final.py",
        "--train", PREP_OUT / "train.csv",
        "--val",   PREP_OUT / "val.csv",
        "--test",  PREP_OUT / "test.csv",
        "--horizons", *[str(h) for h in HORIZONS],
        "--trials", str(args.trials),
    ]
    if args.commodity:
        train_cmd += ["--commodity", args.commodity]
    run(train_cmd, env)

    # ── Atomic swap: only replace live models if training fully succeeded ──
    if MODELS_OUT.exists():
        backup = MODELS_OUT.parent / f"models_all_horizons_backup_{datetime.now():%Y%m%d}"
        if backup.exists():
            shutil.rmtree(backup)
        shutil.move(str(MODELS_OUT), str(backup))
        print(f"Backed up previous models -> {backup}")

    shutil.move(str(staging_root), str(MODELS_OUT))
    print(f"Swapped in new models -> {MODELS_OUT}")

    # Also copy fresh clip_bounds.csv into the models/latest/ location
    new_clip = PREP_OUT / "clip_bounds.csv"
    clip_dest = MODELS_OUT.parent / "latest" / "clip_bounds.csv"
    if new_clip.exists():
        clip_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(new_clip), str(clip_dest))
        print(f"clip_bounds.csv refreshed at -> {clip_dest}")
    print("\nMonthly retrain complete. predict.py will now serve the new models.")


if __name__ == "__main__":
    main()
