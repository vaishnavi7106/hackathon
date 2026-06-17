from pydantic import BaseModel, ConfigDict, Field


class DiseaseCreate(BaseModel):
    disease_id: str = Field(..., min_length=3, max_length=60, pattern=r"^[a-z0-9_]+$")
    crop_id: str | None = Field(None, max_length=40)
    crop: str = Field(..., max_length=60)
    name_en: str = Field(..., max_length=120)
    name_ta: str = Field(..., max_length=120)
    symptoms_en: str | None = None
    symptoms_ta: str | None = None
    modern_chemical: str | None = Field(None, max_length=200)
    modern_dosage: str | None = Field(None, max_length=200)
    modern_cost_acre: float | None = Field(None, ge=0)
    supply_note: str | None = Field(None, max_length=200)
    indigenous_name: str | None = Field(None, max_length=120)
    indigenous_method: str | None = None
    indigenous_method_ta: str | None = None
    icar_reference: str | None = Field(None, max_length=200)


class DiseaseUpdate(BaseModel):
    """All fields optional for PATCH semantics."""

    crop_id: str | None = None
    name_en: str | None = Field(None, max_length=120)
    name_ta: str | None = Field(None, max_length=120)
    symptoms_en: str | None = None
    symptoms_ta: str | None = None
    modern_chemical: str | None = None
    modern_dosage: str | None = None
    modern_cost_acre: float | None = Field(None, ge=0)
    supply_note: str | None = None
    indigenous_name: str | None = None
    indigenous_method: str | None = None
    indigenous_method_ta: str | None = None
    icar_reference: str | None = None


class DiseaseOut(DiseaseCreate):
    model_config = ConfigDict(from_attributes=True)


class DiseaseSummary(BaseModel):
    """Lightweight for lists and FK references."""

    model_config = ConfigDict(from_attributes=True)

    disease_id: str
    name_en: str
    name_ta: str
    crop: str
    crop_id: str | None = None
    modern_cost_acre: float | None = None
