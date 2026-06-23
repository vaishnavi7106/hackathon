"""Tests for the TNAU lookup engine (pillar2/engine.py).

All assertions verify values loaded from fertilizer_recommendations_production.json.
No mocking needed — these are pure lookup tests.
"""
import pytest

from pillar2.engine import (
    RecommendationNotFoundError,
    apply_symptom_adjustments,
    lookup_recommendation,
)


def test_rice_thanjavur_irrigated_dry_season():
    """Zone 1 district + irrigated rice dry_season → REC-001, N=150."""
    rec = lookup_recommendation("Thanjavur", "rice", "irrigated", "dry_season")
    assert rec["rec_id"] == "REC-001"
    assert rec["n_kg_ha"] == 150
    assert rec["p_kg_ha"] == 50
    assert rec["k_kg_ha"] == 50


def test_rice_coimbatore_same_zone_as_thanjavur():
    """Coimbatore is in the same Zone 1 as Thanjavur → same rec_id REC-001."""
    rec = lookup_recommendation("Coimbatore", "rice", "irrigated", "dry_season")
    assert rec["rec_id"] == "REC-001"
    assert rec["n_kg_ha"] == 150


def test_rice_salem_northern_zone():
    """Salem is Zone 2 → REC-002, N=120."""
    rec = lookup_recommendation("Salem", "rice", "irrigated", "dry_season")
    assert rec["rec_id"] == "REC-002"
    assert rec["n_kg_ha"] == 120


def test_groundnut_madurai_rainfed():
    """Groundnut rainfed (zone-independent REC-008) — N=10 (legume)."""
    rec = lookup_recommendation("Madurai", "groundnut", "rainfed", "any")
    assert rec["rec_id"] == "REC-008"
    assert rec["n_kg_ha"] == 10


def test_cotton_coimbatore_irrigated():
    """Cotton irrigated Zone 1 → REC-009, N=80."""
    rec = lookup_recommendation("Coimbatore", "cotton", "irrigated", "any")
    assert rec["rec_id"] == "REC-009"
    assert rec["n_kg_ha"] == 80


def test_unknown_district_raises():
    """Non-existent district must raise RecommendationNotFoundError."""
    with pytest.raises(RecommendationNotFoundError, match="[Dd]istrict"):
        lookup_recommendation("Atlantis", "rice", "irrigated", "dry_season")


def test_unknown_crop_raises():
    """Unsupported crop must raise RecommendationNotFoundError."""
    with pytest.raises(RecommendationNotFoundError):
        lookup_recommendation("Thanjavur", "dragon_fruit", "irrigated", "dry_season")


def test_n_deficiency_symptom_increases_n_by_20_pct():
    """N-deficiency symptom on rice rec → adjusted N = 150 × 1.20 = 180."""
    rec = lookup_recommendation("Thanjavur", "rice", "irrigated", "dry_season")
    adj = apply_symptom_adjustments(rec, ["n_deficiency"])
    assert adj["n_adjusted"] == pytest.approx(180.0, abs=0.1)
    assert adj["p_adjusted"] == 50.0   # P unchanged
    assert adj["k_adjusted"] == 50.0   # K unchanged
    assert adj["confidence_level"] == "symptom_adjusted"
    assert any("N" in note for note in adj["adjustments_applied"])


def test_no_symptoms_returns_district_default():
    """Empty symptom list → confidence_level = 'district_default', no adjustment."""
    rec = lookup_recommendation("Thanjavur", "rice", "irrigated", "dry_season")
    adj = apply_symptom_adjustments(rec, [])
    assert adj["n_adjusted"] == 150.0
    assert adj["confidence_level"] == "district_default"
    assert adj["adjustments_applied"] == []


def test_borewell_normalizes_to_irrigated():
    """Borewell irrigation type normalizes to 'irrigated' for lookup."""
    rec = lookup_recommendation("Thanjavur", "rice", "borewell", "dry_season")
    assert rec["rec_id"] == "REC-001"


def test_split_schedule_present():
    """Recommendation must include a split_schedule list."""
    rec = lookup_recommendation("Thanjavur", "rice", "irrigated", "dry_season")
    assert isinstance(rec["split_schedule"], list)
    assert len(rec["split_schedule"]) > 0
    assert rec["split_schedule"][0]["day"] == 0
