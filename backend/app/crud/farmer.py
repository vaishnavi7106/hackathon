import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.farmer import Farmer, FarmerCrop
from app.db.models.soil import SoilTest
from app.schemas.farmer import CropIn, FarmerUpdate, SoilTestIn


async def get_farmer_by_id(db: AsyncSession, farmer_id: uuid.UUID) -> Farmer | None:
    result = await db.execute(
        select(Farmer)
        .options(selectinload(Farmer.crops))
        .where(Farmer.farmer_id == farmer_id)
    )
    return result.scalar_one_or_none()


async def get_farmer_with_latest_soil(db: AsyncSession, farmer_id: uuid.UUID) -> Farmer | None:
    result = await db.execute(
        select(Farmer)
        .options(selectinload(Farmer.crops))
        .where(Farmer.farmer_id == farmer_id)
    )
    farmer = result.scalar_one_or_none()
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


async def update_farmer(
    db: AsyncSession, farmer: Farmer, data: FarmerUpdate
) -> Farmer:
    update_data = data.model_dump(exclude_none=True, exclude={"crops"})
    for field, value in update_data.items():
        setattr(farmer, field, value)

    if data.crops is not None:
        # Replace crops wholesale
        await db.execute(
            FarmerCrop.__table__.delete().where(FarmerCrop.farmer_id == farmer.farmer_id)
        )
        for crop_in in data.crops:
            db.add(FarmerCrop(farmer_id=farmer.farmer_id, **crop_in.model_dump()))

    await db.flush()
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
    if test.zinc is not None and test.zinc < 0.6:
        deficiencies.append("zinc")
    if test.iron is not None and test.iron < 4.5:
        deficiencies.append("iron")
    if test.copper is not None and test.copper < 0.2:
        deficiencies.append("copper")
    if test.boron is not None and test.boron < 0.5:
        deficiencies.append("boron")
    return deficiencies
