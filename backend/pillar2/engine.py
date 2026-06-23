"""TNAU Lookup Engine — deterministic NPK prescription from zone + crop lookup table.

No ML. No inference. Every number comes from fertilizer_recommendations_production.json,
which is sourced from TNAU Crop Production Guide 2020.
"""
from __future__ import annotations

from .data.load import DISTRICT_INDEX, REC_INDEX, ZONES


class RecommendationNotFoundError(Exception):
    """Raised when no matching recommendation exists in the lookup table."""


SYMPTOM_ADJUSTMENTS: dict[str, dict] = {
    "n_deficiency":     {"nutrient": "n", "multiplier": 1.20},
    "p_deficiency":     {"nutrient": "p", "multiplier": 1.15},
    "k_deficiency":     {"nutrient": "k", "multiplier": 1.10},
    "general_yellowing": {"nutrient": "n", "multiplier": 1.15},
    "stunting":         {"nutrient": "n", "multiplier": 1.10},
    "purple_tinge":     {"nutrient": "p", "multiplier": 1.15},
    "brown_leaf_tips":  {"nutrient": "k", "multiplier": 1.10},
}

# Normalize sub-irrigation types to canonical "irrigated" or "rainfed"
_IRR_NORMALIZE: dict[str, str] = {
    "irrigated": "irrigated",
    "borewell":  "irrigated",
    "canal":     "irrigated",
    "tank":      "irrigated",
    "rainfed":   "rainfed",
}

# Season normalization to canonical season_bucket values
_SEASON_NORMALIZE: dict[str, str] = {
    "kharif":     "wet_season",
    "samba":      "dry_season",   # Samba = long-duration dry season paddy in TN
    "wet_season": "wet_season",
    "rabi":       "dry_season",
    "navarai":    "dry_season",
    "dry_season": "dry_season",
    "summer":     "dry_season",
    "kuruvai":    "wet_season",
    "annual":     "annual",
    "perennial":  "annual",
    "any":        "any",
}


def lookup_recommendation(district: str, crop: str, irrigation_type: str, season: str) -> dict:
    """Return the best-matching TNAU recommendation dict for the given parameters.

    Raises RecommendationNotFoundError if no match is found even after fallbacks.
    """
    district_n = district.lower().strip()
    crop_n = crop.lower().strip()
    irr_n = _IRR_NORMALIZE.get(irrigation_type.lower().strip(), "irrigated")
    season_n = _SEASON_NORMALIZE.get(season.lower().strip(), season.lower().strip())

    district_info = DISTRICT_INDEX.get(district_n)
    if district_info is None:
        supported = sorted(DISTRICT_INDEX.keys())
        raise RecommendationNotFoundError(
            f"District '{district}' not found. "
            f"Supported districts include: {', '.join(supported[:8])}..."
        )

    zone_id = int(district_info["zone_id"])
    zone_info = ZONES.get(zone_id, {})

    # Fallback chain: zone-specific first, then zone-0 wildcard
    fallback_chain = [
        (zone_id, crop_n, irr_n,      season_n),
        (zone_id, crop_n, irr_n,      "any"),
        (zone_id, crop_n, "any",      "any"),
        (0,       crop_n, irr_n,      season_n),
        (0,       crop_n, irr_n,      "any"),
        (0,       crop_n, "any",      "any"),
    ]

    for key in fallback_chain:
        if key in REC_INDEX:
            rec = dict(REC_INDEX[key])
            rec["_district_info"] = district_info
            rec["_zone_info"] = zone_info
            return rec

    supported_crops = sorted({v["crop"] for v in REC_INDEX.values()})
    raise RecommendationNotFoundError(
        f"No TNAU recommendation found for crop '{crop}' "
        f"(irrigation: '{irrigation_type}', season: '{season}'). "
        f"Supported crops: {', '.join(supported_crops)}"
    )


def apply_symptom_adjustments(
    rec: dict,
    symptoms: list[str] | None,
    shc_data: dict | None = None,
) -> dict:
    """Apply field-observed symptom multipliers and SHC data to base NPK values."""
    n_base = float(rec["n_kg_ha"])
    p_base = float(rec["p_kg_ha"])
    k_base = float(rec["k_kg_ha"])

    n_mult = 1.0
    p_mult = 1.0
    k_mult = 1.0
    adjustments: list[str] = []

    for symptom in (symptoms or []):
        adj = SYMPTOM_ADJUSTMENTS.get(symptom.lower().strip())
        if adj is None:
            continue
        nutrient, mult = adj["nutrient"], adj["multiplier"]
        if nutrient == "n":
            n_mult = max(n_mult, mult)
            adjustments.append(
                f"N increased by {int((mult - 1) * 100)}% — {symptom.replace('_', ' ')} observed"
            )
        elif nutrient == "p":
            p_mult = max(p_mult, mult)
            adjustments.append(
                f"P increased by {int((mult - 1) * 100)}% — {symptom.replace('_', ' ')} observed"
            )
        elif nutrient == "k":
            k_mult = max(k_mult, mult)
            adjustments.append(
                f"K increased by {int((mult - 1) * 100)}% — {symptom.replace('_', ' ')} observed"
            )

    # SHC low-N adjustment
    if shc_data and "n_kg_ha" in shc_data:
        shc_n = float(shc_data["n_kg_ha"])
        if shc_n < n_base * 0.7:
            n_mult = min(n_mult * 1.25, 1.50)
            adjustments.append("N further increased — Soil Health Card shows low N status")

    n_mult = min(n_mult, 1.50)

    if shc_data:
        confidence = "soil_health_card"
    elif adjustments:
        confidence = "symptom_adjusted"
    else:
        confidence = "district_default"

    return {
        **rec,
        "n_adjusted": round(n_base * n_mult, 1),
        "p_adjusted": round(p_base * p_mult, 1),
        "k_adjusted": round(k_base * k_mult, 1),
        "adjustments_applied": adjustments,
        "confidence_level": confidence,
    }
