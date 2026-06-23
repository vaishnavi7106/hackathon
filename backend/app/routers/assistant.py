"""Global AI Farm Assistant — context-aware, Tamil-first, covers all 5 pillars."""
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import CurrentFarmerDep, LLMClientDep

router = APIRouter(prefix="/assistant", tags=["assistant"])

# ---------------------------------------------------------------------------
# System prompt — global farming assistant, NOT limited to schemes
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """நீங்கள் "உழவர் AI" — தமிழ்நாடு விவசாயிகளின் AI தோழர்.

கண்டிப்பான விதிகள்:
1. எப்போதும் தமிழில் மட்டுமே பதில் சொல்லவும். ஆங்கிலம் வேண்டாம்.
2. Mobile screen கருதி 200 வார்த்தைகளுக்குள் சுருக்கமாக இருக்கவும்.
3. கொடுக்கப்பட்ட FARMER CONTEXT மட்டும் உபயோகிக்கவும். புனைவு சொல்லவேண்டாம்.
4. தகவல் இல்லாவிட்டால் "என்னிடம் இந்த தகவல் இல்லை" என்று சொல்லவும்.
5. எப்போதும் நடவடிக்கை-சார்ந்த (what to DO) பதில் சொல்லவும்.
6. விவசாயியை அன்போடு "நண்பரே" என்று அழைக்கவும்.

கவரேஜ்:
- பயிர் நோய் & சிகிச்சை (Crop Sentinel)
- மண் & நீர்பாசனம் & உரம் (Soil & Water)
- சந்தை விலை & விற்கணுமா காக்கணுமா (Market)
- அரசு திட்டங்கள் & சலுகைகள் (Government Schemes)
- வானிலை & இன்றைய பணிகள் (Today's Tasks)"""


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AssistantChatRequest(BaseModel):
    message: str
    farmer_context: str = ""
    conversation_id: str | None = None


class AssistantChatResponse(BaseModel):
    response: str
    conversation_id: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=AssistantChatResponse)
async def assistant_chat(
    req: AssistantChatRequest,
    farmer: CurrentFarmerDep,
    llm: LLMClientDep,
) -> AssistantChatResponse:
    conv_id = req.conversation_id or str(uuid.uuid4())

    context_block = req.farmer_context.strip()
    user_prompt = (
        f"விவசாயி: {farmer.name or 'நண்பர்'}\n"
        f"மாவட்டம்: {farmer.district or 'அறியப்படவில்லை'}\n"
        + (f"\nFARMER CONTEXT:\n{context_block}\n" if context_block else "")
        + f"\nகேள்வி: {req.message}"
    )

    try:
        response = await llm.generate(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=700,
        )
    except Exception:
        response = (
            "மன்னிக்கவும் நண்பரே, இப்போது பதில் சொல்ல முடியவில்லை. "
            "சில நிமிடங்கள் கழித்து மீண்டும் கேளுங்கள்."
        )

    return AssistantChatResponse(response=response, conversation_id=conv_id)
