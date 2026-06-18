"""Pillar 4 — Government Navigator router.

LLM usage is provider-agnostic: the router depends on LLMClient, never on
any vendor SDK. Swapping Gemini for OpenAI/Anthropic/Ollama requires only a
change to LLM_PROVIDER in the environment — nothing here changes.
"""

import time
import uuid

import structlog
from fastapi import APIRouter, status

from app.crud.schemes import (
    create_scheme_query,
    get_deadline_alerts,
    get_scheme_by_id,
    list_schemes,
    save_eligibility_result,
)
from app.deps import CurrentFarmerDep, DbDep, LLMClientDep
from app.exceptions import NotFoundError
from app.schemas.schemes import (
    DeadlineAlert,
    EligibleSchemeOut,
    EligibleSchemesResponse,
    EligibilityResultOut,
    SchemeChatRequest,
    SchemeChatResponse,
    SchemeCheckRequest,
    SchemeDetailOut,
    SchemeListResponse,
)

logger = structlog.get_logger()

# Router registered at /v1 in main.py, so all paths here are /schemes/...
router = APIRouter(prefix="/schemes", tags=["schemes"])

# ---------------------------------------------------------------------------
# System prompt — defines the LLM's role and hard constraints.
# Lives here (not in llm_client.py) because it is Government Navigator
# business logic, not a concern of the LLM transport layer.
# ---------------------------------------------------------------------------

_SCHEMES_SYSTEM_PROMPT = """நீங்கள் தமிழ்நாடு விவசாயிகளுக்கு அரசு திட்ட ஆலோசகர். (You are a Tamil Nadu agricultural scheme advisor.)

STRICT RULES:
1. Always respond in Tamil unless the user explicitly asks for English.
2. NEVER mention any scheme not present in the provided <schemes> context. If asked about unknown schemes, say "அந்த திட்டம் பற்றி எனக்கு தகவல் இல்லை."
3. Always give a clear eligibility verdict: தகுதி உண்டு (ELIGIBLE) / தகுதி இல்லை (NOT ELIGIBLE) / கூடுதல் தகவல் தேவை (NEED MORE INFO).
4. Always list exact documents required and the application URL.
5. If any scheme deadline is within 30 days, start your response with: "⚠️ அவசரம்! [scheme name] விண்ணப்ப கடைசி தேதி [date] — உடனே விண்ணப்பிக்கவும்."
6. Keep responses under 150 words. Farmers read on mobile with small screens.
7. Address the farmer warmly by name if provided.
8. Never fabricate benefit amounts, deadlines, or document requirements."""

_EXPLAIN_SYSTEM_PROMPT = """நீங்கள் தமிழ்நாடு விவசாய திட்ட ஆலோசகர். கொடுக்கப்பட்ட திட்டம் மற்றும் விவசாயியின் தகுதி அடிப்படையில் சுருக்கமான விளக்கம் தமிழில் கொடுங்கள். 100 வார்த்தைகளுக்கு உள்ளே வைக்கவும்."""


# ---------------------------------------------------------------------------
# Eligibility helpers (deterministic — no LLM involved)
# ---------------------------------------------------------------------------

