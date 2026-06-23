"""Daily recalculation engine — OpenWeatherMap integration + Hargreaves ET0 + daily data.

Fetches OWM current weather + 5-day/3h forecast for a TN district, computes
Hargreaves-Samani ET0, crop water need, irrigation recommendation, and fertilizer
due check from the TNAU split schedule.
"""
from __future__ import annotations

import math
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import get_settings
from .data.load import DISTRICT_INDEX
from .irrigation import get_kc
from .engine import lookup_recommendation, RecommendationNotFoundError
from .products import adapt_split_schedule, npk_to_products

# ---------------------------------------------------------------------------
# OWM cache — 1 hour per district
# ---------------------------------------------------------------------------
_owm_cache: dict[str, dict] = {}
_OWM_CACHE_TTL = 3600  # 1 hour

# Standard pump flow rate (mm/h) used for irrigation duration estimates
_PUMP_FLOW_RATE_MM_H = 4.0


# ---------------------------------------------------------------------------
# Hargreaves-Samani ET0
# ---------------------------------------------------------------------------

def _hargreaves_et0(tmax_c: float, tmin_c: float, lat_deg: float, day_of_year: int) -> float:
    """Compute Hargreaves-Samani reference evapotranspiration (mm/day).

    ET0 = 0.0023 × (Tmean + 17.8) × sqrt(Tmax - Tmin) × Ra_mm
    where Ra_mm = Ra × 0.408 (converts MJ/m²/day to mm/day equivalent)
    """
    tmean = (tmax_c + tmin_c) / 2.0
    delta_t = max(0.0, tmax_c - tmin_c)

    phi = math.radians(lat_deg)
    J = day_of_year

    Gsc = 0.0820  # solar constant MJ/(m²·min)
    dr = 1 + 0.033 * math.cos(2 * math.pi * J / 365)
    delta = 0.409 * math.sin(2 * math.pi * J / 365 - 1.39)
    omegas = math.acos(-math.tan(phi) * math.tan(delta))

    Ra = (
        (24 * 60 / math.pi)
        * Gsc
        * dr
        * (
            omegas * math.sin(phi) * math.sin(delta)
            + math.cos(phi) * math.cos(delta) * math.sin(omegas)
        )
    )
    Ra_mm = Ra * 0.408  # MJ/m²/day → mm/day

    et0 = 0.0023 * (tmean + 17.8) * math.sqrt(delta_t) * Ra_mm
    return max(0.0, round(et0, 2))


# ---------------------------------------------------------------------------
# OWM fetch
# ---------------------------------------------------------------------------

async def fetch_owm_weather(district: str) -> dict | None:
    """Fetch OWM current weather + 5-day/3h forecast for the given TN district.

    Returns structured weather dict or None on any failure.
    Responses cached for 1 hour per district.
    """
    district_n = district.lower().strip()
    cached = _owm_cache.get(district_n)
    if cached and (time.time() - cached["_fetched_at"]) < _OWM_CACHE_TTL:
        return cached["data"]

    district_info = DISTRICT_INDEX.get(district_n)
    if district_info is None:
        return None

    settings = get_settings()
    api_key = settings.openweathermap_api_key
    if not api_key:
        return None

    lat = district_info["lat"]
    lon = district_info["lon"]

    current_url = "https://api.openweathermap.org/data/2.5/weather"
    forecast_url = "https://api.openweathermap.org/data/2.5/forecast"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            cur_resp = await client.get(
                current_url,
                params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
            )
            cur_resp.raise_for_status()
            cur_raw = cur_resp.json()

            fc_resp = await client.get(
                forecast_url,
                params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric", "cnt": 40},
            )
            fc_resp.raise_for_status()
            fc_raw = fc_resp.json()
    except Exception:
        return None

    try:
        today_str = date.today().isoformat()
        tomorrow_str = (date.today() + timedelta(days=1)).isoformat()

        # Current conditions for today
        cur_temp = float(cur_raw["main"]["temp"])
        cur_humidity = float(cur_raw["main"]["humidity"])
        cur_rain = float((cur_raw.get("rain") or {}).get("1h", 0.0))

        # Aggregate forecast for today and tomorrow
        today_temps: list[float] = [cur_temp]
        today_rains: list[float] = [cur_rain]
        tmrw_temps: list[float] = []
        tmrw_rains: list[float] = []

        for item in fc_raw.get("list", []):
            dt_txt = item.get("dt_txt", "")
            dt_date = dt_txt[:10] if dt_txt else ""
            temp = float(item["main"]["temp"])
            rain = float((item.get("rain") or {}).get("3h", 0.0))
            if dt_date == today_str:
                today_temps.append(temp)
                today_rains.append(rain)
            elif dt_date == tomorrow_str:
                tmrw_temps.append(temp)
                tmrw_rains.append(rain)

        today_tmax = max(today_temps) if today_temps else cur_temp
        today_tmin = min(today_temps) if today_temps else cur_temp
        today_tmean = sum(today_temps) / len(today_temps) if today_temps else cur_temp
        today_rain = round(sum(today_rains), 1)

        tmrw_tmax = max(tmrw_temps) if tmrw_temps else today_tmax
        tmrw_tmin = min(tmrw_temps) if tmrw_temps else today_tmin
        tmrw_rain = round(sum(tmrw_rains), 1)

        doy = date.today().timetuple().tm_yday
        tmrw_doy = doy + 1 if doy < 365 else 1

        today_et0 = _hargreaves_et0(today_tmax, today_tmin, lat, doy)
        tmrw_et0 = _hargreaves_et0(tmrw_tmax, tmrw_tmin, lat, tmrw_doy)

        result: dict = {
            "district": district_info["name"],
            "lat": lat,
            "lon": lon,
            "date": today_str,
            "source": "OpenWeatherMap",
            "pulled_at": datetime.now(timezone.utc).isoformat(),
            "today": {
                "tmax_c": round(today_tmax, 1),
                "tmin_c": round(today_tmin, 1),
                "tmean_c": round(today_tmean, 1),
                "humidity_pct": cur_humidity,
                "rain_mm": today_rain,
                "et0_mm": today_et0,
            },
            "tomorrow": {
                "tmax_c": round(tmrw_tmax, 1),
                "tmin_c": round(tmrw_tmin, 1),
                "rain_mm": tmrw_rain,
                "et0_mm": tmrw_et0,
            },
        }

        _owm_cache[district_n] = {"data": result, "_fetched_at": time.time()}
        return result

    except (KeyError, IndexError, TypeError, ValueError, OverflowError):
        return None


