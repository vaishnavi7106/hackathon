"""Pillar 2 — Soil & Water Optimizer router.

XGBoost and LSTM stubs are clearly marked. Replace on Day 9.
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, status

from app.crud.farmer import get_latest_soil_test
from app.crud.prescription import create_prescription, get_prescription
from app.deps import CurrentFarmerDep, CurrentFarmerIdDep, DbDep
from app.exceptions import NotFoundError
from app.schemas.prescribe import (
    CalendarEntry,
    FertilizerOut,
    IrrigationOut,
    IrrigationSession,
    MicronutrientFlags,
    PrescribeRequest,
    PrescribeResponse,
    WeatherForecastSnap,
)
from app.services.imd import get_district_forecast

router = APIRouter(prefix="/prescribe", tags=["prescribe"])

# Standard NPK per crop per acre (kg) — ICAR baseline
ICAR_BASELINE: dict[str, dict] = {
    "rice":       {"n": 40, "p": 20, "k": 40, "std_cost": 2460},
    "sugarcane":  {"n": 60, "p": 30, "k": 60, "std_cost": 3600},
    "banana":     {"n": 55, "p": 25, "k": 50, "std_cost": 3300},
    "groundnut":  {"n": 20, "p": 40, "k": 40, "std_cost": 2400},
    "cotton":     {"n": 50, "p": 25, "k": 25, "std_cost": 2400},
    "tomato":     {"n": 50, "p": 50, "k": 75, "std_cost": 4200},
}
DEFAULT_BASELINE = {"n": 40, "p": 20, "k": 40, "std_cost": 2400}

STORAGE_COST_PER_WEEK = {"diesel": 42, "electric": 28, "none": 0}


@router.post("", response_model=PrescribeResponse, status_code=status.HTTP_200_OK)
async def prescribe(body: PrescribeRequest, farmer: CurrentFarmerDep, db: DbDep):
    # Resolve soil test
    soil_test = None
    if body.soil_test_id:
        from app.db.models.soil import SoilTest
        from sqlalchemy import select
        result = await db.execute(
            select(SoilTest).where(
                SoilTest.test_id == body.soil_test_id,
                SoilTest.farmer_id == farmer.farmer_id,
            )
        )
        soil_test = result.scalar_one_or_none()
        if soil_test is None:
            raise NotFoundError("Soil test", detail_ta="மண் பரிசோதனை கண்டுபிடிக்கவில்லை.")
    else:
        soil_test = await get_latest_soil_test(db, farmer.farmer_id)

    # Fetch IMD forecast
    weather = await get_district_forecast(farmer.district)

    # --- XGBoost fertilizer stub ---
    # Replace with real XGBoost inference on Day 9:
    #   from app.ml.soil_optimizer import predict_fertilizer
    #   fert = await predict_fertilizer(soil_test, body.crop, farmer.district)
    fert_data = _stub_fertilizer(body.crop, soil_test)
    # --------------------------------

    # --- LSTM irrigation stub ---
    # Replace with real LSTM inference on Day 9:
    #   from app.ml.irrigation import predict_irrigation
    #   irr = await predict_irrigation(weather, farmer.pump_type, body.crop)
    irr_data = _stub_irrigation(body.start_date, weather, farmer.pump_type or "electric")
    # ----------------------------

    joint = _build_joint_calendar(fert_data["schedule"], irr_data["sessions"])

    prescription = await create_prescription(
        db,
        farmer_id=farmer.farmer_id,
        soil_test_id=soil_test.test_id if soil_test else None,
        crop=body.crop,
        season=body.season,
        nitrogen_kg=fert_data["n_kg"],
        phosphorus_kg=fert_data["p_kg"],
        potassium_kg=fert_data["k_kg"],
        micro_flags=fert_data["micro_flags"],
        fertilizer_cost=fert_data["cost"],
        fertilizer_save=fert_data["savings"],
        irrigation_plan=[s.model_dump() for s in irr_data["sessions"]],
        water_cost_est=irr_data["total_cost"],
        joint_calendar=[e.model_dump() for e in joint],
        weather_snapshot=weather,
        model_version="stub-v0",
    )

    rain_skips = [d["date"] for d in weather.get("days", []) if d.get("rain_expected")]
    rain_note = None
    if rain_skips:
        rain_note = f"மழை வர வாய்ப்பு உள்ள நாட்களில் ({', '.join(rain_skips[:2])}) நீர்ப்பாசனம் தேவையில்லை."

    return PrescribeResponse(
        prescription_id=prescription.prescription_id,
        fertilizer=FertilizerOut(
            nitrogen_kg_per_acre=fert_data["n_kg"],
            phosphorus_kg_per_acre=fert_data["p_kg"],
            potassium_kg_per_acre=fert_data["k_kg"],
            micronutrients=MicronutrientFlags(**fert_data["micro_flags"]),
            total_cost_estimate=fert_data["cost"],
            savings_vs_standard=fert_data["savings"],
            savings_note_ta=f"இந்த மருந்து உங்கள் பகுதியில் வழக்கமான முறையை விட ₹{int(fert_data['savings'])} மிச்சப்படுத்தும்." if fert_data["savings"] > 0 else None,
        ),
        irrigation=IrrigationOut(
            total_sessions=len(irr_data["sessions"]),
            schedule=irr_data["sessions"],
            rain_skips=rain_skips,
            rain_skip_note_ta=rain_note,
        ),
        joint_calendar=joint,
        weather_forecast_used=WeatherForecastSnap(
            source=weather.get("source", "open-meteo"),
            fetched_at=prescription.created_at,
            days=weather.get("days", []),
        ),
        model_unavailable=True,
        model_unavailable_note="ML models not yet loaded. Showing ICAR baseline estimates.",
    )


@router.get("/{prescription_id}", response_model=PrescribeResponse)
async def get_prescription_by_id(
    prescription_id: uuid.UUID, farmer_id: CurrentFarmerIdDep, db: DbDep
):
    p = await get_prescription(db, prescription_id)
    if p is None or (p.farmer_id and p.farmer_id != farmer_id):
        raise NotFoundError("Prescription")

    # Rebuild response from stored data
    sessions = [IrrigationSession(**s) for s in (p.irrigation_plan or [])]
    calendar = [CalendarEntry(**e) for e in (p.joint_calendar or [])]
    return PrescribeResponse(
        prescription_id=p.prescription_id,
        fertilizer=FertilizerOut(
            nitrogen_kg_per_acre=float(p.nitrogen_kg) if p.nitrogen_kg else None,
            phosphorus_kg_per_acre=float(p.phosphorus_kg) if p.phosphorus_kg else None,
            potassium_kg_per_acre=float(p.potassium_kg) if p.potassium_kg else None,
            micronutrients=MicronutrientFlags(**(p.micro_flags or {})),
            total_cost_estimate=float(p.fertilizer_cost) if p.fertilizer_cost else None,
            savings_vs_standard=float(p.fertilizer_save) if p.fertilizer_save else None,
            savings_note_ta=None,
        ),
        irrigation=IrrigationOut(total_sessions=len(sessions), schedule=sessions),
        joint_calendar=calendar,
    )


def _stub_fertilizer(crop: str, soil_test) -> dict:
    baseline = ICAR_BASELINE.get(crop.lower(), DEFAULT_BASELINE)
    # Apply a 15% reduction if soil test data is available
    factor = 0.85 if soil_test else 1.0
    n_kg = round(baseline["n"] * factor, 1)
    p_kg = round(baseline["p"] * factor, 1)
    k_kg = round(baseline["k"] * factor, 1)
    cost = round((n_kg * 15 + p_kg * 28 + k_kg * 22), 2)
    savings = round(baseline["std_cost"] - cost, 2)
    micro_flags: dict = {
        "zinc_deficiency": False,
        "iron_deficiency": False,
        "copper_deficiency": False,
        "boron_deficiency": False,
    }
    if soil_test and soil_test.zinc and float(soil_test.zinc) < 0.6:
        micro_flags["zinc_deficiency"] = True
        micro_flags["zinc_supplement"] = "Zinc sulphate 25 kg/ha"
    return {
        "n_kg": n_kg,
        "p_kg": p_kg,
        "k_kg": k_kg,
        "micro_flags": micro_flags,
        "cost": max(cost, 0),
        "savings": max(savings, 0),
        "schedule": [{"day": 1, "type": "basal"}, {"day": 21, "type": "top_dress"}],
    }


def _stub_irrigation(
    start: date, weather: dict, pump_type: str
) -> dict:
    rain_days = {d["date"] for d in weather.get("days", []) if d.get("rain_expected")}
    cost_per_hour = STORAGE_COST_PER_WEEK.get(pump_type, 28)
    sessions = []
    day_offset = 0
    for i in range(8):
        candidate = start + timedelta(days=day_offset)
        while str(candidate) in rain_days:
            candidate += timedelta(days=1)
        duration = 90 if i % 3 == 0 else 60
        sessions.append(
            IrrigationSession(
                day=day_offset + 1,
                date=candidate,
                duration_min=duration,
                volume_litres=duration * 20,
                cost_estimate=round((duration / 60) * cost_per_hour, 2),
            )
        )
        day_offset += 2
    total_cost = sum(s.cost_estimate or 0 for s in sessions)
    return {"sessions": sessions, "total_cost": total_cost}


def _build_joint_calendar(fert_schedule: list, irr_sessions: list[IrrigationSession]) -> list[CalendarEntry]:
    entries: list[CalendarEntry] = []
    for session in irr_sessions:
        entries.append(
            CalendarEntry(
                day=session.day,
                date=session.date,
                action="irrigate",
                detail=f"{session.duration_min} நிமிடம் நீர்ப்பாசனம் ({session.volume_litres}L)",
            )
        )
    # Add fertilizer days after first and third irrigation sessions
    for idx, fs in enumerate(fert_schedule):
        if idx < len(irr_sessions):
            fert_date = irr_sessions[idx].date + timedelta(days=1)
            label = "யூரியா" if fs["type"] == "top_dress" else "அடி உரம்"
            entries.append(
                CalendarEntry(
                    day=irr_sessions[idx].day + 1,
                    date=fert_date,
                    action="fertilize",
                    detail=f"{label} இடவும்",
                )
            )
    entries.sort(key=lambda e: e.date)
    return entries
