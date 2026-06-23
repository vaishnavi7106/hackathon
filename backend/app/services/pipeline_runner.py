"""
Async wrapper around the Pillar 3 pipeline scripts.

Each pipeline stage runs as a subprocess so heavy ML libs (LightGBM, Optuna)
stay out of the FastAPI process memory and don't block the event loop.

Exposed:
  run_daily_pipeline()     — fetch → merge → build_features (serve mode)
  run_monthly_retrain()    — full retrain + atomic model swap
  live_features_age_hours(pipeline_root) — staleness check for startup catch-up
"""
import asyncio
import os
import sys
import time
from pathlib import Path

import structlog

_log = structlog.get_logger()

_PIPELINE_SCRIPTS = Path(__file__).parent.parent.parent / "pillar3" / "pipeline"


async def _run_script(script_name: str, extra_args: list[str] | None = None) -> None:
    cmd = [sys.executable, str(_PIPELINE_SCRIPTS / script_name)] + (extra_args or [])
    _log.info("pipeline_script_start", script=script_name)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        env={**os.environ},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    if stdout:
        for line in stdout.decode(errors="replace").splitlines():
            _log.info("pipeline_output", script=script_name, line=line)
    if proc.returncode != 0:
        raise RuntimeError(f"{script_name} exited with code {proc.returncode}")
    _log.info("pipeline_script_done", script=script_name)


async def run_daily_pipeline() -> None:
    """Daily: fetch new AGMARKNET data → update master → rebuild live features."""
    _log.info("pillar3_daily_pipeline_start")
    try:
        await _run_script("fetch_latest_data.py")
        await _run_script("update_master_dataset.py")
        await _run_script("build_features.py", ["--mode", "serve"])
        _log.info("pillar3_daily_pipeline_done")
    except Exception:
        _log.exception("pillar3_daily_pipeline_failed")
        raise


async def run_monthly_retrain() -> None:
    """Monthly: full feature rebuild + LightGBM retrain + atomic model swap."""
    _log.info("pillar3_monthly_retrain_start")
    try:
        await _run_script("monthly_retrain.py")
        _log.info("pillar3_monthly_retrain_done")
    except Exception:
        _log.exception("pillar3_monthly_retrain_failed")
        raise


def live_features_age_hours(pipeline_root: str) -> float:
    """Return age of live_features.csv in hours. Returns inf if file missing."""
    live = Path(pipeline_root) / "live" / "live_features.csv"
    if not live.exists():
        return float("inf")
    return (time.time() - live.stat().st_mtime) / 3600