def _check_scheme_criteria(scheme, farmer) -> tuple[dict, str]:
    """Deterministic per-criterion eligibility check.

    Returns (criteria_results, state) where state is one of:
      ELIGIBLE         — all defined criteria pass
      NOT_ELIGIBLE     — at least one criterion fails
      NEEDS_MORE_INFO  — no criterion fails but farmer is missing a required field
    """
    criteria: dict[str, bool] = {}
    missing: set[str] = set()

    # Global baseline: all government agricultural schemes require an adult (18+).
    # If age is known and under 18, fail immediately without checking other criteria.
    farmer_age = getattr(farmer, "age", None)
    if farmer_age is not None and int(farmer_age) < 18:
        return {"adult_farmer": False}, "NOT_ELIGIBLE"

    land_acres = float(farmer.land_size_acres) if farmer.land_size_acres else None

    # Land cap — only apply when the scheme has a restriction
    if scheme.max_land_acres is not None:
        if land_acres is None:
            missing.add("land_size")
        else:
            criteria["max_land"] = land_acres <= float(scheme.max_land_acres)

    if scheme.min_land_acres and float(scheme.min_land_acres) > 0:
        if land_acres is None:
            missing.add("land_size")
        else:
            criteria["min_land"] = land_acres >= float(scheme.min_land_acres)

    # Aadhaar — non-null bool on Farmer (default False), always known
    if scheme.requires_aadhaar:
        criteria["aadhaar"] = farmer.aadhaar_linked

    # Bank account
    if getattr(scheme, "requires_bank_account", False):
        bank = getattr(farmer, "bank_account_linked", None)
        if bank is None:
            missing.add("bank_account")
        else:
            criteria["bank_account"] = bank

    # Age constraints
    farmer_age = getattr(farmer, "age", None)
    if getattr(scheme, "min_age", None) is not None:
        if farmer_age is None:
            missing.add("age")
        else:
            criteria["min_age"] = int(farmer_age) >= scheme.min_age
    if getattr(scheme, "max_age", None) is not None:
        if farmer_age is None:
            missing.add("age")
        else:
            criteria["max_age"] = int(farmer_age) <= scheme.max_age

    # Crop match — case-insensitive set intersection
    farmer_crops_lower = {c.crop.lower() for c in (farmer.crops or [])}
    if scheme.eligible_crops:
        scheme_crops_lower = {c.lower() for c in scheme.eligible_crops}
        if not farmer_crops_lower:
            missing.add("crops")
        else:
            criteria["crop_match"] = bool(farmer_crops_lower & scheme_crops_lower)

    # District match
    if scheme.eligible_districts:
        if not farmer.district:
            missing.add("district")
        else:
            criteria["district_match"] = farmer.district in scheme.eligible_districts

    # Land ownership
    if getattr(scheme, "eligible_land_ownership", None):
        ownership = getattr(farmer, "land_ownership", None)
        if not ownership:
            missing.add("land_ownership")
        else:
            criteria["land_ownership"] = ownership in scheme.eligible_land_ownership

    # Income band
    if scheme.eligible_income_bands:
        if not farmer.income_band:
            missing.add("income_band")
        else:
            criteria["income_band"] = farmer.income_band in scheme.eligible_income_bands

    # Derive state — a definitive failure takes priority over missing data
    if any(not v for v in criteria.values()):
        state = "NOT_ELIGIBLE"
    elif missing:
        state = "NEEDS_MORE_INFO"
    else:
        state = "ELIGIBLE"

    return criteria, state


def _build_explain_prompt(farmer_name: str, scheme, criteria: dict, state: str) -> str:
    if state == "ELIGIBLE":
        verdict = "தகுதி உண்டு ✓"
    elif state == "NOT_ELIGIBLE":
        verdict = "தகுதி இல்லை ✗"
    else:
        verdict = "கூடுதல் தகவல் தேவை ⚠️"
    docs = ", ".join(scheme.documents_required or []) or "விண்ணப்பிக்கவும்"
    criteria_lines = "\n".join(
        f"  {k}: {'✓' if v else '✗'}" for k, v in criteria.items()
    ) or "  (அனைத்து அடிப்படை தகுதிகள் பூர்த்தி)"
    return (
        f"விவசாயி: {farmer_name}\n"
        f"திட்டம்: {scheme.name_ta} ({scheme.scheme_id})\n"
        f"தீர்ப்பு: {verdict}\n"
        f"அளவுகோல்கள்:\n{criteria_lines}\n"
        f"ஆவணங்கள்: {docs}\n"
        f"விண்ணப்ப URL: {scheme.application_url or 'மாவட்ட விவசாய அலுவலகம்'}\n\n"
        f"சுருக்கமான விளக்கம் தமிழில் தரவும்."
    )


# ---------------------------------------------------------------------------
# Prompt helpers (for /chat)
# ---------------------------------------------------------------------------

