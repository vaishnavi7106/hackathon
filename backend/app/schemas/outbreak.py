"""Pillar 5 — Outbreak Alert schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DiseaseReportCreate(BaseModel):
    disease_class: str
    disease_name_ta: str | None = None
    crop_type: str | None = None
    confidence: float
    latitude: float | None = None
    longitude: float | None = None
    diagnosis_id: uuid.UUID | None = None


class DiseaseReportOut(DiseaseReportCreate):
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    farmer_id: uuid.UUID | None = None
    is_confirmed: bool
    reported_at: datetime


class OutbreakAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alert_id: uuid.UUID
    disease_class: str
    disease_name_ta: str | None = None
    center_lat: float
    center_lng: float
    radius_km: float
    report_count: int
    severity: str
    detected_at: datetime
    alert_sent: bool
    webhook_sent: bool
    is_active: bool
    affected_report_ids: list[uuid.UUID] = []


class ActiveOutbreaksResponse(BaseModel):
    outbreaks: list[OutbreakAlertOut]
    total: int


class OutbreakDetectionResult(BaseModel):
    alerts_created: int
    alerts: list[OutbreakAlertOut]
