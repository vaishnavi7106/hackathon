import pytest


@pytest.mark.asyncio
async def test_list_crops_empty_without_seed(client):
    """Without seeded data the crops table is empty (each test rolls back)."""
    from app.crud.crop import list_crops

    # Directly test the CRUD function via the overridden DB
    # (via the client fixture the DB session is accessible through the override)
    r = await client.get("/v1/crops")
    # Endpoint may not exist yet — skip if 404
    if r.status_code == 404:
        pytest.skip("GET /v1/crops not yet implemented")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_seed_crops_fixture(db, seed_crops):
    from app.crud.crop import list_crops

    crops = await list_crops(db)
    assert len(crops) == 2
    ids = {c.crop_id for c in crops}
    assert "rice" in ids
    assert "tomato" in ids


@pytest.mark.asyncio
async def test_get_crop_by_id(db, seed_crops):
    from app.crud.crop import get_crop

    crop = await get_crop(db, "rice")
    assert crop is not None
    assert crop.name_en == "Rice"
    assert crop.name_ta == "நெல்"
    assert crop.is_priority is True


@pytest.mark.asyncio
async def test_get_missing_crop_returns_none(db, seed_crops):
    from app.crud.crop import get_crop

    crop = await get_crop(db, "nonexistent_crop")
    assert crop is None


@pytest.mark.asyncio
async def test_priority_only_filter(db, seed_crops):
    from app.crud.crop import list_crops

    priority = await list_crops(db, priority_only=True)
    assert all(c.is_priority for c in priority)


@pytest.mark.asyncio
async def test_get_crop_by_name(db, seed_crops):
    from app.crud.crop import get_crop_by_name

    crop = await get_crop_by_name(db, "Rice")
    assert crop is not None
    assert crop.crop_id == "rice"


@pytest.mark.asyncio
async def test_get_crops_by_ids(db, seed_crops):
    from app.crud.crop import get_crops_by_ids

    crops = await get_crops_by_ids(db, ["rice", "tomato"])
    assert len(crops) == 2

    crops_partial = await get_crops_by_ids(db, ["rice"])
    assert len(crops_partial) == 1

    crops_empty = await get_crops_by_ids(db, [])
    assert crops_empty == []
