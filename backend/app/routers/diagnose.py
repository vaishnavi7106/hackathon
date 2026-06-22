"""Pillar 1 — Crop Sentinel router."""

import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Body, File, Form, UploadFile, status

from app.config import get_settings
from app.crud.diagnosis import (
    create_diagnosis,
    get_diagnosis,
    get_disease,
    get_farmer_diagnoses,
    update_diagnosis_result,
)
from app.deps import CurrentFarmerIdDep, DbDep
from app.exceptions import NotFoundError, ValidationError
from app.ml.rice_lookup import (
    SYMPTOM_CONFIDENCE,
    get_all_symptom_options,
    match_rice_disease,
)
import structlog

from app.schemas.diagnose import (
    DiagnoseHistoryItem,
    DiagnoseHistoryResponse,
    DiagnoseResponse,
    DiseaseOut,
    IndigenousRemedy,
    ModernTreatment,
    RiceSymptomsRequest,
    SimilarDiseaseOut,
    SymptomOption,
    TreatmentOut,
)

_log = structlog.get_logger()

router = APIRouter(prefix="/diagnose", tags=["diagnose"])
settings = get_settings()

ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# ── Confidence thresholds ─────────────────────────────────────────────────────
#
# Unfiltered inference (no crop selected) keeps the original strict 0.70 bar.
# When crop_filter is active, the softmax runs over N classes only, so the
# achievable maximum shifts.  We calibrate two tiers per crop:
#
#   image_quality_floor — below this, probabilities are near-uniform → bad image
#   confirm_threshold   — above this, we report a confident diagnosis
#   between the two     — model sees something but can't distinguish → similar diseases
#
# Class counts per crop:
#   rice / banana / sugarcane : 1   (always ~1.0, handled separately)
#   groundnut                 : 2
#   potato                    : 3
#   maize / grape             : 4
#   tomato                    : 10

CONFIDENCE_THRESHOLD = 0.70         # unfiltered / fallback
RICE_ML_THRESHOLD    = 0.85         # rice-specific symptom-check gate

# (image_quality_floor, confirm_threshold) for crop-filtered inference.
# Single-class crops (rice / banana / sugarcane) now report the GLOBAL softmax
# probability for their one class (see crop_sentinel.py), so their effective
# range is ~0.01–0.70.  Thresholds calibrated accordingly.
_CROP_THRESHOLDS: dict[str, tuple[float, float]] = {
    # single-class crops — thresholds on global softmax probability
    "rice":      (0.12, 0.30),
    "banana":    (0.12, 0.28),
    "sugarcane": (0.12, 0.28),
    # multi-class crops — thresholds on filtered softmax probability
    "groundnut": (0.35, 0.58),
    "potato":    (0.25, 0.50),
    "maize":     (0.22, 0.45),
    "grape":     (0.22, 0.45),
    "tomato":    (0.18, 0.40),
}


def _get_thresholds(crop: str | None, filtered: bool) -> tuple[float, float]:
    """Return (image_quality_floor, confirm_threshold) for this inference."""
    if not filtered or not crop:
        return 0.25, CONFIDENCE_THRESHOLD
    crop_key = crop.lower()
    return _CROP_THRESHOLDS.get(crop_key, (0.25, CONFIDENCE_THRESHOLD))


# ── Helper: build TreatmentOut from a Disease ORM row ────────────────────────

def _treatment_from_disease(disease) -> TreatmentOut:
    return TreatmentOut(
        modern=ModernTreatment(
            chemical=disease.modern_chemical,
            dosage=disease.modern_dosage,
            cost_per_acre=float(disease.modern_cost_acre) if disease.modern_cost_acre else None,
            supply_note=disease.supply_note,
        ),
        indigenous=IndigenousRemedy(
            name=disease.indigenous_name,
            method=disease.indigenous_method,
            preparation_ta=disease.indigenous_method_ta,
        ),
    )


