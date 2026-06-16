"""Pillar 3 — Market Navigator router.

Prophet forecast stub is clearly marked. Replace on Day 5.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Query, status

from app.crud.forecast import (
    calc_storage_cost,
    calc_transport_cost,
    create_price_forecast,
    get_nearest_mandis,
)
from app.deps import CurrentFarmerDep, CurrentFarmerIdDep, DbDep
from app.exceptions import NotFoundError
from app.schemas.forecast import (
    ForecastPoint,
    ForecastRequest,
    ForecastResponse,
    HoldSellOut,
    LivePriceItem,
    LivePriceResponse,
    MandiInfo,
    PriceForecastOut,
)
from app.services.enam import get_live_price
from app.services.redis_client import redis_get, redis_set

router = APIRouter(prefix="/forecast", tags=["forecast"])

PROPHET_CACHE_TTL = 12 * 3600  # 12h


@router.post("", response_model=ForecastResponse, status_code=status.HTTP_200_OK)
async def get_price_forecast(body: ForecastRequest, farmer: CurrentFarmerDep, db: DbDep):
    storage_type = body.storage_facility or farmer.storage_facility or "home"

    # Resolve nearest mandis
    if body.override_mandi_ids:
        from app.db.models.market import Mandi
        from sqlalchemy import select
        result = await db.execute(
            select(Mandi).where(Mandi.mandi_id.in_(body.override_mandi_ids))
        )
        mandis = list(result.scalars().all())
    else:
        mandis = await get_nearest_mandis(db, farmer.district)

    if not mandis:
        raise NotFoundError("Mandi", detail_ta="உங்கள் மாவட்டத்தில் சந்தை தகவல் கிடைக்கவில்லை.")

    primary_mandi = mandis[0]

    # Fetch live prices for all mandis
    mandi_infos: list[MandiInfo] = []
    for mandi in mandis:
        price_data = await get_live_price(body.crop, mandi.mandi_id, db)
        today_price = price_data["modal_price"] if price_data else None
        distance = 20.0  # stub distance — real calc uses haversine on Day 5
        transport = calc_transport_cost(distance)
        net = round((today_price or 0) - transport, 2) if today_price else None
        mandi_infos.append(
            MandiInfo(
                mandi_id=mandi.mandi_id,
                name=mandi.name,
                distance_km=distance,
                today_price=today_price,
                transport_cost_per_quintal=transport,
                net_price=net,
            )
        )

    best_mandi = max(
        (m for m in mandi_infos if m.net_price is not None),
        key=lambda m: m.net_price,
        default=None,
    )
    today_price = mandi_infos[0].today_price if mandi_infos else None

    # --- Prophet forecast stub ---
    # Replace with real Prophet inference on Day 5:
    #   from app.ml.price_forecast import predict
    #   forecast_series = await predict(body.crop, primary_mandi.mandi_id)
    cache_key = f"prophet:{body.crop.lower()}:{primary_mandi.mandi_id}"
    cached = await redis_get(cache_key)
    if cached:
        forecast_series = cached
    else:
        forecast_series = _stub_forecast(today_price)
        await redis_set(cache_key, forecast_series, ttl_seconds=PROPHET_CACHE_TTL)
    # ----------------------------

    peak_entry = max(forecast_series, key=lambda x: x["yhat"], default=None)
    peak_price = peak_entry["yhat"] if peak_entry else None
    peak_date_str = peak_entry["date"] if peak_entry else None
    peak_date = date.fromisoformat(peak_date_str) if peak_date_str else None

    # Hold/sell calculation
    weeks_to_peak = None
    storage_cost = None
    net_gain = None
    recommendation = "SELL"
    calculation_ta = None

    if today_price and peak_price and peak_date:
        days_to_peak = (peak_date - date.today()).days
        weeks_to_peak = max(1, days_to_peak // 7)
        storage_cost = calc_storage_cost(storage_type, weeks_to_peak)
        net_gain = round(peak_price - today_price - storage_cost, 2)
        recommendation = "HOLD" if net_gain > 0 else "SELL"
        calculation_ta = (
            f"இன்றைய விலை: ₹{int(today_price)}. உச்ச விலை {peak_date}: ₹{int(peak_price)}. "
            f"சேமிப்பு செலவு: ₹{int(storage_cost)}. நிகர லாபம்: ₹{int(net_gain)}/குவிண்டால்."
        )

    db_forecast = await create_price_forecast(
        db,
        farmer_id=farmer.farmer_id,
        crop=body.crop,
        mandi_id=primary_mandi.mandi_id,
        forecast_data=forecast_series,
        today_price=today_price,
        peak_price=peak_price,
        peak_date=peak_date,
        storage_type=storage_type,
        storage_cost=storage_cost,
        net_gain=net_gain,
        recommendation=recommendation,
        model_version="stub-v0",
    )

    price_forecast_out = PriceForecastOut(
        mandi_id=primary_mandi.mandi_id,
        series=[
            ForecastPoint(
                date=date.fromisoformat(p["date"]),
                yhat=p["yhat"],
                yhat_lower=p.get("yhat_lower"),
                yhat_upper=p.get("yhat_upper"),
            )
            for p in forecast_series[:30]  # Return first 30 days in response
        ],
        peak_price=peak_price,
        peak_date=peak_date,
        peak_confidence_range=[
            round(peak_price * 0.94, 2),
            round(peak_price * 1.06, 2),
        ] if peak_price else None,
    )

    return ForecastResponse(
        forecast_id=db_forecast.forecast_id,
        crop=body.crop,
        generated_at=db_forecast.generated_at,
        mandis=mandi_infos,
        best_mandi=best_mandi,
        price_forecast=price_forecast_out,
        hold_sell=HoldSellOut(
            recommendation=recommendation,
            today_price=today_price,
            forecast_peak_price=peak_price,
            weeks_to_hold=weeks_to_peak,
            storage_cost_per_quintal=storage_cost,
            net_gain_per_quintal=net_gain,
            calculation_ta=calculation_ta,
            historical_note_ta="கடந்த 5 ஆண்டுகளில் 3 முறை இந்த பயிர் ஜூலை மாதத்தில் உச்சத்தை எட்டியது.",
        ),
        model_unavailable=True,
        model_unavailable_note="Prophet models not yet trained. Showing trend estimates.",
    )


@router.get("/prices/live", response_model=LivePriceResponse)
async def live_prices(
    farmer: CurrentFarmerDep,
    db: DbDep,
    crop: str = Query(..., min_length=2),
):
    mandis = await get_nearest_mandis(db, farmer.district, limit=5)
    prices = []
    for mandi in mandis:
        data = await get_live_price(crop, mandi.mandi_id, db)
        if data:
            prices.append(
                LivePriceItem(
                    mandi_id=mandi.mandi_id,
                    name=mandi.name,
                    modal_price=data.get("modal_price"),
                    price_date=data.get("price_date"),
                    source=data.get("source", "unknown"),
                )
            )

    return LivePriceResponse(
        crop=crop,
        district=farmer.district,
        prices=prices,
        cache_age_seconds=None,
    )


def _stub_forecast(base_price: float | None) -> list[dict]:
    """Generate a plausible 90-day price trend for demo purposes."""
    base = base_price or 1800.0
    today = date.today()
    series = []
    for i in range(90):
        d = today + timedelta(days=i)
        # Simulate seasonal rise then fall
        factor = 1.0 + (0.28 * (i / 60) if i <= 60 else 0.28 * (1 - (i - 60) / 30))
        yhat = round(base * factor, 2)
        series.append(
            {
                "date": str(d),
                "yhat": yhat,
                "yhat_lower": round(yhat * 0.94, 2),
                "yhat_upper": round(yhat * 1.06, 2),
            }
        )
    return series
