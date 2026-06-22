import os
import uuid as _uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.crud.farmer import (
    create_soil_test,
    detect_deficiencies,
    get_farmer_with_latest_soil,
    update_farmer,
)
from app.deps import CurrentFarmerDep, DbDep
from app.schemas.farmer import FarmerProfile, FarmerUpdate, SoilTestIn, SoilTestOut

router = APIRouter(prefix="/farmer", tags=["farmer"])

_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


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


@router.post("/documents/soil-health-card", status_code=status.HTTP_200_OK)
async def upload_soil_health_card(
    farmer: CurrentFarmerDep,
    db: DbDep,
    file: UploadFile = File(...),
):
    """Upload a Soil Health Card (PDF or image). Stores the file and records the path."""
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP, PDF",
        )

    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    filename = f"shc_{farmer.farmer_id}_{_uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(_UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)

    farmer.soil_health_card_path = path
    db.add(farmer)
    await db.flush()
    await db.refresh(farmer)

    return {
        "status": "uploaded",
        "filename": filename,
        "size_bytes": len(content),
        "soil_health_card_url": f"/v1/farmer/documents/{filename}",
    }


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

    shc_url = None
    if farmer.soil_health_card_path:
        fname = os.path.basename(farmer.soil_health_card_path)
        shc_url = f"/v1/farmer/documents/{fname}"

    return FarmerProfile(
        farmer_id=farmer.farmer_id,
        phone=farmer.phone,
        name=farmer.name,
        district=farmer.district,
        taluk=getattr(farmer, "taluk", None),
        village=farmer.village,
        gender=getattr(farmer, "gender", None),
        land_size_acres=float(farmer.land_size_acres) if farmer.land_size_acres is not None else None,
        pump_type=farmer.pump_type,
        storage_facility=farmer.storage_facility,
        language=farmer.language,
        aadhaar_linked=farmer.aadhaar_linked,
        income_band=farmer.income_band,
        age=getattr(farmer, "age", None),
        bank_account_linked=getattr(farmer, "bank_account_linked", None),
        land_ownership=getattr(farmer, "land_ownership", None),
        primary_crop=getattr(farmer, "primary_crop", None),
        secondary_crop=getattr(farmer, "secondary_crop", None),
        season=getattr(farmer, "season", None),
        irrigation_type=getattr(farmer, "irrigation_type", None),
        soil_type=getattr(farmer, "soil_type", None),
        soil_health_card_url=shc_url,
        crops=crops,
        latest_soil_test=soil_out,
        created_at=farmer.created_at,
        updated_at=farmer.updated_at,
    )
