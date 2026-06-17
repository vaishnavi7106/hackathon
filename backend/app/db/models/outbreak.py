"""Pillar 5 — Real-Time Pest & Disease Outbreak Alert models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DiseaseReport(Base):
    """Geo-tagged record written after every Crop Sentinel diagnosis (Pillar 1).

    Confidence must be > 0.70 to be eligible for outbreak clustering.
    """

    __tablename__ = "disease_reports"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    diagnosis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("diagnoses.diagnosis_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    disease_class: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    disease_name_ta: Mapped[str | None] = mapped_column(String(120), nullable=True)
    crop_type: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    farmer: Mapped["Farmer | None"] = relationship("Farmer")


class OutbreakAlert(Base):
    """One row per detected disease cluster.

    Severity ladder:
        LOW      3–5 reports
        MEDIUM   6–9 reports
        HIGH     10–19 reports
        CRITICAL 20+ reports
    """

    __tablename__ = "outbreak_alerts"

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    disease_class: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    disease_name_ta: Mapped[str | None] = mapped_column(String(120), nullable=True)
    center_lat: Mapped[float] = mapped_column(Float, nullable=False)
    center_lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    report_count: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    webhook_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    # UUID array of contributing disease_report IDs
    affected_report_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
