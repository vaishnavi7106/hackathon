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
    get_eligible_schemes,
    get_scheme_by_id,
)
from app.deps import CurrentFarmerDep, DbDep, LLMClientDep
from app.exceptions import NotFoundError
from app.schemas.schemes import (
    DeadlineAlert,
    EligibleSchemeOut,
    EligibleSchemesResponse,
    SchemeChatRequest,
    SchemeChatResponse,
    SchemeDetailOut,
)

logger = structlog.get_logger()

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


# ---------------------------------------------------------------------------
# Prompt helpers (private — business logic only, no SDK imports)
# ---------------------------------------------------------------------------


def _build_user_prompt(farmer_name: str, query: str, schemes: list[dict]) -> str:
    scheme_lines = []
    for s in schemes:
        docs = ", ".join(s.get("documents_ta") or s.get("documents_required") or [])
        scheme_lines.append(
            f"ID: {s['scheme_id']} | {s['name_ta']} ({s['name_en']})\n"
            f"  பயன்: {s.get('benefit_amount', '-')} | "
            f"கடைசி தேதி: {s.get('application_deadline', 'rolling')}\n"
            f"  தகுதி: {s.get('eligibility_ta') or s.get('description_ta', '')}\n"
            f"  ஆவணங்கள்: {docs}\n"
            f"  விண்ணப்பிக்க: {s.get('application_url', 'மாவட்ட விவசாய அலுவலகம்')}"
        )

    schemes_block = "\n\n".join(scheme_lines) if scheme_lines else "தகுதியான திட்டங்கள் எதுவும் இல்லை."

    return (
        f"விவசாயி பெயர்: {farmer_name}\n"
        f"கேள்வி: {query}\n\n"
        f"<schemes>\n{schemes_block}\n</schemes>"
    )


def _offline_response(schemes: list[dict], language: str) -> str:
    """Fallback when the LLM is unavailable."""
    if not schemes:
        if language == "ta":
            return "உங்கள் சுயவிவரத்தின் படி தற்போது தகுதியான திட்டங்கள் எதுவும் இல்லை."
        return "No eligible schemes found for your profile at this time."

    count = len(schemes)
    names = ", ".join(s.get("name_ta") or s.get("name_en", "") for s in schemes[:3])
    if language == "ta":
        return (
            f"உங்களுக்கு {count} திட்டங்களில் தகுதி உள்ளது: {names}. "
            "இணைய இணைப்பு இல்லாததால் முழு விவரம் தர இயலவில்லை. "
            "மாவட்ட விவசாய அலுவலகத்தை தொடர்பு கொள்ளவும்."
        )
    return (
        f"You are eligible for {count} scheme(s): {names}. "
        "Full details unavailable offline. Please contact your District Agriculture Office."
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/eligible", response_model=EligibleSchemesResponse)
async def get_eligible(farmer: CurrentFarmerDep, db: DbDep):
    crops = [c.crop for c in (farmer.crops or [])]
    schemes = await get_eligible_schemes(
        db,
        land_acres=float(farmer.land_size_acres) if farmer.land_size_acres else None,
        aadhaar_linked=farmer.aadhaar_linked,
        crops=crops,
        district=farmer.district,
    )
    alerts_raw = get_deadline_alerts(schemes)

    scheme_outs = [
        EligibleSchemeOut(
            scheme_id=s.scheme_id,
            name_ta=s.name_ta,
            name_en=s.name_en,
            benefit_amount=s.benefit_amount,
            benefit_amount_num=float(s.benefit_amount_num) if s.benefit_amount_num else None,
            application_deadline=s.application_deadline,
            deadline_urgent=any(
                a["scheme_id"] == s.scheme_id and a["urgent"] for a in alerts_raw
            ),
            documents_required=s.documents_required or [],
            application_url=s.application_url,
            description_ta=s.description_ta,
        )
        for s in schemes
    ]

    deadline_alerts = [
        DeadlineAlert(
            scheme_id=a["scheme_id"],
            name_ta=a["name_ta"],
            deadline=a["deadline"],
            days_remaining=a["days_remaining"],
            urgent=a["urgent"],
        )
        for a in alerts_raw
    ]

    return EligibleSchemesResponse(
        eligible_count=len(scheme_outs),
        schemes=scheme_outs,
        deadline_alerts=deadline_alerts,
    )


@router.post("/chat", response_model=SchemeChatResponse, status_code=status.HTTP_200_OK)
async def chat(body: SchemeChatRequest, farmer: CurrentFarmerDep, db: DbDep, llm: LLMClientDep):
    crops = [c.crop for c in (farmer.crops or [])]
    eligible_schemes = await get_eligible_schemes(
        db,
        land_acres=float(farmer.land_size_acres) if farmer.land_size_acres else None,
        aadhaar_linked=farmer.aadhaar_linked,
        crops=crops,
        district=farmer.district,
    )

    schemes_for_llm = [
        {
            "scheme_id": s.scheme_id,
            "name_en": s.name_en,
            "name_ta": s.name_ta,
            "benefit_amount": s.benefit_amount,
            "application_deadline": s.application_deadline,
            "description_ta": s.description_ta,
            "eligibility_ta": s.eligibility_ta,
            "documents_required": s.documents_required,
            "documents_ta": s.documents_ta,
            "application_url": s.application_url,
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
        logger.warning("llm_generate_failed", error=str(exc))
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
