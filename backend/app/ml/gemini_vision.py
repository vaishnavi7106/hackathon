"""Gemini Vision inference — alternative inference engine for Pillar 1.

Uses the `google-genai` SDK (already a project dependency) which supports
AQ. format API keys from Google AI Studio.
"""

import io
import json

from PIL import Image
from google import genai
from google.genai import types

from app.config import get_settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


_MODEL = "gemini-2.5-flash"

_PROMPT = """You are an expert agricultural plant pathologist specialising in Tamil Nadu crops.

The farmer says this is a photo of their {crop} crop.

Analyse the leaf or plant in the photo carefully and identify any disease present.

Respond ONLY with raw JSON. No markdown. No code fences. No explanation outside the JSON.

IMPORTANT: Write ALL text fields in Tamil language EXCEPT "chemical" (keep brand name in English).

{{
  "disease_name_en": "Early Blight",
  "disease_name_ta": "முற்கால இலைக்கருகல்",
  "confidence": 0.91,
  "confidence_level": "high",
  "is_healthy": false,
  "symptoms_observed": "இலைகளில் மஞ்சள் வளையத்துடன் அடர்நிற வட்ட வளையங்கள் காணப்படுகின்றன",
  "modern_treatment": {{
    "chemical": "Mancozeb 75% WP",
    "dosage": "1 லிட்டர் நீரில் 2 கிராம் கலந்து, ஏக்கருக்கு 500 லிட்டர் தெளிக்கவும்",
    "cost_per_acre": 180,
    "supply_note": "மாவட்ட வேளாண்மை உள்ளீட்டு கடையில் கிடைக்கும்"
  }},
  "indigenous_treatment": {{
    "name": "வேப்பெண்ணெய் தெளிப்பு",
    "method": "வேப்பெண்ணெய் 5மிலி 1 லிட்டர் நீரில், சிறிதளவு சோப்பு அல்லது திரவ சலவை பவுடரை சேர்த்து கலக்கவும். இலைகளின் இருபுறமும் சமசாக தெளிக்கவும். தேவைப்பட்டால் 7-10 நாட்களுக்கு ஒருமுறை மீண்டும் செய்யவும்.",
    "preparation_ta": "வேப்பெண்ணெய் 5மிலி 1 லிட்டர் நீரில் கலக்கவும்"
  }}
}}

Confidence rules:
  0.85-1.0  -> "high"   (clearly certain)
  0.70-0.84 -> "medium" (likely but some uncertainty)
  below 0.70 -> "low"   (unclear or ambiguous photo)

If the crop is healthy:
  is_healthy: true
  disease_name_en: "Healthy"
  disease_name_ta: "ஆரோக்கியமான பயிர்"
  modern_treatment: null
  indigenous_treatment: null

If the photo is unclear, not a plant, or disease cannot be identified:
  confidence: 0.40
  confidence_level: "low"
  disease_name_en: "Unable to identify"
  disease_name_ta: "கண்டறிய இயலவில்லை"
  modern_treatment: null
  indigenous_treatment: null

Base treatment guidance on TNAU CPG 2020 recommendations.
Always write dosage, supply_note, indigenous name and method in Tamil."""

_LOW_CONFIDENCE_FALLBACK: dict = {
    "disease_name_en":      "Unable to identify",
    "disease_name_ta":      "கண்டறிய இயலவில்லை",
    "confidence":           0.40,
    "confidence_level":     "low",
    "is_healthy":           False,
    "symptoms_observed":    "",
    "modern_treatment":     None,
    "indigenous_treatment": None,
    "source":               "gemini_vision",
    "model_version":        _MODEL,
}


async def infer_gemini(image_bytes: bytes, crop: str) -> dict:
    """Call Gemini Vision and return a normalised inference dict.

    Raises RuntimeError if the API call itself fails (caller falls back to
    MobileNet).  JSON parse failures return a low-confidence fallback.
    """
    client = _get_client()
    prompt = _PROMPT.format(crop=crop or "unspecified crop")

    # Convert to PIL then to JPEG bytes for a consistent mime type
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    image_part = types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")

    try:
        response = await client.aio.models.generate_content(
            model=_MODEL,
            contents=[prompt, image_part],
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini API call failed: {exc}") from exc

    raw = (response.text or "").strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else ""
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        return _LOW_CONFIDENCE_FALLBACK.copy()

    return {
        "disease_name_en":      result.get("disease_name_en", "Unknown"),
        "disease_name_ta":      result.get("disease_name_ta", ""),
        "confidence":           float(result.get("confidence", 0.5)),
        "confidence_level":     result.get("confidence_level", "low"),
        "is_healthy":           bool(result.get("is_healthy", False)),
        "symptoms_observed":    result.get("symptoms_observed", ""),
        "modern_treatment":     result.get("modern_treatment"),
        "indigenous_treatment": result.get("indigenous_treatment"),
        "source":               "gemini_vision",
        "model_version":        _MODEL,
    }
