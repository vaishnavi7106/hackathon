"""e-NAM mandi price client.

Fetches real-time modal prices from e-NAM API and caches in Redis.
Falls back to latest DB record when API is unavailable.
"""

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models.market import MandiPrice
from app.services.redis_client import redis_get, redis_set

logger = structlog.get_logger()
settings = get_settings()

ENAM_CACHE_TTL = 24 * 3600  # 24 hours


def _price_key(crop: str, mandi_id: str) -> str:
    return f"enam:price:{crop.lower()}:{mandi_id.lower()}"


async def get_live_price(crop: str, mandi_id: str, db: AsyncSession) -> dict | None:
    cache_key = _price_key(crop, mandi_id)
    cached = await redis_get(cache_key)
    if cached:
        return cached

    price_data = await _fetch_enam_price(crop, mandi_id)
    if price_data:
        await redis_set(cache_key, price_data, ttl_seconds=ENAM_CACHE_TTL)
        return price_data

    # Fallback to latest DB record
    return await _db_fallback_price(crop, mandi_id, db)


async def _fetch_enam_price(crop: str, mandi_id: str) -> dict | None:
    """Fetch modal price from e-NAM API.

    e-NAM provides a data portal at enam.gov.in/web/. For hackathon,
    we use the AGMARKNET public API which requires no key.
    """
    if not settings.enam_api_key:
        # Use AGMARKNET public endpoint
        return await _fetch_agmarknet_price(crop, mandi_id)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://enam.gov.in/web/Ajax_ctrl/trade_data_list",
                params={"language": "en", "stateName": "Tamil Nadu", "commodity": crop},
                headers={"Authorization": f"Bearer {settings.enam_api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            # Parse e-NAM response format
            for record in data.get("data", []):
                if record.get("mandiId") == mandi_id:
                    return {
                        "mandi_id": mandi_id,
                        "crop": crop,
                        "modal_price": float(record.get("modalPrice", 0)),
                        "min_price": float(record.get("minPrice", 0)),
                        "max_price": float(record.get("maxPrice", 0)),
                        "source": "enam",
                    }
    except Exception as exc:
        logger.warning("enam_fetch_failed", crop=crop, mandi_id=mandi_id, error=str(exc))

    return None


async def _fetch_agmarknet_price(crop: str, mandi_id: str) -> dict | None:
    """Public AGMARKNET price lookup — no API key required."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://agmarknet.gov.in/SearchCmmMkt.aspx",
                params={"Tx_Commodity": crop, "Tx_State": "Tamil Nadu", "Tx_District": "0"},
                timeout=15.0,
            )
            # AGMARKNET returns HTML — for hackathon use DB seeded data
            # Real integration needs scraping or direct DB access via data.gov.in
            return None
    except Exception:
        return None


async def _db_fallback_price(crop: str, mandi_id: str, db: AsyncSession) -> dict | None:
    result = await db.execute(
        select(MandiPrice)
        .where(MandiPrice.crop == crop, MandiPrice.mandi_id == mandi_id)
        .order_by(MandiPrice.price_date.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None
    return {
        "mandi_id": mandi_id,
        "crop": crop,
        "modal_price": float(record.modal_price),
        "min_price": float(record.min_price) if record.min_price else None,
        "max_price": float(record.max_price) if record.max_price else None,
        "price_date": str(record.price_date),
        "source": "db_fallback",
    }