# ---------------------------------------------------------------------------
# Stage name helpers (rice-specific; generic fallback for other crops)
# ---------------------------------------------------------------------------

_RICE_STAGES = [
    {"from": 0,  "to": 0,   "name": "Transplanting",      "name_ta": "நடவு"},
    {"from": 1,  "to": 20,  "name": "Early Vegetative",    "name_ta": "ஆரம்ப வளர்ச்சி"},
    {"from": 21, "to": 40,  "name": "Tillering",           "name_ta": "துரவு"},
    {"from": 41, "to": 60,  "name": "Panicle Initiation",  "name_ta": "கதிர் தோற்றம்"},
    {"from": 61, "to": 80,  "name": "Flowering",           "name_ta": "பூக்கும் தருணம்"},
    {"from": 81, "to": 999, "name": "Grain Filling",       "name_ta": "மணி நிரவல்"},
]


def _get_display_stage(stage_days: int, crop: str) -> tuple[str, str]:
    """Return (name_en, name_ta) for the given stage_days and crop."""
    if crop.lower().strip() in ("rice", "paddy"):
        for s in _RICE_STAGES:
            if s["from"] <= stage_days <= s["to"]:
                return s["name"], s["name_ta"]
        return _RICE_STAGES[-1]["name"], _RICE_STAGES[-1]["name_ta"]
    # Generic fallback — use FAO stage name from Kc lookup
    _, fao_stage = get_kc(crop, stage_days)
    return fao_stage, fao_stage


# ---------------------------------------------------------------------------
# Fertilizer check
# ---------------------------------------------------------------------------

def _check_fertilizer_due(
    split_schedule: list[dict],
    stage_days: int,
    products: dict,
) -> tuple[bool, dict | None]:
    """Return (due, application_dict) — application_dict is the adapted split event if due."""
    for split in split_schedule:
        trigger_day = int(split.get("day", -999))
        if abs(stage_days - trigger_day) <= 1:
            adapted = adapt_split_schedule([split], products, stage_days)
            if adapted:
                return True, adapted[0]
            return True, None
    return False, None


# ---------------------------------------------------------------------------
# Main async compute function
# ---------------------------------------------------------------------------

