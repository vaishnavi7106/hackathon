import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Disease(Base):
    """Catalog of known crop diseases with modern + indigenous treatments."""

    __tablename__ = "diseases"

    disease_id: Mapped[str] = mapped_column(String(60), primary_key=True)
    # crop_id FK added in migration 002; varchar `crop` retained for backward compat
    crop_id: Mapped[str | None] = mapped_column(
        String(40),
        ForeignKey("crops.crop_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    name_en: Mapped[str] = mapped_column(String(120), nullable=False)
    name_ta: Mapped[str] = mapped_column(String(120), nullable=False)
    # Symptoms
    symptoms_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    symptoms_ta: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Modern treatment
    modern_chemical: Mapped[str | None] = mapped_column(String(200), nullable=True)
    modern_dosage: Mapped[str | None] = mapped_column(String(200), nullable=True)
    modern_cost_acre: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    supply_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Indigenous remedy
    indigenous_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    indigenous_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    indigenous_method_ta: Mapped[str | None] = mapped_column(Text, nullable=True)
    # ICAR / extension reference
    icar_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    crop_ref: Mapped["Crop | None"] = relationship("Crop", back_populates="diseases")


class Diagnosis(Base):
    """Result of a CNN-based crop disease diagnosis from a farmer photo."""

    __tablename__ = "diagnoses"

    diagnosis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # crop_id FK added in migration 002; varchar `crop` retained for backward compat
    crop_id: Mapped[str | None] = mapped_column(
        String(40),
        ForeignKey("crops.crop_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    crop: Mapped[str | None] = mapped_column(String(60), nullable=True)
    disease_id: Mapped[str | None] = mapped_column(
        String(60),
        ForeignKey("diseases.disease_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Denormalized names stored for historical accuracy even if catalog changes
    disease_name_en: Mapped[str | None] = mapped_column(String(120), nullable=True)
    disease_name_ta: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Model output
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    low_confidence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Media
    image_key: Mapped[str] = mapped_column(String(500), nullable=False)
    heatmap_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="diagnoses")
    crop_ref: Mapped["Crop | None"] = relationship("Crop", back_populates="diagnoses")
