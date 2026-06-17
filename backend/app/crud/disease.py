from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.diagnosis import Disease
from app.schemas.disease import DiseaseCreate, DiseaseUpdate


async def get_disease(db: AsyncSession, disease_id: str) -> Disease | None:
    result = await db.execute(select(Disease).where(Disease.disease_id == disease_id))
    return result.scalar_one_or_none()


async def list_diseases(db: AsyncSession) -> list[Disease]:
    result = await db.execute(select(Disease).order_by(Disease.crop, Disease.name_en))
    return list(result.scalars().all())


async def list_diseases_by_crop(db: AsyncSession, crop_id: str) -> list[Disease]:
    """Return diseases whose crop_id matches, falling back to crop varchar."""
    result = await db.execute(
        select(Disease)
        .where((Disease.crop_id == crop_id) | (Disease.crop == crop_id))
        .order_by(Disease.name_en)
    )
    return list(result.scalars().all())


async def create_disease(db: AsyncSession, data: DiseaseCreate) -> Disease:
    disease = Disease(**data.model_dump())
    db.add(disease)
    await db.flush()
    await db.refresh(disease)
    return disease


async def update_disease(db: AsyncSession, disease: Disease, data: DiseaseUpdate) -> Disease:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(disease, field, value)
    await db.flush()
    await db.refresh(disease)
    return disease