def _build_user_prompt(farmer_name: str, query: str, schemes: list[dict]) -> str:
    # Keep prompt small to stay within free-tier token limits (~800 tokens total).
    # Send at most 8 schemes; each line: id|name|benefit|apply_url
    top = schemes[:8]
    scheme_lines = []
    for s in top:
        url = s.get("application_url") or "மாவட்ட விவசாய அலுவலகம்"
        benefit = (s.get("benefit_amount") or "-")[:80]
        scheme_lines.append(
            f"{s['scheme_id']}|{s['name_ta']}|{benefit}|{url}"
        )

    schemes_block = "\n".join(scheme_lines) if scheme_lines else "தகுதியான திட்டங்கள் எதுவும் இல்லை."

    return (
        f"விவசாயி: {farmer_name}\n"
        f"கேள்வி: {query}\n\n"
        f"<schemes>\n{schemes_block}\n</schemes>"
    )


def _offline_response(schemes: list[dict], language: str) -> str:
    """Fallback when the LLM call fails (rate limit, network, etc.)."""
    if not schemes:
        if language == "ta":
            return "உங்கள் சுயவிவரத்தின் படி தற்போது தகுதியான திட்டங்கள் எதுவும் இல்லை."
        return "No eligible schemes found for your profile at this time."

    count = len(schemes)
    names = ", ".join(s.get("name_ta") or s.get("name_en", "") for s in schemes[:3])
    if language == "ta":
        return (
            f"AI ஆலோசகர் இப்போது பதில் சொல்ல முடியவில்லை (தினசரி வரம்பு). "
            f"ஆனால் உங்களுக்கு {count} திட்டங்களில் தகுதி உள்ளது — "
            f"உதாரணமாக: {names}. "
            "சில நிமிடங்கள் கழித்து மீண்டும் கேளுங்கள், அல்லது திட்டங்கள் பட்டியல் பார்க்கவும்."
        )
    return (
        f"AI advisor is busy right now (daily limit reached). "
        f"You are eligible for {count} scheme(s) — top picks: {names}. "
        "Please try again in a few minutes, or browse the schemes list."
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=SchemeListResponse)
async def list_all_schemes(db: DbDep, level: str | None = None, active_only: bool = True):
    """List all schemes in the catalog (no auth required)."""
    schemes = await list_schemes(db, active_only=active_only, level=level)
    return SchemeListResponse(
        total=len(schemes),
        schemes=[
            EligibleSchemeOut(
                scheme_id=s.scheme_id,
                name_ta=s.name_ta,
                name_en=s.name_en,
                level=s.level,
                benefit_amount=s.benefit_amount,
                benefit_amount_ta=s.benefit_amount_ta,
                benefit_amount_num=float(s.benefit_amount_num) if s.benefit_amount_num else None,
                application_deadline=s.application_deadline,
                deadline_urgent=False,
                documents_required=s.documents_required or [],
                documents_ta=s.documents_ta,
                application_url=s.application_url,
                application_mode=s.application_mode,
                application_portal_name=s.application_portal_name,
                application_process_summary=s.application_process_summary,
                description_ta=s.description_ta,
                description_en=s.description_en,
                eligibility_ta=s.eligibility_ta,
                department_ta=s.department_ta,
                department_en=s.department_en,
                year=s.year,
                source_url=s.source_url,
            )
            for s in schemes
        ],
    )


