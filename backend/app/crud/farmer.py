import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.farmer import Farmer, FarmerCrop
from app.db.models.soil import SoilTest
from app.schemas.farmer import FarmerCropIn, FarmerUpdate, SoilTestIn


async def get_farmer_by_id(db: AsyncSession, farmer_id: uuid.UUID) -> Farmer | None:
    result = await db.execute(
        select(Farmer)
        .options(selectinload(Farmer.crops))
        .where(Farmer.farmer_id == farmer_id)
    )
    return result.scalar_one_or_none()


async def get_farmer_with_latest_soil(db: AsyncSession, farmer_id: uuid.UUID) -> Farmer | None:
    farmer = await get_farmer_by_id(db, farmer_id)
    if farmer:
        farmer.latest_soil_test = await get_latest_soil_test(db, farmer_id)
    return farmer


async def get_farmer_by_phone(db: AsyncSession, phone: str) -> Farmer | None:
    result = await db.execute(select(Farmer).where(Farmer.phone == phone))
    return result.scalar_one_or_none()


async def create_farmer(
    db: AsyncSession,
    *,
    phone: str | None,
    name: str | None,
    district: str,
    village: str | None = None,
    language: str = "ta",
) -> Farmer:
    farmer = Farmer(
        phone=phone,
        name=name,
        district=district,
        village=village,
        language=language,
    )
    db.add(farmer)
    await db.flush()
    await db.refresh(farmer)
    return farmer


async def update_farmer(db: AsyncSession, farmer: Farmer, data: FarmerUpdate) -> Farmer:
    update_data = data.model_dump(exclude_none=True, exclude={"crops"})
    for field, value in update_data.items():
        setattr(farmer, field, value)

    new_crops: list[FarmerCrop] = []
    if data.crops is not None:
        await db.execute(
            FarmerCrop.__table__.delete().where(FarmerCrop.farmer_id == farmer.farmer_id)
        )
        for crop_in in data.crops:
            row = crop_in.model_dump()
            # Leave crop_id NULL when not provided — the eligibility engine reads
            # the crop varchar field directly; auto-filling an unverified slug
            # causes FK violations when the catalog row doesn't exist.
            crop = FarmerCrop(farmer_id=farmer.farmer_id, **row)
            db.add(crop)
            new_crops.append(crop)

    await db.flush()
    for crop in new_crops:
        await db.refresh(crop)
    await db.refresh(farmer)
    return farmer


async def create_soil_test(
    db: AsyncSession, farmer_id: uuid.UUID, data: SoilTestIn
) -> SoilTest:
    test = SoilTest(farmer_id=farmer_id, **data.model_dump())
    db.add(test)
    await db.flush()
    await db.refresh(test)
    return test


async def get_latest_soil_test(db: AsyncSession, farmer_id: uuid.UUID) -> SoilTest | None:
    result = await db.execute(
        select(SoilTest)
        .where(SoilTest.farmer_id == farmer_id)
        .order_by(SoilTest.tested_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def detect_deficiencies(test: SoilTest) -> list[str]:
    deficiencies = []
    thresholds = {"zinc": 0.6, "iron": 4.5, "copper": 0.2, "boron": 0.5}
    for nutrient, threshold in thresholds.items():
        value = getattr(test, nutrient, None)
        if value is not None and value < threshold:
            deficiencies.append(nutrient)
    return deficiencies
