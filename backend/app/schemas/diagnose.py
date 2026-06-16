import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ModernTreatment(BaseModel):
    chemical: str | None
    dosage: str | None
    cost_per_acre: float | None
    supply_note: str | None


class IndigenousRemedy(BaseModel):
    name: str | None
    method: str | None
    preparation_ta: str | None


class TreatmentOut(BaseModel):
    modern: ModernTreatment
    indigenous: IndigenousRemedy


class DiseaseOut(BaseModel):
    id: str
    name_en: str
    name_ta: str


class DiagnoseResponse(BaseModel):
    diagnosis_id: uuid.UUID
    disease: DiseaseOut | None = None
    confidence: float | None = None
    confidence_level: str | None = None  # "high" | "medium" | "low"
    heatmap_url: str | None = None
    shap_label_ta: str | None = None
    treatment: TreatmentOut | None = None
    low_confidence_prompt_ta: str | None = None
    low_confidence_prompt_en: str | None = None


class DiagnoseHistoryItem(BaseModel):
    diagnosis_id: uuid.UUID
    disease_name_ta: str | None
    disease_name_en: str | None
    confidence: float | None
    created_at: datetime
    heatmap_url: str | None

    class Config:
        from_attributes = True


class DiagnoseHistoryResponse(BaseModel):
    diagnoses: list[DiagnoseHistoryItem]
