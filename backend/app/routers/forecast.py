"""Pillar 3 — Market Navigator router.

POST /forecast uses LightGBM models trained on AGMARKNET Tamil Nadu data.
Models are loaded via predict.py (40 models, 10 crops × 4 horizons).
"""

import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, status

from app.crud.forecast import (
    calc_storage_cost,
    calc_transport_cost,
    create_price_forecast,
    get_nearest_mandis,
)
from app.deps import CurrentFarmerDep, DbDep
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

# Make predict.py importable without installing it as a package
_PIPELINE_DIR = str(Path(__file__).parent.parent.parent / "pillar3" / "pipeline")
if _PIPELINE_DIR not in sys.path:
    sys.path.insert(0, _PIPELINE_DIR)

router = APIRouter(prefix="/forecast", tags=["forecast"])

FORECAST_CACHE_TTL = 12 * 3600  # 12h

_LIVE_FEATURES_CSV = (
    Path(__file__).parent.parent.parent / "pillar3_data" / "live" / "live_features.csv"
)


# Mirrors predict.py's _DISTRICT_ALIASES — AGMARKNET uses "Thiru-" consistently.
_DISTRICT_ALIASES: dict[str, str] = {
    "tiruvarur":       "Thiruvarur",
    "tirupur":         "Thirupur",
    "tiruchirappalli": "Thiruchirappalli",
    "tirunelveli":     "Thirunelveli",
    "tiruvannamalai":  "Thiruvannamalai",
    "tirupathur":      "Thirupathur",
    "tiruvallur":      "Thiruvellore",
    "thiruvallur":     "Thiruvellore",
}


def _canonical_district(district: str) -> str:
    """Resolve alternate district spellings to the AGMARKNET canonical form."""
    return _DISTRICT_ALIASES.get(district.lower(), district)


def _price_from_live_features(crop: str, district: str) -> float | None:
    """Read today_price from live_features.csv when the live API / DB has no data."""
    if not _LIVE_FEATURES_CSV.exists():
        return None
    try:
        df = pd.read_csv(_LIVE_FEATURES_CSV, usecols=["District", "Commodity", "Modal_Price"])
        canonical = _canonical_district(district)
        mask = (
            df["Commodity"].str.lower() == crop.lower()
        ) & (
            df["District"].str.lower() == canonical.lower()
        )
        row = df[mask]
        if row.empty:
            return None
        return float(row["Modal_Price"].iloc[0])
    except Exception:
        return None


def _horizons_to_series(
    today_price: float | None,
    predictions: dict[str, float | None],
) -> list[dict]:
    """Convert 4-horizon point predictions to a linearly-interpolated time series.

    Anchor points: today (0d), 1d, 3d, 7d, 14d.
    Remaining days are filled via linear interpolation between anchors.
    """
    base = today_price or 0.0
    anchors: list[tuple[int, float]] = [(0, base)]
    horizon_map = {"1d": 1, "3d": 3, "7d": 7, "14d": 14}
    for key, day in horizon_map.items():
        val = predictions.get(key)
        if val is not None:
            anchors.append((day, val))

    if len(anchors) == 1:
        # No predictions available — flat series at today's price
        anchors += [(14, base)]

    today = date.today()
    series: list[dict] = []

    for i in range(len(anchors) - 1):
        d0, p0 = anchors[i]
        d1, p1 = anchors[i + 1]
        for d in range(d0, d1):
            t = (d - d0) / (d1 - d0)
            yhat = round(p0 + t * (p1 - p0), 2)
            series.append({
                "date": str(today + timedelta(days=d)),
                "yhat": yhat,
                "yhat_lower": round(yhat * 0.94, 2),
                "yhat_upper": round(yhat * 1.06, 2),
            })

    # Include the last anchor
    d_last, p_last = anchors[-1]
    series.append({
        "date": str(today + timedelta(days=d_last)),
        "yhat": round(p_last, 2),
        "yhat_lower": round(p_last * 0.94, 2),
        "yhat_upper": round(p_last * 1.06, 2),
    })

    return series


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
        # Fallback: pull today_price from live_features.csv (anchored to latest
        # available AGMARKNET date) when the live API and mandi_prices DB are empty.
        if today_price is None:
            today_price = _price_from_live_features(body.crop, mandi.district)
        distance = 20.0
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

    # --- LightGBM forecast ---
    cache_key = f"lgbm:{body.crop.lower()}:{farmer.district.lower()}"
    forecast_series: list[dict] | None = await redis_get(cache_key)
    predictions: dict[str, float | None] = {}
    model_unavailable = False
    model_note = None

    if not forecast_series:
        try:
            from predict import predict as lgbm_predict  # type: ignore[import]
            result = lgbm_predict(district=farmer.district, commodity=body.crop)
            if "error" in result:
                model_unavailable = True
                model_note = result["error"]
                forecast_series = _horizons_to_series(today_price, {})
            else:
                predictions = result.get("predictions", {})
                forecast_series = _horizons_to_series(today_price, predictions)
                await redis_set(cache_key, forecast_series, ttl_seconds=FORECAST_CACHE_TTL)
        except Exception as exc:
            import structlog
            structlog.get_logger().warning("lgbm_predict_failed", error=str(exc)[:300])
            model_unavailable = True
            model_note = f"Forecast model unavailable: {str(exc)[:200]}"
            forecast_series = _horizons_to_series(today_price, {})
    # -------------------------

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
        model_version="lgbm-v1" if not model_unavailable else "stub-v0",
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
            for p in forecast_series
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
        model_unavailable=model_unavailable,
        model_unavailable_note=model_note,
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
