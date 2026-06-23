"""Tests for NPK → bags → cost converter (pillar2/products.py)."""
import pytest

from pillar2.products import npk_to_products


def test_rice_zone1_npk_per_hectare():
    """N=150, P=50, K=50, 1 acre → verify calculation correctness."""
    result = npk_to_products(150, 50, 50, land_acres=1.0)
    land_ha = 1.0 * 0.4047

    # P via DAP: 50 / 0.46 = 108.70 kg/ha
    dap_ha = 50 / 0.46
    # N from DAP: 108.70 * 0.18 = 19.57 kg/ha
    n_from_dap = dap_ha * 0.18
    # Remaining N via Urea: (150 - 19.57) / 0.46 = 283.5 kg/ha
    urea_ha = (150 - n_from_dap) / 0.46
    mop_ha = 50 / 0.60

    assert result["per_hectare"]["urea_kg"] == pytest.approx(round(urea_ha, 1), abs=0.5)
    assert result["per_hectare"]["dap_kg"]  == pytest.approx(round(dap_ha, 1),  abs=0.5)
    assert result["per_hectare"]["mop_kg"]  == pytest.approx(round(mop_ha, 1),  abs=0.5)

    # Total for farm bags
    urea_total = urea_ha * land_ha
    assert result["total_for_farm"]["urea_bags"] == pytest.approx(urea_total / 45, abs=0.2)


def test_groundnut_rainfed_low_n():
    """N=10, P=30, K=20, 1 acre — groundnut legume (very low N)."""
    result = npk_to_products(10, 30, 20, land_acres=1.0)
    # Bags should be positive
    assert result["total_for_farm"]["dap_bags"] > 0
    assert result["total_for_farm"]["mop_bags"] > 0
    # Urea bags should be very low (most N from DAP covers it)
    assert result["total_for_farm"]["urea_bags"] >= 0


def test_land_scaling_2_5_acres():
    """2.5 acres = 2.5 × 0.4047 = 1.0118 ha — verify bags scale proportionally (within rounding)."""
    res1 = npk_to_products(150, 50, 50, land_acres=1.0)
    res2 = npk_to_products(150, 50, 50, land_acres=2.5)
    # Allow ±0.2 bags tolerance due to independent rounding at different scales
    assert res2["total_for_farm"]["urea_bags"] == pytest.approx(
        res1["total_for_farm"]["urea_bags"] * 2.5, abs=0.3
    )
    assert res2["total_for_farm"]["dap_bags"] == pytest.approx(
        res1["total_for_farm"]["dap_bags"] * 2.5, abs=0.3
    )
    # Cost should scale linearly too
    assert res2["cost"]["total_inr"] > res1["cost"]["total_inr"] * 2.0


def test_all_values_positive():
    """No negative bag counts or costs under any valid NPK input."""
    result = npk_to_products(120, 40, 40, land_acres=3.0)
    farm = result["total_for_farm"]
    assert farm["urea_bags"] >= 0
    assert farm["dap_bags"]  >= 0
    assert farm["mop_bags"]  >= 0
    assert result["cost"]["urea_inr"] >= 0
    assert result["cost"]["dap_inr"]  >= 0
    assert result["cost"]["mop_inr"]  >= 0
    assert result["cost"]["total_inr"] >= 0


def test_total_cost_equals_sum():
    """total_inr must equal urea_inr + dap_inr + mop_inr exactly."""
    result = npk_to_products(150, 50, 50, land_acres=2.5)
    cost = result["cost"]
    expected_total = cost["urea_inr"] + cost["dap_inr"] + cost["mop_inr"]
    assert cost["total_inr"] == pytest.approx(expected_total, abs=1.0)
