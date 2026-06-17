import pytest


@pytest.mark.asyncio
async def test_list_diseases_empty_without_seed(db):
    from app.crud.disease import list_diseases

    diseases = await list_diseases(db)
    assert diseases == []


@pytest.mark.asyncio
async def test_seed_diseases_fixture(db, seed_diseases):
    from app.crud.disease import list_diseases

    diseases = await list_diseases(db)
    assert len(diseases) == 2


@pytest.mark.asyncio
async def test_get_disease_by_id(db, seed_diseases):
    from app.crud.disease import get_disease

    d = await get_disease(db, "rice_blast")
    assert d is not None
    assert d.name_en == "Rice Blast"
    assert d.name_ta == "நெல் வெடிப்பு நோய்"
    assert d.crop_id == "rice"


@pytest.mark.asyncio
async def test_get_missing_disease_returns_none(db):
    from app.crud.disease import get_disease

    d = await get_disease(db, "nonexistent")
    assert d is None


@pytest.mark.asyncio
async def test_list_diseases_by_crop(db, seed_diseases):
    from app.crud.disease import list_diseases_by_crop

    rice_diseases = await list_diseases_by_crop(db, "rice")
    assert len(rice_diseases) == 1
    assert rice_diseases[0].disease_id == "rice_blast"

    tomato_diseases = await list_diseases_by_crop(db, "tomato")
    assert len(tomato_diseases) == 1
    assert tomato_diseases[0].disease_id == "tomato_early_blight"

    unknown = await list_diseases_by_crop(db, "banana")
    assert unknown == []


@pytest.mark.asyncio
async def test_create_disease(db, seed_crops):
    from app.crud.disease import create_disease, get_disease
    from app.schemas.disease import DiseaseCreate

    data = DiseaseCreate(
        disease_id="rice_sheath_blight",
        crop_id="rice",
        crop="rice",
        name_en="Rice Sheath Blight",
        name_ta="நெல் உறை அழுகல்",
        modern_chemical="Hexaconazole 5 EC",
        modern_dosage="2 ml/L water",
        modern_cost_acre=180.0,
        icar_reference="ICAR-CRRI-SB-2022",
    )
    disease = await create_disease(db, data)
    assert disease.disease_id == "rice_sheath_blight"

    fetched = await get_disease(db, "rice_sheath_blight")
    assert fetched is not None
    assert fetched.modern_cost_acre == 180.0


@pytest.mark.asyncio
async def test_update_disease(db, seed_diseases):
    from app.crud.disease import get_disease, update_disease
    from app.schemas.disease import DiseaseUpdate

    disease = await get_disease(db, "rice_blast")
    updated = await update_disease(
        db,
        disease,
        DiseaseUpdate(modern_chemical="Tricyclazole 75 WP", modern_cost_acre=350.0),
    )
    assert updated.modern_chemical == "Tricyclazole 75 WP"
    assert updated.modern_cost_acre == 350.0
    # Fields not in update remain unchanged
    assert updated.name_en == "Rice Blast"