def _treatment_from_lookup(entry: dict) -> TreatmentOut:
    m = entry["modern"]
    i = entry["indigenous"]
    return TreatmentOut(
        modern=ModernTreatment(
            chemical=m.get("chemical"),
            dosage=m.get("dosage"),
            cost_per_acre=float(m["cost_per_acre"]) if m.get("cost_per_acre") else None,
            supply_note=m.get("supply_note"),
        ),
        indigenous=IndigenousRemedy(
            name=i.get("name"),
            method=i.get("method"),
            preparation_ta=i.get("preparation_ta"),
        ),
    )


def _treatment_from_gemini(result: dict) -> TreatmentOut | None:
    m = result.get("modern_treatment") or {}
    i = result.get("indigenous_treatment") or {}
    if not m and not i:
        return None
    return TreatmentOut(
        modern=ModernTreatment(
            chemical=m.get("chemical") if m else None,
            dosage=m.get("dosage") if m else None,
            cost_per_acre=float(m["cost_per_acre"]) if m and m.get("cost_per_acre") else None,
            supply_note=m.get("supply_note") if m else None,
        ),
        indigenous=IndigenousRemedy(
            name=i.get("name") if i else None,
            method=i.get("method") if i else None,
            preparation_ta=i.get("preparation_ta") if i else None,
        ),
    )


# ── POST /diagnose ────────────────────────────────────────────────────────────