async def compute_daily_recommendation(
    district: str,
    crop: str,
    stage_days: int,
    land_acres: float,
    irrigation_type: str,
    yesterday_rain_mm: float,
    lang: str,
) -> dict:
    """Compute the full daily recommendation for a farmer.

    Steps:
    1. Fetch OWM weather
    2. Compute ET0 from today's data using Hargreaves-Samani
    3. Compute ETc = ET0 * Kc
    4. Deficit = ETc - yesterday_rain_mm; irrigate if deficit >= 2.0
    5. Check fertilizer schedule
    6. Return structured dict

    Returns None in the 'weather' field if OWM is unavailable.
    """
    weather = await fetch_owm_weather(district)

    kc, growth_stage = get_kc(crop, stage_days)
    display_stage, display_stage_ta = _get_display_stage(stage_days, crop)
    today_str = date.today().isoformat()

    # ET0 from weather or fallback
    if weather:
        et0_mm = weather["today"]["et0_mm"]
        today_rain = weather["today"]["rain_mm"]
        humidity_pct = weather["today"]["humidity_pct"]
        temp_c = weather["today"]["tmean_c"]
    else:
        et0_mm = 5.0  # tropical TN average fallback
        today_rain = 0.0
        humidity_pct = 0.0
        temp_c = 0.0

    etc_mm = round(kc * et0_mm, 2)
    deficit_mm = max(0.0, round(etc_mm - yesterday_rain_mm, 2))

    if irrigation_type.lower().strip() == "rainfed":
        irrigation_recommended = "skip"
        irrigation_minutes = None
    elif yesterday_rain_mm >= 15.0:
        irrigation_recommended = "skip_rain"
        irrigation_minutes = None
    elif deficit_mm >= 2.0:
        irrigation_recommended = "irrigate"
        irrigation_minutes = round((deficit_mm / _PUMP_FLOW_RATE_MM_H) * 60)
    else:
        irrigation_recommended = "skip"
        irrigation_minutes = None

    # Fertilizer check
    fertilizer_due = False
    fertilizer_application: dict | None = None
    next_fertilizer: dict | None = None

    try:
        rec = lookup_recommendation(
            district=district,
            crop=crop,
            irrigation_type=irrigation_type,
            season="wet_season",  # default; caller can pass season if needed
        )
        products = npk_to_products(
            n_kg_ha=float(rec["n_kg_ha"]),
            p_kg_ha=float(rec["p_kg_ha"]),
            k_kg_ha=float(rec["k_kg_ha"]),
            land_acres=land_acres,
        )
        split_schedule = rec.get("split_schedule", [])
        fertilizer_due, fert_split = _check_fertilizer_due(split_schedule, stage_days, products)

        if fert_split:
            fertilizer_application = {
                "stage": fert_split.get("stage", ""),
                "stage_ta": fert_split.get("stage_ta", ""),
                "day": fert_split.get("day", stage_days),
                "items": [
                    {
                        "name": "Urea",
                        "bags": fert_split.get("urea_bags", 0),
                        "price_per_bag": products["prices_used"]["urea_per_bag"],
                        "total": round(fert_split.get("urea_bags", 0) * products["prices_used"]["urea_per_bag"]),
                    },
                    {
                        "name": "DAP",
                        "bags": fert_split.get("dap_bags", 0),
                        "price_per_bag": products["prices_used"]["dap_per_bag"],
                        "total": round(fert_split.get("dap_bags", 0) * products["prices_used"]["dap_per_bag"]),
                    },
                    {
                        "name": "MOP",
                        "bags": fert_split.get("mop_bags", 0),
                        "price_per_bag": products["prices_used"]["mop_per_bag"],
                        "total": round(fert_split.get("mop_bags", 0) * products["prices_used"]["mop_per_bag"]),
                    },
                ],
                "total_cost": products["cost"]["total_inr"],
                "instruction": f"Apply fertilizer at {fert_split.get('stage', '')} stage (Day {fert_split.get('day', stage_days)})",
                "instruction_ta": f"{fert_split.get('stage_ta', '')} நிலையில் (நாள் {fert_split.get('day', stage_days)}) உரம் இடவும்",
            }

        # Find next fertilizer event
        for split in split_schedule:
            if int(split.get("day", 0)) > stage_days + 1:
                next_fertilizer = {
                    "stage": split.get("stage", ""),
                    "stage_ta": split.get("stage_ta", ""),
                    "day": split.get("day", 0),
                }
                break

    except RecommendationNotFoundError:
        pass

    return {
        "district": district,
        "date": today_str,
        "weather": weather,
        "et0_mm": et0_mm,
        "kc_used": kc,
        "growth_stage": growth_stage,
        "display_stage": display_stage,
        "display_stage_ta": display_stage_ta,
        "stage_days": stage_days,
        "crop_water_need_mm": etc_mm,
        "yesterday_rain_mm": yesterday_rain_mm,
        "deficit_mm": deficit_mm,
        "irrigation_recommended": irrigation_recommended,
        "irrigation_minutes": irrigation_minutes,
        "fertilizer_due": fertilizer_due,
        "fertilizer_application": fertilizer_application,
        "next_fertilizer": next_fertilizer,
        "temp_c": temp_c,
        "humidity_pct": humidity_pct,
        "rain_mm": today_rain,
        "weather_source": "OpenWeatherMap" if weather else None,
    }
