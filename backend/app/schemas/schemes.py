import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class EligibleSchemeOut(BaseModel):
    scheme_id: str
    name_ta: str
    name_en: str
    benefit_amount: str | None
    benefit_amount_num: float | None
    application_deadline: str | None
    deadline_urgent: bool = False
    documents_required: list[str]
    application_url: str | None
    description_ta: str


class DeadlineAlert(BaseModel):
    scheme_id: str
    name_ta: str
    deadline: date
    days_remaining: int
    urgent: bool


class EligibleSchemesResponse(BaseModel):
    eligible_count: int
    schemes: list[EligibleSchemeOut]
    deadline_alerts: list[DeadlineAlert]


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


class SchemeDetailOut(BaseModel):
    scheme_id: str
    name_en: str
    name_ta: str
    level: str | None
    benefit_amount: str | None
    eligibility_ta: str | None
    documents_required: list[str]
    documents_ta: list[str] | None
    application_deadline: str | None
    application_url: str | None
    office_type: str | None
    last_verified: date

    class Config:
        from_attributes = True