@router.post("", response_model=DiagnoseResponse, status_code=status.HTTP_200_OK)
async def diagnose_crop(
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
    image: UploadFile = File(...),
    crop: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
):
    if image.content_type not in ALLOWED_MIME:
        raise ValidationError(
            f"Unsupported image type: {image.content_type}. Use JPEG or PNG.",
            detail_ta="படம் JPEG அல்லது PNG வடிவத்தில் இருக்க வேண்டும்.",
        )

    contents = await image.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise ValidationError(
            "Image must be under 5MB",
            detail_ta="படத்தின் அளவு 5MB-க்கும் குறைவாக இருக்க வேண்டும்.",
        )

    image_key = await _save_media(contents, image.filename or "upload.jpg")

    from app.ml.inference_router import run_inference
    inference_result = await run_inference(contents, crop)

    # ── Gemini Vision path ────────────────────────────────────────────────────
    if inference_result.get("source", "").startswith("gemini"):
        g_confidence  = inference_result["confidence"]
        g_conf_level  = inference_result["confidence_level"]
        g_is_healthy  = inference_result.get("is_healthy", False)
        g_name_en     = inference_result["disease_name_en"]
        g_name_ta     = inference_result["disease_name_ta"]
        g_symptoms    = inference_result.get("symptoms_observed", "") or None
        g_model_ver   = inference_result.get("model_version", "gemini-1.5-flash")
        g_low_conf    = g_conf_level == "low"
        g_disease_id  = (
            None if g_low_conf
            else g_name_en.lower().replace(" ", "_").replace("-", "_").replace(",", "")
        )

        diag = await create_diagnosis(
            db,
            farmer_id=farmer_id,
            image_key=image_key,
            crop=crop,
            disease_id=g_disease_id,
            disease_name_en=None if g_low_conf else g_name_en,
            disease_name_ta=None if g_low_conf else g_name_ta,
            confidence=g_confidence,
            low_confidence=g_low_conf,
            heatmap_key=None,
            model_version=g_model_ver[:20],
        )

        if g_low_conf:
            return DiagnoseResponse(
                diagnosis_id=diag.diagnosis_id,
                confidence=g_confidence,
                confidence_level="low",
                rejection_reason="image_quality",
                low_confidence_prompt_ta=(
                    "படம் தெளிவாக இல்லை. நோயுற்ட இலையை நெருக்கமாக, "
                    "நல்ல வெளிச்சத்தில் படம் எடுக்கவும்."
                ),
                low_confidence_prompt_en=(
                    "Image unclear or disease could not be identified. "
                    "Please retake a close-up of the affected leaf in good daylight."
                ),
            )

        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            disease=None if g_is_healthy else DiseaseOut(
                id=g_disease_id or "unknown",
                name_en=g_name_en,
                name_ta=g_name_ta,
            ),
            confidence=g_confidence,
            confidence_level=g_conf_level,
            source="gemini_vision",
            shap_label_ta=g_symptoms,
            treatment=None if g_is_healthy else _treatment_from_gemini(inference_result),
        )

    # ── MobileNet path ────────────────────────────────────────────────────────
    confidence = inference_result["confidence"]
    top3       = inference_result.get("top3", [])
    filtered   = inference_result.get("filtered", False)
    is_rice    = (crop or "").lower() in ("rice", "paddy", "நெல்")
    model_predicted_rice = inference_result.get("disease_id", "").startswith("rice_")

    # ── Resolve thresholds ────────────────────────────────────────────────────
    image_quality_floor, confirm_threshold = _get_thresholds(crop, filtered)

    # Classify the confidence into one of three tiers:
    #   "pass"             — confident enough to show a diagnosis
    #   "similar_diseases" — model sees something but can't pick one disease
    #   "image_quality"    — probabilities near-uniform, image is likely bad
    if confidence >= confirm_threshold:
        rejection_reason: str | None = None
    elif confidence >= image_quality_floor:
        rejection_reason = "similar_diseases"
    else:
        rejection_reason = "image_quality"

    low_confidence = rejection_reason is not None

    _log.info(
        "crop_sentinel_inference",
        crop=crop,
        filtered=filtered,
        n_classes=inference_result.get("n_classes"),
        confidence=round(confidence, 4),
        confirm_threshold=confirm_threshold,
        image_quality_floor=image_quality_floor,
        rejection=rejection_reason or "pass",
        top3=[f"{t['disease_id']}:{t['confidence']:.3f}" for t in top3],
    )

    # ── Rice low-confidence path: symptom selector ────────────────────────────
    # Rice has only one model class so filtered-mode always returns conf ≈ 1.0.
    # This guard applies to unfiltered inference where the model score for rice
    # falls below RICE_ML_THRESHOLD (edge case, kept for backward compat).
    if is_rice and model_predicted_rice and confidence < RICE_ML_THRESHOLD and not filtered:
        diag = await create_diagnosis(
            db,
            farmer_id=farmer_id,
            image_key=image_key,
            crop=crop,
            disease_id=None,
            disease_name_en=None,
            disease_name_ta=None,
            confidence=confidence,
            low_confidence=True,
            heatmap_key=inference_result.get("heatmap_key"),
            model_version="mobilenetv2-v1",
        )
        options = [SymptomOption(**o) for o in get_all_symptom_options()]
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=confidence,
            confidence_level="low",
            source="symptom_check_needed",
            requires_symptom_check=True,
            prompt_en=(
                "Our model needs your help. Please select "
                "the symptoms you can see on your crop."
            ),
            prompt_ta=(
                "மேலும் துல்லியமான பலன் பெற உங்கள் பயிரில் "
                "காணும் அறிகுறிகளை தேர்ந்தெடுக்கவும்"
            ),
            symptoms_to_show=options,
        )

    # ── Low-confidence path (non-rice or non-filtered rice) ──────────────────
    diag = await create_diagnosis(
        db,
        farmer_id=farmer_id,
        image_key=image_key,
        crop=crop,
        disease_id=None if low_confidence else inference_result.get("disease_id"),
        disease_name_en=None if low_confidence else inference_result.get("name_en"),
        disease_name_ta=None if low_confidence else inference_result.get("name_ta"),
        confidence=confidence,
        low_confidence=low_confidence,
        heatmap_key=inference_result.get("heatmap_key"),
        model_version="mobilenetv2-v1",
    )

    if rejection_reason == "similar_diseases":
        similar_out = [
            SimilarDiseaseOut(
                name_en=t["name_en"],
                name_ta=t["name_ta"],
                confidence=t["confidence"],
            )
            for t in top3
        ]
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=confidence,
            confidence_level="low",
            rejection_reason="similar_diseases",
            similar_diseases=similar_out,
            low_confidence_prompt_ta=(
                "பல நோய்கள் ஒரே மாதிரி இருக்கின்றன. "
                "பாதிக்கப்பட்ட இலையை நெருக்கமாக, தெளிவான வெளிச்சத்தில் படம் எடுக்கவும்."
            ),
            low_confidence_prompt_en=(
                "Multiple similar diseases detected. "
                "Please capture a closer photo of the affected leaf in clear daylight."
            ),
        )

    if rejection_reason == "image_quality":
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=confidence,
            confidence_level="low",
            rejection_reason="image_quality",
            low_confidence_prompt_ta=(
                "படம் தெளிவாக இல்லை. நோயுற்ட இலையை நெருக்கமாக, "
                "நல்ல வெளிச்சத்தில் படம் எடுக்கவும்."
            ),
            low_confidence_prompt_en=(
                "Image appears unclear or poorly lit. "
                "Please retake a close-up of the affected leaf in good daylight."
            ),
        )

    # ── High-confidence ML result ─────────────────────────────────────────────
    if not low_confidence:
        from app.crud.outbreak import create_disease_report
        from app.schemas.outbreak import DiseaseReportCreate
        await create_disease_report(
            db,
            farmer_id=farmer_id,
            data=DiseaseReportCreate(
                disease_class=inference_result["disease_id"],
                disease_name_ta=inference_result.get("name_ta"),
                crop_type=crop,
                confidence=confidence,
                latitude=latitude,
                longitude=longitude,
                diagnosis_id=diag.diagnosis_id,
            ),
        )

    disease = await get_disease(db, inference_result["disease_id"])
    treatment = _treatment_from_disease(disease) if disease else None
    confidence_level = "high" if confidence >= 0.85 else "medium"
    heatmap_url = f"/media/{diag.heatmap_key}" if diag.heatmap_key else None

    return DiagnoseResponse(
        diagnosis_id=diag.diagnosis_id,
        disease=DiseaseOut(
            id=inference_result["disease_id"],
            name_en=inference_result["name_en"],
            name_ta=inference_result["name_ta"],
        ),
        confidence=confidence,
        confidence_level=confidence_level,
        source="ml_model",
        heatmap_url=heatmap_url,
        shap_label_ta="இந்த இலையின் மஞ்சள் பகுதி நோயை காட்டுகிறது",
        treatment=treatment,
    )


