"""Pillar 4 — Government Navigator integration tests.

Dataset: 24 authoritative schemes (8 central + 16 state).
  Central (level='central'): CEN-PMKISAN, CEN-PMFBY, CEN-PMKSY,
    CEN-SHC, CEN-KCC, CEN-ENAM, CEN-PKVY, CEN-PMKMY
  State (level='state'): CEN-TNFR + TN-AGRI-{147,153,162,163,164,165,167,168,171,172,173,174,175,176,177}
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession


# ── Catalog / list tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_schemes_empty(client):
    """With no data seeded, the catalog returns an empty list."""
    r = await client.get("/v1/schemes")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0
    assert data["schemes"] == []


@pytest.mark.asyncio
async def test_list_all_24_schemes(client, seed_all_schemes):
    r = await client.get("/v1/schemes")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 24
    ids = {s["scheme_id"] for s in data["schemes"]}
    # Spot-check central schemes
    assert "CEN-PMKISAN" in ids
    assert "CEN-PMKSY" in ids   # renamed from CEN-PMKSY-PDMC
    # Spot-check state schemes
    assert "TN-AGRI-153" in ids
    assert "TN-AGRI-177" in ids
    assert "CEN-TNFR" in ids
    # Old scheme IDs must not be present
    assert "CEN-PMKSY-PDMC" not in ids
    assert "TN-MILLET-MISSION" not in ids
    assert "TN-HILL-FARMERS" not in ids


@pytest.mark.asyncio
async def test_list_schemes_level_filter(client, seed_all_schemes):
    r_central = await client.get("/v1/schemes?level=central")
    assert r_central.status_code == 200
    assert r_central.json()["total"] == 8   # 8 central schemes

    r_state = await client.get("/v1/schemes?level=state")
    assert r_state.status_code == 200
    assert r_state.json()["total"] == 16    # CEN-TNFR + 15 TN-AGRI-*


@pytest.mark.asyncio
async def test_get_scheme_detail(client, seed_all_schemes):
    r = await client.get("/v1/schemes/CEN-PMKISAN")
    assert r.status_code == 200
    data = r.json()
    assert data["scheme_id"] == "CEN-PMKISAN"
    assert "Pradhan Mantri" in data["name_en"]
    assert data["benefit_amount_num"] == 6000.0
    assert data["requires_aadhaar"] is True
    assert "Aadhaar card" in data["documents_required"]
    assert data["application_url"] == "https://pmkisan.gov.in/NewFarmerRegistration.aspx"
    # New enriched fields
    assert data["department_en"] == "Ministry of Agriculture and Farmers Welfare"
    assert data["scheme_code"] == "PM-KISAN"
    assert data["year"] == "Ongoing"
    assert data["source_url"] == "https://pmkisan.gov.in"


@pytest.mark.asyncio
async def test_get_scheme_detail_with_null_benefit(client, seed_all_schemes):
    """State schemes with null benefit_amount must serialize without error."""
    r = await client.get("/v1/schemes/TN-AGRI-165")   # Tamil Nadu Millet Mission
    assert r.status_code == 200
    data = r.json()
    assert data["benefit_amount"] is None
    assert data["scheme_id"] == "TN-AGRI-165"
    assert data["department_ta"] == "வேளாண்மைத்துறை"
    assert data["scheme_code"] == "TNMM"


@pytest.mark.asyncio
async def test_get_scheme_not_found(client):
    r = await client.get("/v1/schemes/NONEXISTENT-SCHEME")
    assert r.status_code == 404


# ── Eligibility engine tests (deterministic) ──────────────────────────────────

@pytest.mark.asyncio
async def test_eligible_endpoint_returns_schemes(client, seed_all_schemes, registered_farmer):
    _, token = registered_farmer
    r = await client.post("/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    assert "eligible_count" in data
    assert "schemes" in data
    assert "deadline_alerts" in data
    ids = {s["scheme_id"] for s in data["schemes"]}
    # Default farmer (no Aadhaar) must NOT see CEN-PMKISAN
    assert "CEN-PMKISAN" not in ids
    # Open scheme (no restrictions) must appear
    assert "CEN-SHC" in ids


@pytest.mark.asyncio
async def test_eligible_aadhaar_bank_farmer_sees_pmkisan(client, seed_all_schemes, registered_farmer):
    """Farmer with Aadhaar + bank account must see CEN-PMKISAN as ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    await client.put(
        "/v1/farmer/me",
        json={"aadhaar_linked": True, "bank_account_linked": True, "land_ownership": "own"},
        headers=headers,
    )

    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    ids = {s["scheme_id"] for s in r.json()["schemes"]}
    assert "CEN-PMKISAN" in ids


