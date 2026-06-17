from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.crop import Crop


async def get_crop(db: AsyncSession, crop_id: str) -> Crop | None:
    result = await db.execute(select(Crop).where(Crop.crop_id == crop_id))
    return result.scalar_one_or_none()


async def list_crops(db: AsyncSession, *, priority_only: bool = False) -> list[Crop]:
    q = select(Crop).order_by(Crop.is_priority.desc(), Crop.name_en)
    if priority_only:
        q = q.where(Crop.is_priority == True)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_crops_by_ids(db: AsyncSession, crop_ids: list[str]) -> list[Crop]:
    if not crop_ids:
        return []
    result = await db.execute(select(Crop).where(Crop.crop_id.in_(crop_ids)))
    return list(result.scalars().all())


async def get_crop_by_name(db: AsyncSession, name: str) -> Crop | None:
    """Case-insensitive lookup by English or Tamil name."""
    result = await db.execute(
        select(Crop).where(
            (Crop.name_en.ilike(name)) | (Crop.name_ta == name) | (Crop.crop_id == name.lower())
        )
    )
    return result.scalars().first()