# ── POST /diagnose/rice-symptoms ──────────────────────────────────────────────

@router.post("/rice-symptoms", response_model=DiagnoseResponse, status_code=status.HTTP_200_OK)
async def submit_rice_symptoms(
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
    body: RiceSymptomsRequest = Body(...),
):
    diag = await get_diagnosis(db, body.diagnosis_id)
    if diag is None or (diag.farmer_id and diag.farmer_id != farmer_id):
        raise NotFoundError("Diagnosis")

    result = match_rice_disease(body.selected_symptoms)
    matched_disease = result["disease"]
    match_score = result["match_score"]
    matched_symptoms = result["matched_symptoms"]

    # No symptom matched any disease
    if match_score == 0 or matched_disease is None:
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=SYMPTOM_CONFIDENCE,
            confidence_level="medium",
            source="symptom_match",
            match_score=0,
            matched_symptoms=[],
            low_confidence_prompt_en=(
                "Could not identify the disease from the selected symptoms. "
                "Please contact your local agriculture extension officer."
            ),
            low_confidence_prompt_ta=(
                "தேர்ந்தெடுத்த அறிகுறிகளில் இருந்து நோயை கண்டறிய முடியவில்லை. "
                "உங்கள் வட்டார வேளாண்மை விரிவாக்க அலுவலரை தொடர்பு கொள்ளுங்கள்."
            ),
        )

    # Update the original diagnosis record with matched result
    await update_diagnosis_result(
        db,
        body.diagnosis_id,
        disease_id=matched_disease["disease_id"],
        disease_name_en=matched_disease["name_en"],
        disease_name_ta=matched_disease["name_ta"],
        confidence=SYMPTOM_CONFIDENCE,
        low_confidence=False,
    )
    await db.commit()

    treatment = _treatment_from_lookup(matched_disease)

    return DiagnoseResponse(
        diagnosis_id=diag.diagnosis_id,
        disease=DiseaseOut(
            id=matched_disease["disease_id"],
            name_en=matched_disease["name_en"],
            name_ta=matched_disease["name_ta"],
        ),
        confidence=SYMPTOM_CONFIDENCE,
        confidence_level="medium",
        source="symptom_match",
        match_score=match_score,
        matched_symptoms=matched_symptoms,
        treatment=treatment,
    )