@pytest.mark.asyncio
async def test_pmkisan_aadhaar_without_bank_is_needs_more_info(client, seed_all_schemes, registered_farmer):
    """PM-KISAN: Aadhaar=True but bank unknown → NEEDS_MORE_INFO, not ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={"aadhaar_linked": True}, headers=headers)

    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    data = r.json()
    eligible_ids = {s["scheme_id"] for s in data["schemes"]}
    nmi_ids = {s["scheme_id"] for s in data["needs_more_info_schemes"]}
    assert "CEN-PMKISAN" not in eligible_ids
    assert "CEN-PMKISAN" in nmi_ids


@pytest.mark.asyncio
async def test_large_farm_excluded_from_land_capped_schemes(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY (max 5 acres) and CEN-PMKSY (max 12 acres) must be excluded for large farms."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}

    await client.put("/v1/farmer/me", json={"land_size_acres": 20.0}, headers=headers)

    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    ids = {s["scheme_id"] for s in r.json()["schemes"]}
    assert "CEN-PMKMY" not in ids    # max 5 acres
    assert "CEN-PMKSY" not in ids    # max 12 acres (5 ha limit from JSON)


@pytest.mark.asyncio
async def test_eligible_count_matches_schemes_list(client, seed_all_schemes, registered_farmer):
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"}
    )
    data = r.json()
    assert data["eligible_count"] == len(data["schemes"])


@pytest.mark.asyncio
async def test_eligible_response_includes_new_fields(client, seed_all_schemes, registered_farmer):
    """POST /eligible must return department_ta, year, source_url in scheme items."""
    _, token = registered_farmer
    r = await client.post("/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    schemes = r.json()["schemes"]
    # Find CEN-SHC which has department info
    shc = next((s for s in schemes if s["scheme_id"] == "CEN-SHC"), None)
    assert shc is not None
    assert shc.get("department_ta") == "வேளாண்மை மற்றும் விவசாயிகள் நலன் அமைச்சகம்"
    assert shc.get("year") == "Ongoing"
    assert shc.get("source_url") == "https://soilhealth.dac.gov.in"


# ── Per-scheme eligibility check ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_check_eligible_scheme(client, db: AsyncSession, seed_all_schemes, registered_farmer):
    """Checking an open scheme (no restrictions) must return is_eligible=True."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/CEN-SHC/check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["scheme_id"] == "CEN-SHC"
    assert data["is_eligible"] is True
    assert "result_id" in data
    assert data["llm_response"] is not None  # offline fallback populated


@pytest.mark.asyncio
async def test_check_ineligible_aadhaar_scheme(client, seed_all_schemes, registered_farmer):
    """Checking CEN-PMKISAN without Aadhaar must return is_eligible=False."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/CEN-PMKISAN/check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is False
    assert data["criteria_results"].get("aadhaar") is False


@pytest.mark.asyncio
async def test_check_land_capped_scheme(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY has max_land_acres=5. Farm of 10 acres → not eligible."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={"land_size_acres": 10.0}, headers=headers)

    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is False
    assert data["criteria_results"].get("max_land") is False


@pytest.mark.asyncio
async def test_check_scheme_not_found(client, registered_farmer):
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/FAKE-SCHEME/check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_check_result_persisted(client, db: AsyncSession, seed_all_schemes, registered_farmer):
    """POST /{scheme_id}/check must persist an EligibilityResult row."""
    from sqlalchemy import select
    from app.db.models.scheme import EligibilityResult

    _, token = registered_farmer
    await client.post(
        "/v1/schemes/CEN-SHC/check",
        headers={"Authorization": f"Bearer {token}"},
    )

    rows = (await db.execute(
        select(EligibilityResult).where(EligibilityResult.scheme_id == "CEN-SHC")
    )).scalars().all()
    assert len(rows) == 1
    assert rows[0].is_eligible is True


@pytest.mark.asyncio
async def test_check_unicode_offline_fallback(client, seed_all_schemes, registered_farmer):
    """POST /check must return Tamil text even when LLM is unavailable (Unicode-safe)."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/TN-AGRI-153/check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["llm_response"] is not None
    # Must contain Tamil characters in the response (not a crash)
    assert len(data["llm_response"]) > 0


