import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.prescription import Prescription


async def create_prescription(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    soil_test_id: uuid.UUID | None,
    crop: str,
    season: str | None,
    nitrogen_kg: float | None,
    phosphorus_kg: float | None,
    potassium_kg: float | None,
    micro_flags: dict | None,
    fertilizer_cost: float | None,
    fertilizer_save: float | None,
    irrigation_plan: list,
    water_cost_est: float | None,
    joint_calendar: list,
    weather_snapshot: dict | None,
    model_version: str | None = None,
) -> Prescription:
    prescription = Prescription(
        farmer_id=farmer_id,
        soil_test_id=soil_test_id,
        crop=crop,
        season=season,
        nitrogen_kg=nitrogen_kg,
        phosphorus_kg=phosphorus_kg,
        potassium_kg=potassium_kg,
        micro_flags=micro_flags,
        fertilizer_cost=fertilizer_cost,
        fertilizer_save=fertilizer_save,
        irrigation_plan=irrigation_plan,
        water_cost_est=water_cost_est,
        joint_calendar=joint_calendar,
        weather_snapshot=weather_snapshot,
        model_version=model_version,
    )
    db.add(prescription)
    await db.flush()
    await db.refresh(prescription)
    return prescription


async def get_prescription(
    db: AsyncSession, prescription_id: uuid.UUID
) -> Prescription | None:
    result = await db.execute(
        select(Prescription).where(Prescription.prescription_id == prescription_id)
    )
    return result.scalar_one_or_none()
