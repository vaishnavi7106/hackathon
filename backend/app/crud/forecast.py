import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.market import Mandi, MandiPrice, PriceForecast
from haversine import haversine, Unit


async def get_nearest_mandis(
    db: AsyncSession, district: str, limit: int = 3
) -> list[Mandi]:
    """Return mandis in the given district first, then nearby ones."""
    result = await db.execute(
        select(Mandi)
        .where(Mandi.enam_linked == True)
        .order_by(
            (Mandi.district == district).desc()
        )
        .limit(limit * 2)
    )
    mandis = list(result.scalars().all())
    return mandis[:limit]


async def get_latest_price(
    db: AsyncSession, crop: str, mandi_id: str
) -> MandiPrice | None:
    result = await db.execute(
        select(MandiPrice)
        .where(MandiPrice.crop == crop, MandiPrice.mandi_id == mandi_id)
        .order_by(MandiPrice.price_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_price_forecast(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    crop: str,
    mandi_id: str | None,
    forecast_data: list,
    today_price: float | None,
    peak_price: float | None,
    peak_date: date | None,
    storage_type: str | None,
    storage_cost: float | None,
    net_gain: float | None,
    recommendation: str | None,
    model_version: str | None = None,
) -> PriceForecast:
    forecast = PriceForecast(
        farmer_id=farmer_id,
        crop=crop,
        mandi_id=mandi_id,
        forecast_data=forecast_data,
        today_price=today_price,
        peak_price=peak_price,
        peak_date=peak_date,
        storage_type=storage_type,
        storage_cost=storage_cost,
        net_gain=net_gain,
        recommendation=recommendation,
        model_version=model_version,
    )
    db.add(forecast)
    await db.flush()
    await db.refresh(forecast)
    return forecast


def calc_transport_cost(distance_km: float) -> float:
    """₹2.5 per km per quintal."""
    return round(distance_km * 2.5, 2)


def calc_storage_cost(storage_type: str, weeks: int) -> float:
    """Storage cost in ₹ per quintal for given weeks."""
    weekly_rates = {"home": 30.0, "warehouse": 55.0, "cold_storage": 120.0}
    rate = weekly_rates.get(storage_type, 30.0)
    return round(rate * weeks, 2)


def calc_mandi_distance(mandi: Mandi, district_lat: float, district_lon: float) -> float:
    if mandi.latitude is None or mandi.longitude is None:
        return 50.0  # default estimate
    return round(haversine((district_lat, district_lon), (float(mandi.latitude), float(mandi.longitude)), unit=Unit.KILOMETERS), 1)
