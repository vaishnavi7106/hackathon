"""Groq LLM explanation layer for Pillar 2 prescriptions.

IMPORTANT: The LLM is ONLY used to explain the prescription in plain language.
It does NOT calculate NPK values. All numbers come from the TNAU lookup engine.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_FALLBACK: dict[str, str] = {
    "ta": (
        "AI விளக்கம் தற்போது கிடைக்கவில்லை. "
        "மேலே காட்டப்பட்ட உர பரிந்துரை TNAU பயிர் உற்பத்தி வழிகாட்டி 2020-ல் இருந்து "
        "எடுக்கப்பட்டது — இது நம்பகமான அரசாங்க மூலம். "
        "மாவட்ட விவசாய அலுவலகத்தை தொடர்பு கொள்ளவும்."
    ),
    "en": (
        "AI explanation temporarily unavailable. "
        "The fertilizer prescription shown above is correct and sourced from "
        "TNAU Crop Production Guide 2020 — a verified government publication. "
        "Please verify with your local district agriculture office."
    ),
}

_SYSTEM_PROMPT_TEMPLATE = """You are an agricultural advisor assistant for Tamil Nadu farmers.
You MUST use ONLY the numbers provided in the prescription data below.
Do NOT calculate, adjust, or invent any values. Do NOT add advice beyond what is in the data.
Your only job is to explain the prescription clearly.
Respond in {lang_name}. Use simple words a farmer with Class 6 education can understand.
Maximum 4 sentences total. Be direct. Do not start with "Vanakkam" or greetings."""

_USER_PROMPT_TEMPLATE = """PRESCRIPTION DATA (use only these numbers, do not invent others):
- Crop: {crop} | District: {district} | Season: {season}
- Land: {land_acres} acres
- Fertilizer needed: Urea {urea_bags} bags · DAP {dap_bags} bags · MOP {mop_bags} bags
- Total cost: ₹{total_cost}
- Why this amount: TNAU blanket recommendation for {crop} in Zone {zone_id} ({zone_name}), source: TNAU Crop Production Guide 2020
- Nitrogen adjusted: {adjustment_note}
- Application schedule: {schedule_summary}
- Irrigation this week: {irrigation_summary}

Explain in {lang_name}: why this fertilizer amount, when to apply it, and what to watch for."""


def _build_prompts(prescription: dict, lang: str) -> tuple[str, str]:
    lang_name = "Tamil" if lang == "ta" else "English"
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(lang_name=lang_name)

    prod = prescription.get("products", {})
    cost = prod.get("cost", {})
    rec  = prescription.get("recommendation", {})

    adjustments = rec.get("adjustments_applied", [])
    adj_note = ", ".join(adjustments) if adjustments else "No adjustment — district default"

    split = prescription.get("split_schedule", [])
    schedule_summary = "; ".join(
        f"Day {s['day']} ({s.get('stage','')}: {', '.join(s.get('products',[]))})"
        for s in split if not s.get("is_past")
    ) or "No schedule available"

    irr = prescription.get("irrigation")
    if irr:
        irr_days = irr.get("total_irrigation_days", 0)
        skip_days = irr.get("total_skip_days", 0)
        irrigation_summary = f"Irrigate {irr_days} days, skip {skip_days} days this week (Kc={irr.get('kc_used','?')})"
    else:
        irrigation_summary = "Weather data not available — irrigation schedule not generated"

    user_prompt = _USER_PROMPT_TEMPLATE.format(
        crop=prescription.get("crop", ""),
        district=prescription.get("district", ""),
        season=prescription.get("season", ""),
        land_acres=prescription.get("land_acres", ""),
        urea_bags=prod.get("urea_bags", "?"),
        dap_bags=prod.get("dap_bags", "?"),
        mop_bags=prod.get("mop_bags", "?"),
        total_cost=int(cost.get("total_inr", 0)),
        zone_id=prescription.get("zone_id", ""),
        zone_name=prescription.get("zone_name", ""),
        adjustment_note=adj_note,
        schedule_summary=schedule_summary,
        irrigation_summary=irrigation_summary,
        lang_name=lang_name,
    )
    return system_prompt, user_prompt


async def generate_explanation(prescription: dict, lang: str = "ta") -> str:
    """Generate a 3-4 sentence Tamil or English explanation of the prescription.

    Uses the Groq LLM via the shared get_llm_client() factory.
    Falls back to a pre-written message if the LLM is unavailable.
    """
    try:
        from app.services.llm_client import get_llm_client
        client = get_llm_client()
        system_prompt, user_prompt = _build_prompts(prescription, lang)
        text = await client.generate(system_prompt, user_prompt, max_tokens=350)
        return text.strip()
    except Exception as exc:
        logger.warning("pillar2_explanation_failed: %s", repr(str(exc)))
        return _FALLBACK.get(lang, _FALLBACK["ta"])
