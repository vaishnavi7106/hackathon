"""Integration tests for Pillar 2 router using FastAPI TestClient.

No database required — Pillar 2 is stateless (JSON data files only).
Weather fetch is mocked to avoid real HTTP calls.
"""
import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_MOCK_WEATHER = {
    "district": "Thanjavur",
    "forecast_date": "2026-06-18",
    "source": "Test mock",
    "days": [
        {
            "date": f"2026-06-{18 + i:02d}",
            "day_of_week": ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"][i],
            "tmax_c": 33.0, "tmin_c": 25.0,
            "rainfall_mm": 0.0, "et0_mm": 5.0,
        }
        for i in range(7)
    ],
}

_VALID_REQUEST = {
    "district": "Thanjavur",
    "crop": "rice",
    "season": "dry_season",
    "land_acres": 2.5,
    "irrigation_type": "borewell",
    "crop_stage_days": 0,
    "lang": "ta",
}


def test_happy_path_full_prescription():
    """POST /v2/soil/prescribe with valid Thanjavur+rice → 200 with all required fields."""
    with patch("pillar2.router.fetch_weather", new_callable=AsyncMock) as mock_wx, \
         patch("pillar2.router.generate_explanation", new_callable=AsyncMock) as mock_llm:
        mock_wx.return_value = _MOCK_WEATHER
        mock_llm.return_value = "Test explanation."

        resp = client.post("/v2/soil/prescribe", json=_VALID_REQUEST)

    assert resp.status_code == 200
    data = resp.json()

    required_fields = [
        "prescription_id", "district", "crop", "zone_id", "zone_name",
        "recommendation", "products", "split_schedule", "joint_calendar",
        "explanation", "disclaimer", "generated_at",
    ]
    for field in required_fields:
        assert field in data, f"Missing field: {field}"

    rec = data["recommendation"]
    assert rec["rec_id"] == "REC-001"
    assert rec["n_kg_ha"] == 150

    prod = data["products"]
    assert prod["urea_bags"] >= 0
    assert prod["dap_bags"]  >= 0
    assert prod["mop_bags"]  >= 0
    assert prod["cost"]["total_inr"] > 0


def test_invalid_district_returns_404():
    """Unknown district → 404 with error: district_not_found."""
    req = {**_VALID_REQUEST, "district": "Neverland"}
    resp = client.post("/v2/soil/prescribe", json=req)
    assert resp.status_code == 404
    assert resp.json()["error"] == "district_not_found"
    assert "supported_districts" in resp.json()


def test_unsupported_crop_returns_404():
    """Unsupported crop → 404 with error: crop_not_supported."""
    req = {**_VALID_REQUEST, "crop": "unicorn_herb"}
    resp = client.post("/v2/soil/prescribe", json=req)
    assert resp.status_code == 404
    assert resp.json()["error"] == "crop_not_supported"
    assert "supported_crops" in resp.json()


def test_missing_required_field_returns_422():
    """Missing 'district' → 422 Unprocessable Entity."""
    req = {k: v for k, v in _VALID_REQUEST.items() if k != "district"}
    resp = client.post("/v2/soil/prescribe", json=req)
    assert resp.status_code == 422


def test_get_crops_returns_list():
    """GET /v2/soil/crops → 200 with at least 8 crops."""
    resp = client.get("/v2/soil/crops")
    assert resp.status_code == 200
    crops = resp.json()["crops"]
    assert len(crops) >= 8
    crop_names = [c["crop"] for c in crops]
    assert "rice" in crop_names
    assert "groundnut" in crop_names


def test_get_districts_returns_38():
    """GET /v2/soil/districts → 200 with all 38 TN districts."""
    resp = client.get("/v2/soil/districts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 38
    assert len(data["districts"]) == 38


def test_get_prices():
    """GET /v2/soil/prices → 200 with at least 3 products."""
    resp = client.get("/v2/soil/prices")
    assert resp.status_code == 200
    assert len(resp.json()["prices"]) >= 3


def test_prescription_with_symptoms():
    """N-deficiency symptom → adjusted N > base N in response."""
    req = {**_VALID_REQUEST, "symptoms": ["n_deficiency"]}
    with patch("pillar2.router.fetch_weather", new_callable=AsyncMock) as mock_wx, \
         patch("pillar2.router.generate_explanation", new_callable=AsyncMock) as mock_llm:
        mock_wx.return_value = _MOCK_WEATHER
        mock_llm.return_value = "Test."
        resp = client.post("/v2/soil/prescribe", json=req)

    assert resp.status_code == 200
    rec = resp.json()["recommendation"]
    assert rec["n_adjusted"] > rec["n_kg_ha"]
    assert rec["confidence_level"] == "symptom_adjusted"


def test_weather_failure_graceful_degradation():
    """When weather fails, prescription still returns 200 with irrigation=null."""
    with patch("pillar2.router.fetch_weather", new_callable=AsyncMock) as mock_wx, \
         patch("pillar2.router.generate_explanation", new_callable=AsyncMock) as mock_llm:
        mock_wx.return_value = None  # weather unavailable
        mock_llm.return_value = "Test."
        resp = client.post("/v2/soil/prescribe", json=_VALID_REQUEST)

    assert resp.status_code == 200
    data = resp.json()
    assert data["irrigation"] is None
    assert "weather_note" in data
