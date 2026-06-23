"""Load all Pillar 2 datasets at module import time.

All data loaded from JSON files in this directory.
CSV files are provided as reference/audit backup only.
"""
from __future__ import annotations

import json
from pathlib import Path

_DATA_DIR = Path(__file__).parent

# ---------------------------------------------------------------------------
# Raw data lists
# ---------------------------------------------------------------------------

with open(_DATA_DIR / "tn_district_zone_mapping.json", encoding="utf-8") as _f:
    _zone_map = json.load(_f)

DISTRICTS: list[dict] = _zone_map["districts"]
ZONES: dict[int, dict] = {int(k): v for k, v in _zone_map["zones"].items()}

with open(_DATA_DIR / "fertilizer_recommendations_production.json", encoding="utf-8") as _f:
    RECOMMENDATIONS: list[dict] = json.load(_f)["recommendations"]

with open(_DATA_DIR / "fao56_crop_coefficients.json", encoding="utf-8") as _f:
    KC_TABLE: list[dict] = json.load(_f)["crop_coefficients"]

with open(_DATA_DIR / "fertilizer_prices_2026.json", encoding="utf-8") as _f:
    _prices_raw = json.load(_f)

PRICES: list[dict] = _prices_raw["prices"]

# ---------------------------------------------------------------------------
# Lookup indexes (built once at startup)
# ---------------------------------------------------------------------------

# district name (lowercase, stripped) → district dict
DISTRICT_INDEX: dict[str, dict] = {d["name"].lower().strip(): d for d in DISTRICTS}

# (zone_id, crop_normalized, irrigation_type, season_bucket) → recommendation dict
# zone_id=0 acts as a wildcard/any-zone fallback
REC_INDEX: dict[tuple, dict] = {}
for _rec in RECOMMENDATIONS:
    _key = (
        int(_rec["zone_id"]),
        _rec["crop"].lower().strip(),
        _rec["irrigation_type"].lower().strip(),
        _rec["season_bucket"].lower().strip(),
    )
    REC_INDEX[_key] = _rec

# crop (lowercase) → {stage_name → kc_value}
KC_INDEX: dict[str, dict[str, float]] = {}
# crop (lowercase) → list of stage dicts (with duration_days)
KC_STAGES: dict[str, list[dict]] = {}
for _entry in KC_TABLE:
    _cn = _entry["crop"].lower()
    KC_INDEX[_cn] = {s["stage"]: s["kc_value"] for s in _entry["stages"]}
    KC_STAGES[_cn] = _entry["stages"]

# product name (lowercase) → price dict
PRICE_INDEX: dict[str, dict] = {p["product"].lower(): p for p in PRICES}
