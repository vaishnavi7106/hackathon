import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Farmer-facing eligibility / chat ──────────────────────────────────────────

class EligibleSchemeOut(BaseModel):
    scheme_id: str
    name_ta: str
    name_en: str
    level: str | None = None
    benefit_amount: str | None = None
    benefit_amount_ta: str | None = None
    benefit_amount_num: float | None = None
    application_deadline: str | None = None
    deadline_urgent: bool = False
    documents_required: list[str]
    documents_ta: list[str] | None = None
    application_url: str | None = None
    application_mode: str | None = None
    application_portal_name: str | None = None
    application_process_summary: str | None = None
    description_ta: str
    description_en: str | None = None
    eligibility_ta: str | None = None
    department_ta: str | None = None
    department_en: str | None = None
    year: str | None = None
    source_url: str | None = None
    eligibility_state: str = 'ELIGIBLE'


class DeadlineAlert(BaseModel):
    scheme_id: str
    name_ta: str
    deadline: date
    days_remaining: int
    urgent: bool


class EligibleSchemesResponse(BaseModel):
    eligible_count: int
    schemes: list[EligibleSchemeOut]
    needs_more_info_count: int = 0
    needs_more_info_schemes: list[EligibleSchemeOut] = []
    deadline_alerts: list[DeadlineAlert]


class SchemeListResponse(BaseModel):
    total: int
    schemes: list[EligibleSchemeOut]


class SchemeCheckRequest(BaseModel):
    language: str = Field("ta", pattern=r"^(ta|hi|en)$")


class SchemeChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    language: str = Field("ta", pattern=r"^(ta|hi|en)$")
    conversation_id: uuid.UUID | None = None


class SchemeChatResponse(BaseModel):
    conversation_id: uuid.UUID
    response_ta: str
    eligible_scheme_ids: list[str]
    deadline_alerts: list[DeadlineAlert]
    latency_ms: int


# ── Admin / catalog ───────────────────────────────────────────────────────────

class GovernmentSchemeCreate(BaseModel):
    # Pattern extended to allow uppercase letters and hyphens (e.g. CEN-PMKISAN, TN-TNFR)
    scheme_id: str = Field(..., min_length=3, max_length=60, pattern=r"^[A-Za-z0-9_-]+$")
    name_en: str = Field(..., max_length=200)
    name_ta: str = Field(..., max_length=200)
    level: str | None = Field(None, pattern=r"^(central|state|district)$")
    state: str = Field("All India", max_length=60)
    benefit_amount: str | None = Field(None, max_length=200)
    benefit_amount_ta: str | None = Field(None, max_length=200)
    benefit_amount_num: float | None = Field(None, ge=0)
    min_land_acres: float = Field(0.0, ge=0)
    max_land_acres: float | None = Field(None, ge=0)
    requires_aadhaar: bool = False
    eligible_crops: list[str] | None = None
    eligible_districts: list[str] | None = None
    income_band_max: str | None = None
    eligible_income_bands: list[str] | None = None
    min_age: int | None = None
    max_age: int | None = None
    requires_bank_account: bool = False
    eligible_land_ownership: list[str] | None = None
    documents_required: list[str] = []
    application_deadline: str | None = None
    application_deadline_date: date | None = None
    application_url: str | None = None
    office_type: str | None = None
    # Extended fields from enriched scheme dataset (migration 005)
    department_en: str | None = None
    department_ta: str | None = None
    scheme_code: str | None = None
    year: str | None = None
    source_scheme_id: str | None = None
    description_en: str | None = None
    eligibility_en: str | None = None
    source_url: str | None = None
    # Application process detail (migration 006)
    application_mode: str | None = None
    application_portal_name: str | None = None
    application_process_summary: str | None = None
    verification_status: str | None = None
    description_ta: str
    eligibility_ta: str | None = None
    documents_ta: list[str] | None = None
    last_verified: date
    is_active: bool = True


class GovernmentSchemeUpdate(BaseModel):
    """All fields optional for PATCH semantics."""

    name_en: str | None = None
    name_ta: str | None = None
    level: str | None = None
    benefit_amount: str | None = None
    benefit_amount_num: float | None = None
    min_land_acres: float | None = None
    max_land_acres: float | None = None
    requires_aadhaar: bool | None = None
    eligible_crops: list[str] | None = None
    eligible_districts: list[str] | None = None
    income_band_max: str | None = None
    eligible_income_bands: list[str] | None = None
    min_age: int | None = None
    max_age: int | None = None
    requires_bank_account: bool | None = None
    eligible_land_ownership: list[str] | None = None
    documents_required: list[str] | None = None
    application_deadline: str | None = None
    application_deadline_date: date | None = None
    application_url: str | None = None
    # Extended fields from enriched scheme dataset (migration 005)
    department_en: str | None = None
    department_ta: str | None = None
    scheme_code: str | None = None
    year: str | None = None
    source_scheme_id: str | None = None
    description_en: str | None = None
    eligibility_en: str | None = None
    source_url: str | None = None
    application_mode: str | None = None
    application_portal_name: str | None = None
    application_process_summary: str | None = None
    verification_status: str | None = None
    description_ta: str | None = None
    eligibility_ta: str | None = None
    last_verified: date | None = None
    is_active: bool | None = None


class GovernmentSchemeOut(GovernmentSchemeCreate):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: datetime


# Backward-compat alias used by older router code
SchemeDetailOut = GovernmentSchemeOut


# ── EligibilityResult ─────────────────────────────────────────────────────────

class EligibilityResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    result_id: uuid.UUID
    farmer_id: uuid.UUID
    scheme_id: str
    is_eligible: bool
    eligibility_state: str | None = None
    criteria_results: dict
    query_text: str | None = None
    llm_response: str | None = None
    language: str
    latency_ms: int | None = None
    deadline_date: date | None = None
    days_to_deadline: int | None = None
    checked_at: datetime