@router.post("/eligible", response_model=EligibleSchemesResponse)
async def get_eligible(farmer: CurrentFarmerDep, db: DbDep):
    all_schemes = await list_schemes(db)

    eligible_schemes = []
    nmi_schemes = []
    for s in all_schemes:
        _, state = _check_scheme_criteria(s, farmer)
        if state == "ELIGIBLE":
            eligible_schemes.append(s)
        elif state == "NEEDS_MORE_INFO":
            nmi_schemes.append(s)

    alerts_raw = get_deadline_alerts(eligible_schemes)

    def _to_out(s, state: str) -> EligibleSchemeOut:
        return EligibleSchemeOut(
            scheme_id=s.scheme_id,
            name_ta=s.name_ta,
            name_en=s.name_en,
            level=s.level,
            benefit_amount=s.benefit_amount,
            benefit_amount_ta=s.benefit_amount_ta,
            benefit_amount_num=float(s.benefit_amount_num) if s.benefit_amount_num else None,
            application_deadline=s.application_deadline,
            deadline_urgent=any(
                a["scheme_id"] == s.scheme_id and a["urgent"] for a in alerts_raw
            ),
            documents_required=s.documents_required or [],
            documents_ta=s.documents_ta,
            application_url=s.application_url,
            application_mode=s.application_mode,
            application_portal_name=s.application_portal_name,
            application_process_summary=s.application_process_summary,
            description_ta=s.description_ta,
            description_en=s.description_en,
            eligibility_ta=s.eligibility_ta,
            department_ta=s.department_ta,
            department_en=s.department_en,
            year=s.year,
            source_url=s.source_url,
            eligibility_state=state,
        )

    return EligibleSchemesResponse(
        eligible_count=len(eligible_schemes),
        schemes=[_to_out(s, "ELIGIBLE") for s in eligible_schemes],
        needs_more_info_count=len(nmi_schemes),
        needs_more_info_schemes=[_to_out(s, "NEEDS_MORE_INFO") for s in nmi_schemes],
        deadline_alerts=[
            DeadlineAlert(
                scheme_id=a["scheme_id"],
                name_ta=a["name_ta"],
                deadline=a["deadline"],
                days_remaining=a["days_remaining"],
                urgent=a["urgent"],
            )
            for a in alerts_raw
        ],
    )


@router.post("/{scheme_id}/check", response_model=EligibilityResultOut)
async def check_scheme_eligibility(
    scheme_id: str,
    farmer: CurrentFarmerDep,
    db: DbDep,
    llm: LLMClientDep,
    body: SchemeCheckRequest | None = None,
):
    """Check if the authenticated farmer is eligible for a specific scheme.

    Returns a persisted EligibilityResult with per-criterion breakdown and
    an LLM-generated Tamil explanation (falls back to a rule-based message
    when the LLM is unavailable).
    """
    scheme = await get_scheme_by_id(db, scheme_id)
    if scheme is None:
        raise NotFoundError("Scheme", detail_ta="இந்த திட்டம் கிடைக்கவில்லை.")

    language = body.language if body else "ta"
    criteria, state = _check_scheme_criteria(scheme, farmer)
    is_eligible = state == "ELIGIBLE"

    prompt = _build_explain_prompt(
        farmer_name=farmer.name or "விவசாயி",
        scheme=scheme,
        criteria=criteria,
        state=state,
    )

    start = time.monotonic()
    try:
        llm_response = await llm.generate(
            system_prompt=_EXPLAIN_SYSTEM_PROMPT,
            user_prompt=prompt,
            max_tokens=500,
        )
    except Exception as exc:
        logger.warning("llm_generate_failed_check", error=type(exc).__name__, detail=str(exc)[:300])
        if state == "ELIGIBLE":
            llm_response = (
                f"{scheme.name_ta} திட்டத்தில் உங்களுக்கு தகுதி உண்டு. "
                f"{scheme.eligibility_ta or ''} "
                f"விண்ணப்பிக்க: {scheme.application_url or 'மாவட்ட விவசாய அலுவலகம்'}"
            ).strip()
        elif state == "NEEDS_MORE_INFO":
            llm_response = (
                f"உங்கள் சுயவிவரம் முழுமையடையவில்லை. {scheme.name_ta} திட்டத்திற்கான "
                "தகுதியை சரிபார்க்க மேலும் தகவல்கள் தேவை. "
                "சுயவிவரப் பக்கத்தில் வயது, நில அளவு, வங்கி கணக்கு தகவல்களை நிரப்பவும்."
            )
        else:
            llm_response = (
                f"{scheme.name_ta} திட்டத்தில் உங்களுக்கு தகுதி இல்லை. "
                "மேலும் விவரங்களுக்கு மாவட்ட விவசாய அலுவலகத்தை தொடர்பு கொள்ளவும்."
            )
    latency_ms = int((time.monotonic() - start) * 1000)

    # Snapshot the deadline for this check
    deadline_date = scheme.application_deadline_date
    days_to_deadline = None
    if deadline_date:
        from datetime import date as _date
        days_to_deadline = (deadline_date - _date.today()).days

    result = await save_eligibility_result(
        db,
        farmer_id=farmer.farmer_id,
        scheme_id=scheme_id,
        is_eligible=is_eligible,
        eligibility_state=state,
        criteria_results=criteria,
        llm_response=llm_response,
        language=language,
        latency_ms=latency_ms,
        deadline_date=deadline_date,
        days_to_deadline=days_to_deadline,
    )
    return result