# ── GET /diagnose/history ─────────────────────────────────────────────────────

@router.get("/history", response_model=DiagnoseHistoryResponse)
async def get_history(farmer_id: CurrentFarmerIdDep, db: DbDep):
    diagnoses = await get_farmer_diagnoses(db, farmer_id)
    items = [
        DiagnoseHistoryItem(
            diagnosis_id=d.diagnosis_id,
            disease_name_ta=d.disease_name_ta,
            disease_name_en=d.disease_name_en,
            confidence=float(d.confidence) if d.confidence is not None else None,
            created_at=d.created_at,
            heatmap_url=f"/media/{d.heatmap_key}" if d.heatmap_key else None,
        )
        for d in diagnoses
    ]
    return DiagnoseHistoryResponse(diagnoses=items)


# ── GET /diagnose/{diagnosis_id} ──────────────────────────────────────────────

@router.get("/{diagnosis_id}", response_model=DiagnoseResponse)
async def get_diagnosis_by_id(diagnosis_id: uuid.UUID, farmer_id: CurrentFarmerIdDep, db: DbDep):
    diag = await get_diagnosis(db, diagnosis_id)
    if diag is None or (diag.farmer_id and diag.farmer_id != farmer_id):
        raise NotFoundError("Diagnosis")

    if diag.low_confidence:
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=float(diag.confidence) if diag.confidence else None,
            confidence_level="low",
            low_confidence_prompt_ta="தெளிவான படம் இல்லாததால் நோய் கண்டறியவில்லை.",
        )

    disease = await get_disease(db, diag.disease_id) if diag.disease_id else None
    treatment = _treatment_from_disease(disease) if disease else None
    confidence = float(diag.confidence) if diag.confidence else None

    return DiagnoseResponse(
        diagnosis_id=diag.diagnosis_id,
        disease=DiseaseOut(
            id=diag.disease_id,
            name_en=diag.disease_name_en or "",
            name_ta=diag.disease_name_ta or "",
        ) if diag.disease_id else None,
        confidence=confidence,
        confidence_level="high" if (confidence or 0) >= 0.85 else "medium",
        heatmap_url=f"/media/{diag.heatmap_key}" if diag.heatmap_key else None,
        treatment=treatment,
    )


# ── Media helpers ─────────────────────────────────────────────────────────────

async def _save_media(contents: bytes, filename: str) -> str:
    media_dir = Path(settings.local_media_path) / "diagnose"
    media_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{Path(filename).suffix or '.jpg'}"
    dest = media_dir / unique_name
    async with aiofiles.open(dest, "wb") as f:
        await f.write(contents)
    return f"diagnose/{unique_name}"


def _stub_inference() -> dict:
    """Stub — dead code retained per audit instructions."""
    return {
        "disease_id": "rice_bacterial_leaf_blight",
        "name_en": "Rice Bacterial Leaf Blight",
        "name_ta": "நெல் பாக்டீரியல் இலை கருக்கல்",
        "confidence": 0.91,
    }