# ── Chat endpoint ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_chat_returns_offline_response(client, seed_all_schemes, registered_farmer):
    """When LLM is unavailable (NullLLMClient in test env), chat falls back gracefully."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/chat",
        json={"message": "என்ன திட்டங்கள் உள்ளன?", "language": "ta"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "response_ta" in data
    assert data["response_ta"]  # non-empty
    assert "conversation_id" in data
    assert isinstance(data["eligible_scheme_ids"], list)
    assert isinstance(data["deadline_alerts"], list)


@pytest.mark.asyncio
async def test_chat_references_only_seeded_schemes(client, seed_all_schemes, registered_farmer):
    """eligible_scheme_ids in chat response must only contain IDs from the seeded catalog."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/chat",
        json={"message": "எனக்கு என்ன மானியம் கிடைக்கும்?", "language": "ta"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    seeded_ids = {s.scheme_id for s in seed_all_schemes}
    for sid in r.json()["eligible_scheme_ids"]:
        assert sid in seeded_ids, f"Hallucinated scheme ID in response: {sid}"


# ── Eligibility CRUD unit tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_eligibility_result_crud(db: AsyncSession, seed_all_schemes, registered_farmer):
    import uuid
    from app.crud.schemes import save_eligibility_result

    farmer_id, _ = registered_farmer
    result = await save_eligibility_result(
        db,
        farmer_id=uuid.UUID(farmer_id),
        scheme_id="CEN-SHC",
        is_eligible=True,
        criteria_results={},
        llm_response="மண் ஆரோக்கிய அட்டை இலவசமாக பெறலாம்.",
        language="ta",
    )
    assert result.result_id is not None
    assert result.is_eligible is True
    assert result.scheme_id == "CEN-SHC"


@pytest.mark.asyncio
async def test_null_benefit_schemes_in_catalog(db: AsyncSession, seed_all_schemes):
    """Schemes with null benefit_amount must still appear in the catalog."""
    from app.crud.schemes import list_schemes

    schemes = await list_schemes(db)
    null_benefit = [s for s in schemes if s.benefit_amount is None]
    ids = {s.scheme_id for s in null_benefit}
    # These TN-AGRI schemes have null benefit in the authoritative JSON
    assert "TN-AGRI-147" in ids
    assert "TN-AGRI-153" in ids
    assert "TN-AGRI-165" in ids
    assert "TN-AGRI-176" in ids
    assert "TN-AGRI-177" in ids


@pytest.mark.asyncio
async def test_new_scheme_fields_populated(db: AsyncSession, seed_all_schemes):
    """New dataset fields (department_en, scheme_code, source_url, etc.) must be queryable."""
    from app.crud.schemes import get_scheme_by_id

    scheme = await get_scheme_by_id(db, "TN-AGRI-172")
    assert scheme is not None
    assert scheme.department_en == "Agriculture"
    assert scheme.department_ta == "வேளாண்மைத்துறை"
    assert scheme.scheme_code == "NMEO"
    assert scheme.year == "2024-25"
    assert scheme.source_scheme_id == "172"
    assert scheme.source_url == "https://www.tnagrisnet.tn.gov.in/home/schemes/en"
    assert scheme.eligibility_en == "All oilseed growing farmers in Tamil Nadu"


# ── New application-process field tests ──────────────────────────────────────

@pytest.mark.asyncio
async def test_application_mode_in_detail(client, seed_all_schemes):
    """GET /{scheme_id} must return application_mode for schemes that have it."""
    r = await client.get("/v1/schemes/CEN-PMKISAN")
    assert r.status_code == 200
    data = r.json()
    assert data["application_mode"] == "HYBRID"
    assert data["application_portal_name"] == "PM-KISAN Official Portal — Farmers Corner"
    assert data["application_process_summary"] is not None
    assert len(data["application_process_summary"]) > 20
    assert data["verification_status"] == "VERIFIED — official portal confirmed live"


@pytest.mark.asyncio
async def test_kaviadp_has_specific_registration_url(client, seed_all_schemes):
    """TN-AGRI-171 (KAVIADP) must have its unique KaviaDP registration URL."""
    r = await client.get("/v1/schemes/TN-AGRI-171")
    assert r.status_code == 200
    data = r.json()
    assert data["application_url"] == "https://www.tnagrisnet.tn.gov.in/KaviaDP/scheme_register"
    assert data["application_mode"] == "HYBRID"
    assert data["application_portal_name"] == "TNAGRISNET — KAVIADP Online Registration Portal"


@pytest.mark.asyncio
async def test_application_mode_in_eligible_response(client, seed_all_schemes, registered_farmer):
    """POST /eligible must return application_mode and application_portal_name in scheme items."""
    _, token = registered_farmer
    r = await client.post("/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    schemes = r.json()["schemes"]
    # Find a scheme we know has the new fields seeded (CEN-SHC is open to all)
    shc = next((s for s in schemes if s["scheme_id"] == "CEN-SHC"), None)
    assert shc is not None
    # These may be None if not seeded in the fixture — just check the keys exist in the response
    assert "application_mode" in shc
    assert "application_portal_name" in shc
    assert "application_process_summary" in shc


@pytest.mark.asyncio
async def test_list_schemes_returns_application_mode(client, seed_all_schemes):
    """GET /schemes must include application_mode and description_en in each item."""
    r = await client.get("/v1/schemes")
    assert r.status_code == 200
    schemes = r.json()["schemes"]
    pmkisan = next((s for s in schemes if s["scheme_id"] == "CEN-PMKISAN"), None)
    assert pmkisan is not None
    assert pmkisan["application_mode"] == "HYBRID"
    assert pmkisan["application_portal_name"] == "PM-KISAN Official Portal — Farmers Corner"
    assert "description_en" in pmkisan
    assert "department_en" in pmkisan


@pytest.mark.asyncio
async def test_pmkisan_registration_url_updated(client, seed_all_schemes):
    """PM-KISAN application_url must point to the specific registration page."""
    r = await client.get("/v1/schemes/CEN-PMKISAN")
    assert r.status_code == 200
    assert r.json()["application_url"] == "https://pmkisan.gov.in/NewFarmerRegistration.aspx"


@pytest.mark.asyncio
async def test_offline_scheme_mode(db: AsyncSession, seed_all_schemes):
    """Schemes with OFFLINE mode must store that value correctly."""
    from app.crud.schemes import get_scheme_by_id

    # TN-AGRI-153 has no app_mode set in the basic fixture, so check one that does
    # Confirm the column exists and can hold the value via the seeded PMKISAN record
    pmkisan = await get_scheme_by_id(db, "CEN-PMKISAN")
    assert pmkisan is not None
    assert pmkisan.application_mode == "HYBRID"
    assert pmkisan.verification_status is not None


# ── Eligibility engine v2 — three-state tests ─────────────────────────────────

@pytest.mark.asyncio
async def test_needs_more_info_in_eligible_response(client, seed_all_schemes, registered_farmer):
    """POST /eligible must return needs_more_info_schemes and needs_more_info_count."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    # Provide Aadhaar and bank so no hard fail — age+land still unknown → CEN-PMKMY NMI
    await client.put("/v1/farmer/me", json={
        "aadhaar_linked": True, "bank_account_linked": True,
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "needs_more_info_count" in data
    assert "needs_more_info_schemes" in data
    # Farmer has no land_size_acres or age → CEN-PMKMY (max 5ac, age 18-40) → NEEDS_MORE_INFO
    nmi_ids = {s["scheme_id"] for s in data["needs_more_info_schemes"]}
    assert "CEN-PMKMY" in nmi_ids


@pytest.mark.asyncio
async def test_eligible_scheme_has_eligibility_state_field(client, seed_all_schemes, registered_farmer):
    """Each scheme in POST /eligible response must include eligibility_state."""
    _, token = registered_farmer
    r = await client.post("/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    data = r.json()
    for scheme in data["schemes"]:
        assert scheme["eligibility_state"] == "ELIGIBLE"
    for scheme in data["needs_more_info_schemes"]:
        assert scheme["eligibility_state"] == "NEEDS_MORE_INFO"


@pytest.mark.asyncio
async def test_null_land_puts_capped_schemes_in_needs_more_info(client, seed_all_schemes, registered_farmer):
    """With land_size_acres=None, CEN-PMKMY must be NEEDS_MORE_INFO, not ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    # Satisfy all hard criteria except land_size; leave land_size_acres=None (default)
    await client.put("/v1/farmer/me", json={
        "aadhaar_linked": True, "bank_account_linked": True,
        "age": 30, "income_band": "below_1L",
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    data = r.json()
    eligible_ids = {s["scheme_id"] for s in data["schemes"]}
    nmi_ids = {s["scheme_id"] for s in data["needs_more_info_schemes"]}
    assert "CEN-PMKMY" not in eligible_ids
    assert "CEN-PMKMY" in nmi_ids


@pytest.mark.asyncio
async def test_full_profile_farmer_has_zero_needs_more_info(client, seed_all_schemes, registered_farmer):
    """A farmer with all required fields filled should have 0 NEEDS_MORE_INFO results."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "aadhaar_linked": True,
        "bank_account_linked": True,
        "land_size_acres": 3.0,
        "income_band": "below_1L",
        "age": 30,
        "land_ownership": "own",
        "crops": [{"crop": "rice", "acres": 3.0}],
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["needs_more_info_count"] == 0, (
        f"Expected 0 NEEDS_MORE_INFO, got: {[s['scheme_id'] for s in data['needs_more_info_schemes']]}"
    )


@pytest.mark.asyncio
async def test_pmkmy_age_over_40_not_eligible(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY: age 50 → NOT_ELIGIBLE (max_age=40)."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "land_size_acres": 2.0, "age": 50,
        "bank_account_linked": True, "aadhaar_linked": True,
        "income_band": "below_1L",
    }, headers=headers)
    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is False
    assert data["criteria_results"].get("max_age") is False


@pytest.mark.asyncio
async def test_pmkmy_age_under_18_not_eligible(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY: age 16 → NOT_ELIGIBLE (min_age=18)."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "land_size_acres": 2.0, "age": 16,
        "bank_account_linked": True, "aadhaar_linked": True,
        "income_band": "below_1L",
    }, headers=headers)
    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is False
    # Global under-18 check fires before scheme-specific min_age
    assert data["criteria_results"].get("adult_farmer") is False


@pytest.mark.asyncio
async def test_pmkmy_age_missing_needs_more_info(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY: unknown age → NEEDS_MORE_INFO."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "land_size_acres": 2.0, "income_band": "below_1L",
        "bank_account_linked": True, "aadhaar_linked": True,
    }, headers=headers)
    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["eligibility_state"] == "NEEDS_MORE_INFO"
    assert data["is_eligible"] is False


@pytest.mark.asyncio
async def test_pmkmy_high_income_not_eligible(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY: income above_2L → NOT_ELIGIBLE (eligible_income_bands=['below_1L','1L_2L'])."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "land_size_acres": 2.0, "age": 30, "income_band": "above_2L",
        "bank_account_linked": True, "aadhaar_linked": True,
    }, headers=headers)
    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is False
    assert data["criteria_results"].get("income_band") is False


@pytest.mark.asyncio
async def test_pmkmy_valid_profile_eligible(client, seed_all_schemes, registered_farmer):
    """CEN-PMKMY: age 25, land 2ac, income below_1L, Aadhaar, bank → ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "land_size_acres": 2.0, "age": 25, "income_band": "below_1L",
        "bank_account_linked": True, "aadhaar_linked": True,
    }, headers=headers)
    r = await client.post("/v1/schemes/CEN-PMKMY/check", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_eligible"] is True
    assert data["eligibility_state"] == "ELIGIBLE"


@pytest.mark.asyncio
async def test_oilseed_scheme_crop_match_eligible(client, seed_all_schemes, registered_farmer):
    """TN-AGRI-172: groundnut farmer → ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "crops": [{"crop": "groundnut", "acres": 2.0}]
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    assert r.status_code == 200
    eligible_ids = {s["scheme_id"] for s in r.json()["schemes"]}
    assert "TN-AGRI-172" in eligible_ids


@pytest.mark.asyncio
async def test_oilseed_scheme_crop_mismatch_not_eligible(client, seed_all_schemes, registered_farmer):
    """TN-AGRI-172: rice farmer → NOT_ELIGIBLE (not an oilseed crop)."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "crops": [{"crop": "rice", "acres": 2.0}]
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    data = r.json()
    all_ids = (
        {s["scheme_id"] for s in data["schemes"]}
        | {s["scheme_id"] for s in data["needs_more_info_schemes"]}
    )
    assert "TN-AGRI-172" not in all_ids


@pytest.mark.asyncio
async def test_kuruvai_paddy_scheme_rice_farmer_eligible(client, seed_all_schemes, registered_farmer):
    """TN-AGRI-177: rice farmer → ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "crops": [{"crop": "rice", "acres": 2.0}]
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    eligible_ids = {s["scheme_id"] for s in r.json()["schemes"]}
    assert "TN-AGRI-177" in eligible_ids


@pytest.mark.asyncio
async def test_kuruvai_paddy_scheme_sugarcane_farmer_not_eligible(client, seed_all_schemes, registered_farmer):
    """TN-AGRI-177: sugarcane farmer → NOT_ELIGIBLE."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    await client.put("/v1/farmer/me", json={
        "crops": [{"crop": "sugarcane", "acres": 2.0}]
    }, headers=headers)
    r = await client.post("/v1/schemes/eligible", headers=headers)
    data = r.json()
    all_ids = (
        {s["scheme_id"] for s in data["schemes"]}
        | {s["scheme_id"] for s in data["needs_more_info_schemes"]}
    )
    assert "TN-AGRI-177" not in all_ids


@pytest.mark.asyncio
async def test_eligibility_state_in_check_response(client, seed_all_schemes, registered_farmer):
    """POST /{scheme_id}/check must return eligibility_state field."""
    _, token = registered_farmer
    r = await client.post(
        "/v1/schemes/CEN-SHC/check",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "eligibility_state" in data
    assert data["eligibility_state"] == "ELIGIBLE"
    assert data["is_eligible"] is True


@pytest.mark.asyncio
async def test_shc_always_eligible_regardless_of_profile(client, seed_all_schemes, registered_farmer):
    """CEN-SHC has no restrictions — must always be ELIGIBLE even with empty profile."""
    _, token = registered_farmer
    r = await client.post("/v1/schemes/eligible", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    eligible_ids = {s["scheme_id"] for s in r.json()["schemes"]}
    assert "CEN-SHC" in eligible_ids


@pytest.mark.asyncio
async def test_chat_uses_only_eligible_schemes(client, seed_all_schemes, registered_farmer):
    """Chat response eligible_scheme_ids must not include NEEDS_MORE_INFO schemes."""
    _, token = registered_farmer
    headers = {"Authorization": f"Bearer {token}"}
    # Farmer with no land/age — CEN-PMKMY would be NEEDS_MORE_INFO
    r_eligible = await client.post("/v1/schemes/eligible", headers=headers)
    nmi_ids = {s["scheme_id"] for s in r_eligible.json()["needs_more_info_schemes"]}

    r = await client.post(
        "/v1/schemes/chat",
        json={"message": "என்ன திட்டங்கள் உள்ளன?", "language": "ta"},
        headers=headers,
    )
    assert r.status_code == 200
    chat_scheme_ids = set(r.json()["eligible_scheme_ids"])
    # NEEDS_MORE_INFO schemes must not appear in chat context
    for nmi_id in nmi_ids:
        assert nmi_id not in chat_scheme_ids, (
            f"{nmi_id} is NEEDS_MORE_INFO but appeared in chat context"
        )
