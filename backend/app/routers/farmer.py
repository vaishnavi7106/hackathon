from fastapi import APIRouter, status

from app.crud.farmer import (
    create_soil_test,
    detect_deficiencies,
    get_farmer_with_latest_soil,
    update_farmer,
)
from app.deps import CurrentFarmerDep, DbDep
from app.schemas.farmer import FarmerProfile, FarmerUpdate, SoilTestIn, SoilTestOut

router = APIRouter(prefix="/farmer", tags=["farmer"])


@router.get("/me", response_model=FarmerProfile)
async def get_me(farmer: CurrentFarmerDep, db: DbDep):
    farmer_full = await get_farmer_with_latest_soil(db, farmer.farmer_id)
    return _to_profile(farmer_full)


@router.put("/me", response_model=FarmerProfile)
async def update_me(body: FarmerUpdate, farmer: CurrentFarmerDep, db: DbDep):
    updated = await update_farmer(db, farmer, body)
    farmer_full = await get_farmer_with_latest_soil(db, updated.farmer_id)
    return _to_profile(farmer_full)


@router.post("/soil-test", response_model=SoilTestOut, status_code=status.HTTP_201_CREATED)
async def add_soil_test(body: SoilTestIn, farmer: CurrentFarmerDep, db: DbDep):
    test = await create_soil_test(db, farmer.farmer_id, body)
    deficiencies = detect_deficiencies(test)
    return SoilTestOut(
        test_id=test.test_id,
        tested_at=test.tested_at,
        ph=float(test.ph) if test.ph is not None else None,
        nitrogen=float(test.nitrogen) if test.nitrogen is not None else None,
        phosphorus=float(test.phosphorus) if test.phosphorus is not None else None,
        potassium=float(test.potassium) if test.potassium is not None else None,
        organic_matter=float(test.organic_matter) if test.organic_matter is not None else None,
        zinc=float(test.zinc) if test.zinc is not None else None,
        iron=float(test.iron) if test.iron is not None else None,
        copper=float(test.copper) if test.copper is not None else None,
        boron=float(test.boron) if test.boron is not None else None,
        source=test.source,
        deficiencies=deficiencies,
    )


def _to_profile(farmer) -> FarmerProfile:
    from app.schemas.farmer import CropOut, SoilTestOut
    from app.crud.farmer import detect_deficiencies

    crops = [CropOut.model_validate(c, from_attributes=True) for c in (farmer.crops or [])]

    latest = getattr(farmer, "latest_soil_test", None)
    soil_out = None
    if latest:
        deficiencies = detect_deficiencies(latest)
        soil_out = SoilTestOut(
            test_id=latest.test_id,
            tested_at=latest.tested_at,
            ph=float(latest.ph) if latest.ph is not None else None,
            nitrogen=float(latest.nitrogen) if latest.nitrogen is not None else None,
            phosphorus=float(latest.phosphorus) if latest.phosphorus is not None else None,
            potassium=float(latest.potassium) if latest.potassium is not None else None,
            organic_matter=float(latest.organic_matter) if latest.organic_matter is not None else None,
            zinc=float(latest.zinc) if latest.zinc is not None else None,
            iron=float(latest.iron) if latest.iron is not None else None,
            copper=float(latest.copper) if latest.copper is not None else None,
            boron=float(latest.boron) if latest.boron is not None else None,
            source=latest.source,
            deficiencies=deficiencies,
        )

    return FarmerProfile(
        farmer_id=farmer.farmer_id,
        phone=farmer.phone,
        name=farmer.name,
        district=farmer.district,
        village=farmer.village,
        land_size_acres=float(farmer.land_size_acres) if farmer.land_size_acres is not None else None,
        pump_type=farmer.pump_type,
        storage_facility=farmer.storage_facility,
        language=farmer.language,
        aadhaar_linked=farmer.aadhaar_linked,
        income_band=farmer.income_band,
        crops=crops,
        latest_soil_test=soil_out,
        created_at=farmer.created_at,
        updated_at=farmer.updated_at,
    )
