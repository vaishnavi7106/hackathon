"""FAO-56 Irrigation Scheduler — Open-Meteo weather + Kc-based crop water scheduling.

Uses Open-Meteo free API (no key needed) for 7-day ET0 forecasts.
No Hargreaves-Samani — Open-Meteo provides FAO-56 Penman-Monteith ET0 directly.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import httpx

from .data.load import DISTRICT_INDEX, KC_STAGES

# Module-level 6-hour weather cache keyed by district (lowercase)
_weather_cache: dict[str, dict] = {}
_CACHE_TTL_SECONDS = 6 * 3600


def get_kc(crop: str, stage_days: int) -> tuple[float, str]:
    """Return (kc_value, stage_name) for the given crop and days-after-sowing.

    Walks through cumulative stage durations to find the active growth stage.
    Returns the late-stage Kc if stage_days exceeds total crop duration.
    """
    crop_n = crop.lower().strip()
    stages = KC_STAGES.get(crop_n)
    if not stages:
        return 1.0, "mid"  # safe default for unknown crops

    cumulative = 0
    for stage in stages:
        cumulative += stage["duration_days"]
        if stage_days <= cumulative:
            return stage["kc_value"], stage["stage"]

    return stages[-1]["kc_value"], stages[-1]["stage"]


async def fetch_weather(district: str) -> dict | None:
    """Fetch 7-day FAO-56 ET0 forecast from Open-Meteo for the given district.

    Returns None on any network/parse failure (caller handles graceful degradation).
    Results cached for 6 hours per district.
    """
    district_n = district.lower().strip()
    cached = _weather_cache.get(district_n)
    if cached and (time.time() - cached["_fetched_at"]) < _CACHE_TTL_SECONDS:
        return cached["data"]

    district_info = DISTRICT_INDEX.get(district_n)
    if district_info is None:
        return None

    lat = district_info["lat"]
    lon = district_info["lon"]

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":  lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration",
        "forecast_days": 7,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception:
        return None

    try:
        daily = raw["daily"]
        dates      = daily["time"]
        tmax_list  = daily["temperature_2m_max"]
        tmin_list  = daily["temperature_2m_min"]
        rain_list  = daily["precipitation_sum"]
        et0_list   = daily["et0_fao_evapotranspiration"]

        days = []
        for i, date_str in enumerate(dates):
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            days.append({
                "date":        date_str,
                "day_of_week": dt.strftime("%A"),
                "tmax_c":      round(float(tmax_list[i] or 0), 1),
                "tmin_c":      round(float(tmin_list[i] or 0), 1),
                "rainfall_mm": round(float(rain_list[i]  or 0), 1),
                "et0_mm":      round(float(et0_list[i]   or 0), 2),
            })

        result = {
            "district":      district_info["name"],
            "forecast_date": dates[0] if dates else datetime.now(timezone.utc).date().isoformat(),
            "source":        "Open-Meteo ECMWF/IFS (FAO-56 Penman-Monteith ET0)",
            "days":          days,
        }

        _weather_cache[district_n] = {"data": result, "_fetched_at": time.time()}
        return result

    except (KeyError, IndexError, TypeError, ValueError):
        return None


def build_irrigation_schedule(
    crop: str,
    stage_days: int,
    irrigation_type: str,
    weather: dict,
    land_acres: float = 1.0,
) -> dict:
    """Build a 7-day irrigation schedule based on FAO-56 Kc × ET0.

    Args:
        crop:            Crop name (lowercase).
        stage_days:      Days since sowing/transplanting.
        irrigation_type: "borewell" | "canal" | "tank" | "rainfed" | "irrigated".
        weather:         Parsed weather dict from fetch_weather().
        land_acres:      Farm area (for borewell duration calculation).

    Returns:
        Dict with weekly_schedule, kc_used, growth_stage, and summary counts.
    """
    kc, growth_stage = get_kc(crop, stage_days)
    irr_type = irrigation_type.lower().strip()

    schedule = []
    total_irrigate = 0
    total_skip = 0

    for day_data in weather.get("days", []):
        et0        = day_data["et0_mm"]
        rainfall   = day_data["rainfall_mm"]
        etc_mm     = round(kc * et0, 2)
        deficit    = max(0.0, etc_mm - rainfall)
        net_deficit = round(deficit, 2)

        if irr_type == "rainfed":
            action   = "advisory"
            duration = None
            note     = f"Rainfed crop — ETc {etc_mm}mm, rain {rainfall}mm"
        elif rainfall > 15.0:
            action      = "skip_rain"
            duration    = None
            total_skip += 1
            note        = f"Heavy rain {rainfall}mm — skip irrigation"
        elif net_deficit <= 3.0:
            action      = "skip_sufficient"
            duration    = None
            total_skip += 1
            note        = f"Soil moisture sufficient — deficit only {net_deficit}mm"
        else:
            action         = "irrigate"
            total_irrigate += 1
            if irr_type == "borewell":
                raw_min  = net_deficit * 40.0 * land_acres
                duration = round(min(raw_min, 240.0), 0)  # cap at 240 min/day
                note     = f"Irrigate {int(duration)} min — deficit {net_deficit}mm"
            else:
                duration = None
                note     = f"Irrigate — deficit {net_deficit}mm (gravity/advisory)"

        schedule.append({
            "date":           day_data["date"],
            "day_of_week":    day_data["day_of_week"],
            "action":         action,
            "duration_min":   duration,
            "rainfall_mm":    rainfall,
            "et0_mm":         et0,
            "etc_mm":         etc_mm,
            "net_deficit_mm": net_deficit,
            "note":           note,
        })

    return {
        "weekly_schedule":      schedule,
        "kc_used":              kc,
        "growth_stage":         growth_stage,
        "total_irrigation_days": total_irrigate,
        "total_skip_days":      total_skip,
        "weather_source":       weather.get("source", "Open-Meteo"),
    }
