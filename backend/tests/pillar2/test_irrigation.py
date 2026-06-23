"""Tests for irrigation scheduler (pillar2/irrigation.py).

Weather API calls are mocked — no real HTTP requests in tests.
"""
import pytest
from unittest.mock import AsyncMock, patch

from pillar2.irrigation import build_irrigation_schedule, fetch_weather, get_kc


# ---------------------------------------------------------------------------
# Kc lookup tests
# ---------------------------------------------------------------------------

def test_rice_kc_at_day_50_is_mid_season():
    """Rice at day 50 → mid-season stage, Kc=1.20 per FAO-56 table."""
    kc, stage = get_kc("rice", 50)
    assert kc == pytest.approx(1.20, abs=0.01)
    assert stage == "mid"


def test_rice_kc_day_5_is_initial():
    """Rice at day 5 → initial stage, Kc=1.05."""
    kc, stage = get_kc("rice", 5)
    assert kc == pytest.approx(1.05, abs=0.01)
    assert stage == "initial"


def test_groundnut_kc_available():
    """Groundnut Kc lookup should return a value > 0."""
    kc, stage = get_kc("groundnut", 60)
    assert kc > 0


# ---------------------------------------------------------------------------
# Schedule generation tests (mocked weather)
# ---------------------------------------------------------------------------

_MOCK_WEATHER = {
    "district": "Thanjavur",
    "forecast_date": "2026-06-18",
    "source": "Test mock",
    "days": [
        {"date": "2026-06-18", "day_of_week": "Thursday", "tmax_c": 34.0, "tmin_c": 26.0, "rainfall_mm": 0.0, "et0_mm": 5.0},
        {"date": "2026-06-19", "day_of_week": "Friday",   "tmax_c": 33.0, "tmin_c": 25.5, "rainfall_mm": 8.0, "et0_mm": 4.5},
        {"date": "2026-06-20", "day_of_week": "Saturday", "tmax_c": 31.0, "tmin_c": 24.0, "rainfall_mm": 0.0, "et0_mm": 5.2},
        {"date": "2026-06-21", "day_of_week": "Sunday",   "tmax_c": 32.0, "tmin_c": 25.0, "rainfall_mm": 0.0, "et0_mm": 5.1},
        {"date": "2026-06-22", "day_of_week": "Monday",   "tmax_c": 33.5, "tmin_c": 25.5, "rainfall_mm": 2.0, "et0_mm": 4.8},
        {"date": "2026-06-23", "day_of_week": "Tuesday",  "tmax_c": 30.0, "tmin_c": 23.0, "rainfall_mm": 20.0,"et0_mm": 3.0},
        {"date": "2026-06-24", "day_of_week": "Wednesday","tmax_c": 29.0, "tmin_c": 22.5, "rainfall_mm": 0.0, "et0_mm": 4.0},
    ],
}


def test_irrigate_recommended_when_no_rain():
    """Mid-season rice, ET0=5mm, rainfall=0 → irrigate action on day 1."""
    schedule = build_irrigation_schedule(
        crop="rice",
        stage_days=50,       # mid season
        irrigation_type="borewell",
        weather=_MOCK_WEATHER,
        land_acres=1.0,
    )
    day0 = schedule["weekly_schedule"][0]
    assert day0["action"] == "irrigate"
    assert day0["etc_mm"] == pytest.approx(1.20 * 5.0, abs=0.1)
    assert day0["net_deficit_mm"] > 3.0


def test_skip_when_rainfall_exceeds_etc():
    """ET0=4.5mm, rainfall=8mm → net deficit < 0, action = skip_sufficient."""
    schedule = build_irrigation_schedule(
        crop="rice",
        stage_days=50,
        irrigation_type="borewell",
        weather=_MOCK_WEATHER,
        land_acres=1.0,
    )
    day1 = schedule["weekly_schedule"][1]  # 8mm rain day
    assert day1["action"] in ("skip_rain", "skip_sufficient")


def test_heavy_rain_skips():
    """Rain >15mm (day6 = 20mm) → skip_rain."""
    schedule = build_irrigation_schedule(
        crop="rice",
        stage_days=50,
        irrigation_type="borewell",
        weather=_MOCK_WEATHER,
        land_acres=1.0,
    )
    day5 = schedule["weekly_schedule"][5]  # 20mm rain
    assert day5["action"] == "skip_rain"


@pytest.mark.asyncio
async def test_fetch_weather_failure_returns_none():
    """If Open-Meteo is unreachable, fetch_weather must return None (no exception)."""
    import httpx
    with patch("pillar2.irrigation.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("timeout"))
        mock_cls.return_value = mock_client

        result = await fetch_weather("Thanjavur")
        assert result is None


def test_kc_unknown_crop_returns_default():
    """Unknown crop → returns default Kc=1.0 without raising."""
    kc, stage = get_kc("dragonberry", 50)
    assert kc == 1.0