@router.post("/chat", response_model=SchemeChatResponse, status_code=status.HTTP_200_OK)
async def chat(body: SchemeChatRequest, farmer: CurrentFarmerDep, db: DbDep, llm: LLMClientDep):
    all_schemes = await list_schemes(db)
    eligible_schemes = [
        s for s in all_schemes
        if _check_scheme_criteria(s, farmer)[1] == "ELIGIBLE"
    ]

    schemes_for_llm = [
        {
            "scheme_id": s.scheme_id,
            "name_en": s.name_en,
            "name_ta": s.name_ta,
            "benefit_amount": s.benefit_amount,
            "application_deadline": s.application_deadline,
            "description_ta": s.description_ta,
            "description_en": s.description_en,
            "eligibility_ta": s.eligibility_ta,
            "eligibility_en": s.eligibility_en,
            "documents_required": s.documents_required,
            "documents_ta": s.documents_ta,
            "application_url": s.application_url,
            "application_mode": s.application_mode,
            "application_portal_name": s.application_portal_name,
            "application_process_summary": s.application_process_summary,
            "department_ta": s.department_ta,
            "year": s.year,
            "source_url": s.source_url,
        }
        for s in eligible_schemes
    ]

    user_prompt = _build_user_prompt(
        farmer_name=farmer.name or "விவசாயி",
        query=body.message,
        schemes=schemes_for_llm,
    )

    start = time.monotonic()
    try:
        response_text = await llm.generate(
            system_prompt=_SCHEMES_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
    except Exception as exc:
        logger.warning("llm_generate_failed", error=type(exc).__name__, detail=str(exc)[:300])
        response_text = _offline_response(schemes_for_llm, body.language)
    latency_ms = int((time.monotonic() - start) * 1000)

    alerts_raw = get_deadline_alerts(eligible_schemes)
    conversation_id = body.conversation_id or uuid.uuid4()

    await create_scheme_query(
        db,
        farmer_id=farmer.farmer_id,
        query_text=body.message,
        language=body.language,
        schemes_ctx=[s["scheme_id"] for s in schemes_for_llm],
        llm_response=response_text,
        latency_ms=latency_ms,
    )

    return SchemeChatResponse(
        conversation_id=conversation_id,
        response_ta=response_text,
        eligible_scheme_ids=[s["scheme_id"] for s in schemes_for_llm],
        deadline_alerts=[
            DeadlineAlert(
                scheme_id=a["scheme_id"],
                name_ta=a["name_ta"],
                deadline=a["deadline"],
                days_remaining=a["days_remaining"],
                urgent=a["urgent"],
            )
            for a in alerts_raw
        ],
        latency_ms=latency_ms,
    )


@router.get("/{scheme_id}", response_model=SchemeDetailOut)
async def get_scheme(scheme_id: str, db: DbDep):
    scheme = await get_scheme_by_id(db, scheme_id)
    if scheme is None:
        raise NotFoundError("Scheme", detail_ta="இந்த திட்டம் கிடைக்கவில்லை.")
    return scheme
