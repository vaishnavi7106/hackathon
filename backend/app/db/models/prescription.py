"""DEPRECATED — Prescription (merged fertilizer + irrigation).

Created in migration 001.  Superseded in migration 002 by:
  FertilizerRecommendation  (fertilizer_recommendations)
  IrrigationPlan            (irrigation_plans)

The table and model are kept so existing rows remain accessible and the
Farmer.prescriptions relationship still resolves.  Do NOT write new
Prescription rows from application code.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    soil_test_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("soil_tests.test_id", ondelete="SET NULL"),
        nullable=True,
    )
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    season: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Fertilizer output
    nitrogen_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    phosphorus_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    potassium_kg: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    micro_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    fertilizer_cost: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    fertilizer_save: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    # Irrigation output
    irrigation_plan: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    water_cost_est: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    # Joint plan
    joint_calendar: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    weather_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="prescriptions")
