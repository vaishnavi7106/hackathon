"""Pillar 2 — Soil & Water Optimizer FastAPI router.

Mount at /v2 in main.py:
    from pillar2.router import router as pillar2_router
    app.include_router(pillar2_router, prefix="/v2")

Endpoints:
    POST /v2/soil/prescribe   — full NPK + irrigation prescription
    GET  /v2/soil/crops       — supported crops list
    GET  /v2/soil/districts   — all 38 TN districts
    GET  /v2/soil/weather/{district} — 7-day forecast (cached 6h)
    GET  /v2/soil/prices      — current fertilizer prices
    GET  /v2/soil/daily/{district} — daily recommendation (OWM + Hargreaves ET0)
    POST /v2/soil/daily-record — upsert today's daily record (auth required)
    GET  /v2/soil/daily-records — last N daily records for authenticated farmer
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from sqlalchemy import select, desc
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.deps import CurrentFarmerDep, DbDep
from app.crud.farmer import get_farmer_with_latest_soil
from app.db.models.daily_record import FarmDailyRecord

from .calendar import build_joint_calendar
from .daily import compute_daily_recommendation, fetch_owm_weather
from .data.load import DISTRICT_INDEX, PRICES, RECOMMENDATIONS, ZONES
from .engine import RecommendationNotFoundError, apply_symptom_adjustments, lookup_recommendation
from .explainer import generate_explanation
from .irrigation import build_irrigation_schedule, fetch_weather
from .products import adapt_split_schedule, npk_to_products

router = APIRouter(tags=["Soil Optimizer — Pillar 2"])

_DISCLAIMER = (
    "Fertilizer recommendations are sourced from TNAU Crop Production Guide 2020 "
    "and represent blanket district recommendations. Actual requirements may vary "
    "based on soil tests. Consult your local Agriculture Extension Officer for verification."
)

_DISCLAIMER_TA = (
    "உர பரிந்துரைகள் TNAU பயிர் உற்பத்தி வழிகாட்டி 2020-ல் இருந்து எடுக்கப்பட்டது. "
    "உண்மையான தேவை மண் பரிசோதனை அடிப்படையில் மாறுபடலாம். "
    "உங்கள் மாவட்ட விவசாய விரிவாக்க அலுவலரை சந்திக்கவும்."
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PrescriptionRequest(BaseModel):
    district: str
    crop: str
    season: str = Field(
        description="kharif | rabi | summer | dry_season | wet_season | annual"
    )
    land_acres: float = Field(gt=0)
    irrigation_type: str = Field(
        description="irrigated | rainfed | borewell | canal | tank"
    )
    crop_stage_days: int = Field(ge=0, le=250)
    soil_color: str | None = None
    symptoms: list[str] | None = Field(default_factory=list)
    shc_data: dict | None = None
    planting_date: str | None = None
    lang: str = "ta"


# ---------------------------------------------------------------------------
# POST /v2/soil/prescribe
# ---------------------------------------------------------------------------

@router.post("/soil/prescribe")
async def prescribe(req: PrescriptionRequest) -> Any:
    # 1. Lookup base recommendation
    try:
        rec = lookup_recommendation(
            district=req.district,
            crop=req.crop,
            irrigation_type=req.irrigation_type,
            season=req.season,
        )
    except RecommendationNotFoundError as exc:
        msg = str(exc)
        if "District" in msg or "not found" in msg.lower():
            return JSONResponse(
                status_code=404,
                content={
                    "error": "district_not_found",
                    "detail": msg,
                    "supported_districts": sorted(DISTRICT_INDEX.keys()),
                },
            )
        supported_crops = sorted({r["crop"] for r in RECOMMENDATIONS})
        return JSONResponse(
            status_code=404,
            content={
                "error": "crop_not_supported",
                "detail": msg,
                "supported_crops": supported_crops,
            },
        )

    zone_info = rec.get("_zone_info", {})
    district_info = rec.get("_district_info", {})

    # 2. Apply symptom / SHC adjustments
    rec_adj = apply_symptom_adjustments(rec, req.symptoms or [], req.shc_data)

    # 3. Compute products (bags + cost)
    products = npk_to_products(
        n_kg_ha=rec_adj["n_adjusted"],
        p_kg_ha=rec_adj["p_adjusted"],
        k_kg_ha=rec_adj["k_adjusted"],
        land_acres=req.land_acres,
    )

    # 4. Adapt split schedule to farm quantities
    raw_split = rec.get("split_schedule", [])
    adapted_split = adapt_split_schedule(raw_split, products, req.crop_stage_days)

    # 5. Fetch weather & build irrigation schedule
    weather_data = await fetch_weather(req.district)
    irrigation_out = None
    weather_note = None

    if weather_data:
        irrigation_out = build_irrigation_schedule(
            crop=req.crop,
            stage_days=req.crop_stage_days,
            irrigation_type=req.irrigation_type,
            weather=weather_data,
            land_acres=req.land_acres,
        )
    else:
        weather_note = (
            "Weather data temporarily unavailable — irrigation schedule not generated. "
            "Please retry or check manually via GET /v2/soil/weather/{district}."
        )

    # 6. Build joint calendar
    joint_calendar = build_joint_calendar(
        split_schedule=adapted_split,
        irrigation_schedule=irrigation_out,
        planting_date=req.planting_date,
        stage_days=req.crop_stage_days,
    )

    # 7. Generate LLM explanation
    partial_prescription: dict = {
        "crop":      req.crop,
        "district":  req.district,
        "season":    req.season,
        "land_acres": req.land_acres,
        "zone_id":   rec.get("zone_id"),
        "zone_name": zone_info.get("name", ""),
        "products":  {
            "urea_bags": products["total_for_farm"]["urea_bags"],
            "dap_bags":  products["total_for_farm"]["dap_bags"],
            "mop_bags":  products["total_for_farm"]["mop_bags"],
            "cost":      products["cost"],
        },
        "recommendation": rec_adj,
        "split_schedule":  adapted_split,
        "irrigation":      irrigation_out,
    }
    explanation = await generate_explanation(partial_prescription, req.lang)

    # 8. Compose final response
    response: dict[str, Any] = {
        "prescription_id": str(uuid.uuid4()),
        "district":        req.district,
        "crop":            req.crop,
        "season":          req.season,
        "land_acres":      req.land_acres,
        "zone_id":         int(rec.get("zone_id", 0)),
        "zone_name":       zone_info.get("name", ""),
        "zone_name_ta":    zone_info.get("name_ta", ""),
        "recommendation": {
            "rec_id":              rec_adj.get("rec_id", ""),
            "n_kg_ha":             rec_adj["n_kg_ha"],
            "p_kg_ha":             rec_adj["p_kg_ha"],
            "k_kg_ha":             rec_adj["k_kg_ha"],
            "n_adjusted":          rec_adj["n_adjusted"],
            "p_adjusted":          rec_adj["p_adjusted"],
            "k_adjusted":          rec_adj["k_adjusted"],
            "adjustments_applied": rec_adj["adjustments_applied"],
            "confidence_level":    rec_adj["confidence_level"],
            "source_ref":          rec_adj.get("source_ref", ""),
            "source_url":          rec_adj.get("source_url", ""),
        },
        "products": {
            "urea_bags": products["total_for_farm"]["urea_bags"],
            "dap_bags":  products["total_for_farm"]["dap_bags"],
            "mop_bags":  products["total_for_farm"]["mop_bags"],
            "urea_kg":   products["total_for_farm"]["urea_kg"],
            "dap_kg":    products["total_for_farm"]["dap_kg"],
            "mop_kg":    products["total_for_farm"]["mop_kg"],
            "cost":      products["cost"],
            "prices_used": products["prices_used"],
        },
        "split_schedule":  adapted_split,
        "irrigation":      irrigation_out,
        "joint_calendar":  joint_calendar,
        "explanation":     explanation,
        "disclaimer":      _DISCLAIMER_TA if req.lang == "ta" else _DISCLAIMER,
        "generated_at":    datetime.now(timezone.utc).isoformat(),
    }

    if weather_note:
        response["weather_note"] = weather_note

    return response


# ---------------------------------------------------------------------------
# GET /v2/soil/my-prescription  — profile-driven, no wizard input
# ---------------------------------------------------------------------------

@router.get("/soil/my-prescription")
async def my_prescription(
    farmer: CurrentFarmerDep,
    db: DbDep,
    crop_stage_days: int = 0,
    symptoms: str = "",
    lang: str = "ta",
) -> Any:
    """Generate a prescription using the farmer's saved profile. No wizard needed.

    Query params:
      crop_stage_days — days since transplanting (default 0)
      symptoms        — comma-separated, e.g. "n_deficiency,p_deficiency"
      lang            — "ta" | "en"
    """
    farmer_full = await get_farmer_with_latest_soil(db, farmer.farmer_id)

    missing: list[str] = []
    if not farmer_full.primary_crop:
        missing.append("primary_crop")
    if not farmer_full.land_size_acres:
        missing.append("land_size_acres")
    if not farmer_full.irrigation_type:
        missing.append("irrigation_type")
    if not farmer_full.season:
        missing.append("season")

    if missing:
        return JSONResponse(
            status_code=422,
            content={
                "error": "profile_incomplete",
                "missing_fields": missing,
                "detail": (
                    "Your farmer profile is missing fields required for a prescription. "
                    "Please complete your profile and try again."
                ),
                "detail_ta": (
                    "உங்கள் விவசாயி சுயவிவரத்தில் சில தகவல்கள் இல்லை. "
                    "சுயவிவரத்தை நிரப்பி மீண்டும் முயற்சிக்கவும்."
                ),
            },
        )

    symptom_list = [s.strip() for s in symptoms.split(",") if s.strip()] if symptoms else []

    req = PrescriptionRequest(
        district=farmer_full.district,
        crop=farmer_full.primary_crop,
        season=farmer_full.season,
        land_acres=float(farmer_full.land_size_acres),
        irrigation_type=farmer_full.irrigation_type,
        crop_stage_days=crop_stage_days,
        symptoms=symptom_list,
        lang=lang,
    )
    return await prescribe(req)


# ---------------------------------------------------------------------------
# GET /v2/soil/crops
# ---------------------------------------------------------------------------

@router.get("/soil/crops")
def list_crops() -> dict:
    seen: dict[str, dict] = {}
    for rec in RECOMMENDATIONS:
        crop = rec["crop"]
        if crop not in seen:
            seen[crop] = {
                "crop":    crop,
                "crop_ta": rec.get("crop_ta", crop),
            }
    return {"crops": list(seen.values())}


# ---------------------------------------------------------------------------
# GET /v2/soil/districts
# ---------------------------------------------------------------------------

@router.get("/soil/districts")
def list_districts() -> dict:
    enriched = []
    for d in sorted(
        [v for v in DISTRICT_INDEX.values()],
        key=lambda x: x["name"],
    ):
        zone = ZONES.get(int(d["zone_id"]), {})
        enriched.append({
            "id":        d["id"],
            "name":      d["name"],
            "name_ta":   d.get("name_ta", d["name"]),
            "zone_id":   d["zone_id"],
            "zone_name": zone.get("name", ""),
            "lat":       d["lat"],
            "lon":       d["lon"],
        })
    return {"districts": enriched, "total": len(enriched)}


# ---------------------------------------------------------------------------
# GET /v2/soil/weather/{district}
# ---------------------------------------------------------------------------

@router.get("/soil/weather/{district}")
async def get_weather(district: str) -> Any:
    data = await fetch_weather(district)
    if data is None:
        return JSONResponse(
            status_code=503,
            content={
                "error": "weather_unavailable",
                "detail": f"Could not fetch weather for '{district}'. "
                          "Open-Meteo may be temporarily unavailable.",
            },
        )
    return data


# ---------------------------------------------------------------------------
# GET /v2/soil/prices
# ---------------------------------------------------------------------------

@router.get("/soil/prices")
def get_prices() -> dict:
    return {"prices": PRICES}


# ---------------------------------------------------------------------------
# GET /v2/soil/daily/{district}
# ---------------------------------------------------------------------------

@router.get("/soil/daily/{district}")
async def get_daily(
    district: str,
    crop: str = "rice",
    stage_days: int = 0,
    land_acres: float = 1.0,
    irrigation_type: str = "canal",
    yesterday_rain_mm: float = 0.0,
    lang: str = "ta",
) -> Any:
    """Daily recommendation: ET0, irrigation need, fertilizer due check."""
    data = await compute_daily_recommendation(
        district=district,
        crop=crop,
        stage_days=stage_days,
        land_acres=land_acres,
        irrigation_type=irrigation_type,
        yesterday_rain_mm=yesterday_rain_mm,
        lang=lang,
    )
    if data.get("weather") is None:
        return JSONResponse(
            status_code=503,
            content={
                "error": "weather_unavailable",
                "detail": (
                    f"Could not fetch OWM weather for '{district}'. "
                    "Set OPENWEATHERMAP_API_KEY or try again later."
                ),
                # Partial data still returned for offline fallback
                "partial": data,
            },
        )
    return data


# ---------------------------------------------------------------------------
# POST /v2/soil/daily-record  (auth required)
# ---------------------------------------------------------------------------

class DailyRecordIn(BaseModel):
    record_date: str | None = None  # YYYY-MM-DD; defaults to today
    rain_mm: float | None = None
    temp_c: float | None = None
    humidity_pct: float | None = None
    weather_source: str | None = None
    weather_pulled_at: str | None = None
    et0_mm: float | None = None
    crop_water_need_mm: float | None = None
    irrigation_recommended: str | None = None
    irrigation_minutes: int | None = None
    irrigation_confirmed: bool | None = None
    fertilizer_due: bool = False
    fertilizer_stage: str | None = None
    fertilizer_cost: float | None = None
    fertilizer_confirmed: bool | None = None
    fertilizer_items: dict | None = None


@router.post("/soil/daily-record")
async def upsert_daily_record(
    body: DailyRecordIn,
    farmer: CurrentFarmerDep,
    db: DbDep,
) -> Any:
    """Upsert (insert or update) today's daily record for the authenticated farmer."""
    record_date = (
        date.fromisoformat(body.record_date) if body.record_date else date.today()
    )
    weather_pulled_at = None
    if body.weather_pulled_at:
        try:
            weather_pulled_at = datetime.fromisoformat(body.weather_pulled_at)
        except ValueError:
            weather_pulled_at = None

    values = {
        "id": uuid.uuid4(),
        "farmer_id": farmer.farmer_id,
        "record_date": record_date,
        "rain_mm": body.rain_mm,
        "temp_c": body.temp_c,
        "humidity_pct": body.humidity_pct,
        "weather_source": body.weather_source,
        "weather_pulled_at": weather_pulled_at,
        "et0_mm": body.et0_mm,
        "crop_water_need_mm": body.crop_water_need_mm,
        "irrigation_recommended": body.irrigation_recommended,
        "irrigation_minutes": body.irrigation_minutes,
        "irrigation_confirmed": body.irrigation_confirmed,
        "fertilizer_due": body.fertilizer_due,
        "fertilizer_stage": body.fertilizer_stage,
        "fertilizer_cost": body.fertilizer_cost,
        "fertilizer_confirmed": body.fertilizer_confirmed,
        "fertilizer_items": body.fertilizer_items,
    }

    stmt = (
        pg_insert(FarmDailyRecord)
        .values(**values)
        .on_conflict_do_update(
            constraint="uq_farmer_daily_record",
            set_={k: v for k, v in values.items() if k not in ("id", "farmer_id", "record_date")},
        )
        .returning(FarmDailyRecord)
    )

    result = await db.execute(stmt)
    await db.commit()
    row = result.fetchone()
    if row is None:
        return JSONResponse(status_code=500, content={"error": "upsert_failed"})

    rec = row[0]
    return {
        "id": str(rec.id),
        "farmer_id": str(rec.farmer_id),
        "record_date": rec.record_date.isoformat(),
        "rain_mm": float(rec.rain_mm) if rec.rain_mm is not None else None,
        "temp_c": float(rec.temp_c) if rec.temp_c is not None else None,
        "humidity_pct": float(rec.humidity_pct) if rec.humidity_pct is not None else None,
        "weather_source": rec.weather_source,
        "et0_mm": float(rec.et0_mm) if rec.et0_mm is not None else None,
        "crop_water_need_mm": float(rec.crop_water_need_mm) if rec.crop_water_need_mm is not None else None,
        "irrigation_recommended": rec.irrigation_recommended,
        "irrigation_minutes": rec.irrigation_minutes,
        "irrigation_confirmed": rec.irrigation_confirmed,
        "fertilizer_due": rec.fertilizer_due,
        "fertilizer_stage": rec.fertilizer_stage,
        "fertilizer_cost": float(rec.fertilizer_cost) if rec.fertilizer_cost is not None else None,
        "fertilizer_confirmed": rec.fertilizer_confirmed,
        "fertilizer_items": rec.fertilizer_items,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


# ---------------------------------------------------------------------------
# GET /v2/soil/daily-records  (auth required)
# ---------------------------------------------------------------------------

@router.get("/soil/daily-records")
async def list_daily_records(
    farmer: CurrentFarmerDep,
    db: DbDep,
    days: int = Query(default=30, ge=1, le=90),
) -> Any:
    """Return last N daily records for the authenticated farmer, newest first."""
    stmt = (
        select(FarmDailyRecord)
        .where(FarmDailyRecord.farmer_id == farmer.farmer_id)
        .order_by(desc(FarmDailyRecord.record_date))
        .limit(days)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    records = []
    for rec in rows:
        records.append({
            "id": str(rec.id),
            "farmer_id": str(rec.farmer_id),
            "record_date": rec.record_date.isoformat(),
            "rain_mm": float(rec.rain_mm) if rec.rain_mm is not None else None,
            "temp_c": float(rec.temp_c) if rec.temp_c is not None else None,
            "humidity_pct": float(rec.humidity_pct) if rec.humidity_pct is not None else None,
            "weather_source": rec.weather_source,
            "et0_mm": float(rec.et0_mm) if rec.et0_mm is not None else None,
            "crop_water_need_mm": float(rec.crop_water_need_mm) if rec.crop_water_need_mm is not None else None,
            "irrigation_recommended": rec.irrigation_recommended,
            "irrigation_minutes": rec.irrigation_minutes,
            "irrigation_confirmed": rec.irrigation_confirmed,
            "fertilizer_due": rec.fertilizer_due,
            "fertilizer_stage": rec.fertilizer_stage,
            "fertilizer_cost": float(rec.fertilizer_cost) if rec.fertilizer_cost is not None else None,
            "fertilizer_confirmed": rec.fertilizer_confirmed,
            "fertilizer_items": rec.fertilizer_items,
            "created_at": rec.created_at.isoformat() if rec.created_at else None,
        })

    return {"records": records, "total": len(records)}
