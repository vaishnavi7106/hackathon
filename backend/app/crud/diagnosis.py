import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.diagnosis import Diagnosis, Disease


async def create_diagnosis(
    db: AsyncSession,
    *,
    farmer_id: uuid.UUID | None,
    image_key: str,
    crop: str | None = None,
    disease_id: str | None = None,
    disease_name_en: str | None = None,
    disease_name_ta: str | None = None,
    confidence: float | None = None,
    low_confidence: bool = False,
    heatmap_key: str | None = None,
    model_version: str | None = None,
) -> Diagnosis:
    diag = Diagnosis(
        farmer_id=farmer_id,
        image_key=image_key,
        crop=crop,
        disease_id=disease_id,
        disease_name_en=disease_name_en,
        disease_name_ta=disease_name_ta,
        confidence=confidence,
        low_confidence=low_confidence,
        heatmap_key=heatmap_key,
        model_version=model_version,
    )
    db.add(diag)
    await db.flush()
    await db.refresh(diag)
    return diag


async def get_diagnosis(db: AsyncSession, diagnosis_id: uuid.UUID) -> Diagnosis | None:
    result = await db.execute(
        select(Diagnosis).where(Diagnosis.diagnosis_id == diagnosis_id)
    )
    return result.scalar_one_or_none()


async def get_farmer_diagnoses(
    db: AsyncSession, farmer_id: uuid.UUID, limit: int = 10
) -> list[Diagnosis]:
    result = await db.execute(
        select(Diagnosis)
        .where(Diagnosis.farmer_id == farmer_id)
        .order_by(Diagnosis.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_diagnosis_result(
    db: AsyncSession,
    diagnosis_id: uuid.UUID,
    *,
    disease_id: str,
    disease_name_en: str,
    disease_name_ta: str,
    confidence: float,
    low_confidence: bool = False,
) -> Diagnosis | None:
    result = await db.execute(
        select(Diagnosis).where(Diagnosis.diagnosis_id == diagnosis_id)
    )
    diag = result.scalar_one_or_none()
    if diag is None:
        return None
    diag.disease_id = disease_id
    diag.disease_name_en = disease_name_en
    diag.disease_name_ta = disease_name_ta
    diag.confidence = confidence
    diag.low_confidence = low_confidence
    await db.flush()
    await db.refresh(diag)
    return diag


async def get_disease(db: AsyncSession, disease_id: str) -> Disease | None:
    result = await db.execute(select(Disease).where(Disease.disease_id == disease_id))
    return result.scalar_one_or_none()
