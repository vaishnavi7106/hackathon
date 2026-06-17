import pytest
from datetime import date


@pytest.mark.asyncio
async def test_list_schemes_empty_without_seed(db):
    from app.crud.schemes import list_schemes

    schemes = await list_schemes(db)
    assert schemes == []


@pytest.mark.asyncio
async def test_get_scheme_by_id(db, seed_scheme):
    from app.crud.schemes import get_scheme

    scheme = await get_scheme(db, "pm_kisan")
    assert scheme is not None
    assert scheme.name_en == "PM-KISAN"
    assert scheme.benefit_amount_num == 6000


@pytest.mark.asyncio
async def test_get_missing_scheme_returns_none(db):
    from app.crud.schemes import get_scheme

    s = await get_scheme(db, "nonexistent_scheme")
    assert s is None


@pytest.mark.asyncio
async def test_create_scheme(db):
    from app.crud.schemes import create_scheme, get_scheme
    from app.schemas.schemes import GovernmentSchemeCreate

    data = GovernmentSchemeCreate(
        scheme_id="tn_drip_subsidy",
        name_en="TN Drip Irrigation Subsidy",
        name_ta="துளி நீர்ப்பாசன மானியம்",
        level="state",
        benefit_amount="90% subsidy",
        benefit_amount_num=90.0,
        min_land_acres=0.5,
        max_land_acres=5.0,
        requires_aadhaar=True,
        documents_required=["Aadhaar", "Land records", "Bank passbook"],
        description_ta="துளி நீர்ப்பாசன நிறுவல் செலவில் 90% மானியம்.",
        last_verified=date(2025, 3, 1),
    )
    scheme = await create_scheme(db, data)
    assert scheme.scheme_id == "tn_drip_subsidy"
    assert scheme.level == "state"

    fetched = await get_scheme(db, "tn_drip_subsidy")
    assert fetched is not None
    assert fetched.benefit_amount_num == 90.0


@pytest.mark.asyncio
async def test_update_scheme(db, seed_scheme):
    from app.crud.schemes import get_scheme, update_scheme
    from app.schemas.schemes import GovernmentSchemeUpdate

    scheme = await get_scheme(db, "pm_kisan")
    updated = await update_scheme(
        db,
        scheme,
        GovernmentSchemeUpdate(benefit_amount_num=8000.0, benefit_amount="₹8,000/year"),
    )
    assert updated.benefit_amount_num == 8000.0
    assert updated.benefit_amount == "₹8,000/year"


@pytest.mark.asyncio
async def test_deactivate_scheme(db, seed_scheme):
    from app.crud.schemes import deactivate_scheme, get_scheme, list_schemes

    scheme = await get_scheme(db, "pm_kisan")
    await deactivate_scheme(db, scheme)

    active = await list_schemes(db, active_only=True)
    assert all(s.scheme_id != "pm_kisan" for s in active)


@pytest.mark.asyncio
async def test_eligibility_filter_basic(db, seed_scheme):
    from app.crud.schemes import get_eligible_schemes

    # pm_kisan: no land restriction, requires_aadhaar=True
    eligible = await get_eligible_schemes(
        db,
        land_acres=2.0,
        aadhaar_linked=True,
        crops=["rice"],
        district="Coimbatore",
    )
    assert any(s.scheme_id == "pm_kisan" for s in eligible)


@pytest.mark.asyncio
async def test_eligibility_filter_excludes_aadhaar_required(db, seed_scheme):
    from app.crud.schemes import get_eligible_schemes

    eligible = await get_eligible_schemes(
        db,
        land_acres=2.0,
        aadhaar_linked=False,  # pm_kisan requires aadhaar
        crops=["rice"],
        district="Coimbatore",
    )
    assert not any(s.scheme_id == "pm_kisan" for s in eligible)


@pytest.mark.asyncio
async def test_list_schemes_with_level_filter(db):
    from app.crud.schemes import create_scheme, list_schemes
    from app.schemas.schemes import GovernmentSchemeCreate

    await create_scheme(
        db,
        GovernmentSchemeCreate(
            scheme_id="central_test",
            name_en="Central Test",
            name_ta="மத்திய சோதனை",
            level="central",
            documents_required=[],
            description_ta="Test",
            last_verified=date(2025, 1, 1),
        ),
    )
    await create_scheme(
        db,
        GovernmentSchemeCreate(
            scheme_id="state_test",
            name_en="State Test",
            name_ta="மாநில சோதனை",
            level="state",
            documents_required=[],
            description_ta="Test",
            last_verified=date(2025, 1, 1),
        ),
    )

    central = await list_schemes(db, active_only=True, level="central")
    assert all(s.level == "central" for s in central)

    state = await list_schemes(db, active_only=True, level="state")
    assert all(s.level == "state" for s in state)
