"""NPK kg/ha → fertilizer bags → cost converter.

Conversion constants verified from TNAU CPG 2020 and standard fertilizer specifications.
Prices from fertilizer_prices_2026.json (Government MRP, Kharif 2025-26).
"""
from __future__ import annotations

from .data.load import PRICE_INDEX

# Nutrient percentages
UREA_N_PCT  = 0.46   # Urea: 46% N
DAP_N_PCT   = 0.18   # DAP:  18% N
DAP_P_PCT   = 0.46   # DAP:  46% P2O5
MOP_K_PCT   = 0.60   # MOP:  60% K2O

# Standard bag weights (kg)
UREA_BAG_KG = 45
DAP_BAG_KG  = 50
MOP_BAG_KG  = 50

# Government MRP per bag (from fertilizer_prices_2026.json)
def _price(product: str) -> float:
    return PRICE_INDEX.get(product, {}).get("price_per_bag_inr", 0.0)


def npk_to_products(
    n_kg_ha: float,
    p_kg_ha: float,
    k_kg_ha: float,
    land_acres: float,
) -> dict:
    """Convert per-hectare NPK requirements to fertilizer bags and cost for the farm.

    Conversion strategy:
      1. Meet all P requirement via DAP (DAP also supplies some N).
      2. Supply remaining N via Urea.
      3. Supply all K via MOP.

    Args:
        n_kg_ha:    Nitrogen requirement in kg/ha.
        p_kg_ha:    Phosphorus (P2O5) requirement in kg/ha.
        k_kg_ha:    Potassium (K2O) requirement in kg/ha.
        land_acres: Farm area in acres (converted to ha internally).

    Returns:
        Dict with per_hectare, total_for_farm, cost, and prices_used sections.
    """
    land_ha = land_acres * 0.4047

    # Per-hectare calculations
    dap_kg_ha  = p_kg_ha / DAP_P_PCT                        # meet all P with DAP
    n_from_dap = dap_kg_ha * DAP_N_PCT                      # N already from DAP
    n_from_urea = max(0.0, n_kg_ha - n_from_dap)            # remaining N via Urea
    urea_kg_ha  = n_from_urea / UREA_N_PCT
    mop_kg_ha   = k_kg_ha / MOP_K_PCT

    # Total for the farm
    urea_kg = urea_kg_ha * land_ha
    dap_kg  = dap_kg_ha  * land_ha
    mop_kg  = mop_kg_ha  * land_ha

    urea_bags = round(urea_kg / UREA_BAG_KG, 1)
    dap_bags  = round(dap_kg  / DAP_BAG_KG,  1)
    mop_bags  = round(mop_kg  / MOP_BAG_KG,  1)

    urea_price = _price("urea")
    dap_price  = _price("dap")
    mop_price  = _price("mop")

    urea_inr = round(urea_bags * urea_price)
    dap_inr  = round(dap_bags  * dap_price)
    mop_inr  = round(mop_bags  * mop_price)

    return {
        "per_hectare": {
            "urea_kg": round(urea_kg_ha, 1),
            "dap_kg":  round(dap_kg_ha,  1),
            "mop_kg":  round(mop_kg_ha,  1),
        },
        "total_for_farm": {
            "urea_kg":   round(urea_kg, 1),
            "urea_bags": urea_bags,
            "dap_kg":    round(dap_kg, 1),
            "dap_bags":  dap_bags,
            "mop_kg":    round(mop_kg, 1),
            "mop_bags":  mop_bags,
        },
        "cost": {
            "urea_inr":  float(urea_inr),
            "dap_inr":   float(dap_inr),
            "mop_inr":   float(mop_inr),
            "total_inr": float(urea_inr + dap_inr + mop_inr),
        },
        "prices_used": {
            "urea_per_bag": urea_price,
            "dap_per_bag":  dap_price,
            "mop_per_bag":  mop_price,
            "source":       "Government MRP — Kharif 2025-26",
        },
    }


def adapt_split_schedule(
    split_schedule: list[dict],
    products: dict,
    stage_days: int,
) -> list[dict]:
    """Convert percentage-based split schedule to actual bag quantities for the farm.

    Returns split events with day >= stage_days (i.e. future events only).
    """
    urea_total  = products["total_for_farm"]["urea_bags"]
    dap_total   = products["total_for_farm"]["dap_bags"]
    mop_total   = products["total_for_farm"]["mop_bags"]

    adapted = []
    for split in split_schedule:
        day      = split["day"]
        n_pct    = split.get("n_pct", 0)
        p_pct    = split.get("p_pct", 0)
        k_pct    = split.get("k_pct", 0)

        urea_split = round(urea_total * n_pct / 100, 1)
        dap_split  = round(dap_total  * p_pct / 100, 1)
        mop_split  = round(mop_total  * k_pct / 100, 1)

        products_list = []
        if urea_split > 0:
            products_list.append(f"Urea {urea_split} bags")
        if dap_split > 0:
            products_list.append(f"DAP {dap_split} bags")
        if mop_split > 0:
            products_list.append(f"MOP {mop_split} bags")

        adapted.append({
            "day":       day,
            "stage":     split.get("stage", ""),
            "stage_ta":  split.get("stage_ta", ""),
            "is_past":   day < stage_days,
            "urea_bags": urea_split,
            "dap_bags":  dap_split,
            "mop_bags":  mop_split,
            "products":  products_list,
        })

    return adapted
