"""IMD (India Meteorological Department) weather API client.

Falls back to cached data when the API is unavailable.
"""

import httpx
import structlog

from app.config import get_settings
from app.services.redis_client import redis_get, redis_set

logger = structlog.get_logger()
settings = get_settings()

IMD_CACHE_TTL = 6 * 3600  # 6 hours


def _cache_key(district: str) -> str:
    return f"imd:forecast:{district.lower().replace(' ', '_')}"


# District → approximate lat/lon for IMD API lookups
DISTRICT_COORDS: dict[str, tuple[float, float]] = {
    "Chennai": (13.0827, 80.2707),
    "Coimbatore": (11.0168, 76.9558),
    "Madurai": (9.9252, 78.1198),
    "Tiruchirappalli": (10.7905, 78.7047),
    "Salem": (11.6643, 78.1460),
    "Tirunelveli": (8.7139, 77.7567),
    "Vellore": (12.9165, 79.1325),
    "Erode": (11.3410, 77.7172),
    "Thanjavur": (10.7870, 79.1378),
    "Tirupur": (11.1085, 77.3411),
    "Dharmapuri": (12.1277, 78.1580),
    "Dindigul": (10.3673, 77.9803),
    "Kancheepuram": (12.8333, 79.7167),
    "Tiruvannamalai": (12.2253, 79.0747),
    "Cuddalore": (11.7480, 79.7714),
    "Nagapattinam": (10.7672, 79.8449),
    "Pudukkottai": (10.3833, 78.8001),
    "Ramanathapuram": (9.3762, 78.8302),
    "Sivaganga": (9.8447, 78.4800),
    "Virudhunagar": (9.5878, 77.9562),
}


async def get_district_forecast(district: str) -> dict:
    cache_key = _cache_key(district)
    cached = await redis_get(cache_key)
    if cached:
        return cached

    coords = DISTRICT_COORDS.get(district, (11.0, 77.0))
    data = await _fetch_imd_forecast(district, coords)
    await redis_set(cache_key, data, ttl_seconds=IMD_CACHE_TTL)
    return data


async def _fetch_imd_forecast(district: str, coords: tuple[float, float]) -> dict:
    """Fetch 5-day forecast from IMD open data API.

    Uses Open-Meteo as a reliable fallback for hackathon (no API key required).
    """
    lat, lon = coords
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max"
        f"&timezone=Asia%2FKolkata&forecast_days=5"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = resp.json()

        daily = raw.get("daily", {})
        days = []
        dates = daily.get("time", [])
        for i, d in enumerate(dates):
            rain = daily.get("precipitation_sum", [0] * len(dates))[i] or 0.0
            days.append(
                {
                    "date": d,
                    "rain_mm": round(rain, 1),
                    "temp_max": daily.get("temperature_2m_max", [None] * len(dates))[i],
                    "temp_min": daily.get("temperature_2m_min", [None] * len(dates))[i],
                    "humidity_max": daily.get("relative_humidity_2m_max", [None] * len(dates))[i],
                    "rain_expected": rain > 5.0,
                }
            )

        return {"district": district, "source": "open-meteo", "days": days}

    except Exception as exc:
        logger.warning("imd_fetch_failed", district=district, error=str(exc))
        return {"district": district, "source": "unavailable", "days": []}
