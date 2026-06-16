"""Pillar 1 — Crop Sentinel router.

ML inference stubs are clearly marked. Replace with real model calls on Day 7.
"""

import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, UploadFile, status

from app.config import get_settings
from app.crud.diagnosis import create_diagnosis, get_diagnosis, get_disease, get_farmer_diagnoses
from app.deps import CurrentFarmerIdDep, DbDep
from app.exceptions import NotFoundError, ValidationError
from app.schemas.diagnose import DiagnoseHistoryResponse, DiagnoseHistoryItem, DiagnoseResponse, DiseaseOut, TreatmentOut, ModernTreatment, IndigenousRemedy

router = APIRouter(prefix="/diagnose", tags=["diagnose"])
settings = get_settings()

ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5MB
CONFIDENCE_THRESHOLD = 0.70


@router.post("", response_model=DiagnoseResponse, status_code=status.HTTP_200_OK)
async def diagnose_crop(
    farmer_id: CurrentFarmerIdDep,
    db: DbDep,
    image: UploadFile = File(...),
    crop: str | None = Form(None),
):
    # Validate upload
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

    # Save original image
    image_key = await _save_media(contents, image.filename or "upload.jpg")

    # --- ML inference stub ---
    # Replace this block with real MobileNetV2 inference on Day 7:
    #   from app.ml.crop_sentinel import infer
    #   result = await infer(contents)
    inference_result = _stub_inference()
    # -------------------------

    confidence = inference_result["confidence"]
    low_confidence = confidence < CONFIDENCE_THRESHOLD

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
        heatmap_key=None,
        model_version="stub-v0",
    )

    if low_confidence:
        return DiagnoseResponse(
            diagnosis_id=diag.diagnosis_id,
            confidence=confidence,
            confidence_level="low",
            low_confidence_prompt_ta="படம் தெளிவாக இல்லை. நோயுற்ற இலையை நெருக்கமாக, நல்ல வெளிச்சத்தில் படம் எடுக்கவும்.",
            low_confidence_prompt_en="Image unclear. Please retake a close-up photo of the affected leaf in good daylight.",
        )

    disease = await get_disease(db, inference_result["disease_id"])
    treatment = None
    if disease:
        treatment = TreatmentOut(
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
        heatmap_url=heatmap_url,
        shap_label_ta="இந்த இலையின் மஞ்சள் பகுதி நோயை காட்டுகிறது",
        treatment=treatment,
    )


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
    treatment = None
    if disease:
        treatment = TreatmentOut(
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


async def _save_media(contents: bytes, filename: str) -> str:
    media_dir = Path(settings.local_media_path) / "diagnose"
    media_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4()}_{Path(filename).suffix or '.jpg'}"
    dest = media_dir / unique_name
    async with aiofiles.open(dest, "wb") as f:
        await f.write(contents)
    return f"diagnose/{unique_name}"


def _stub_inference() -> dict:
    """Stub returns a known result until the real model is loaded on Day 7."""
    return {
        "disease_id": "rice_bacterial_leaf_blight",
        "name_en": "Rice Bacterial Leaf Blight",
        "name_ta": "நெல் பாக்டீரியல் இலை கருக்கல்",
        "confidence": 0.91,
    }
