import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Farmer(Base):
    __tablename__ = "farmers"

    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str | None] = mapped_column(String(12), unique=True, index=True, nullable=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    village: Mapped[str | None] = mapped_column(String(100), nullable=True)
    land_size_acres: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    pump_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    storage_facility: Mapped[str | None] = mapped_column(String(20), nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="ta", nullable=False)
    aadhaar_linked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    income_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Eligibility fields (added in migration 007)
    age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    bank_account_linked: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    land_ownership: Mapped[str | None] = mapped_column(String(20), nullable=True)  # own|lease|tenant
    # Pillar 5 — FCM push notification token (set from PWA on first app open)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # --- Relationships ---
    crops: Mapped[list["FarmerCrop"]] = relationship(
        "FarmerCrop", back_populates="farmer", cascade="all, delete-orphan"
    )
    soil_tests: Mapped[list["SoilTest"]] = relationship(
        "SoilTest", back_populates="farmer", cascade="all, delete-orphan"
    )
    diagnoses: Mapped[list["Diagnosis"]] = relationship("Diagnosis", back_populates="farmer")
    fertilizer_recommendations: Mapped[list["FertilizerRecommendation"]] = relationship(
        "FertilizerRecommendation", back_populates="farmer"
    )
    irrigation_plans: Mapped[list["IrrigationPlan"]] = relationship(
        "IrrigationPlan", back_populates="farmer"
    )
    market_forecasts: Mapped[list["MarketForecast"]] = relationship(
        "MarketForecast", back_populates="farmer"
    )
    eligibility_results: Mapped[list["EligibilityResult"]] = relationship(
        "EligibilityResult", back_populates="farmer", cascade="all, delete-orphan"
    )
    scheme_queries: Mapped[list["SchemeQuery"]] = relationship(
        "SchemeQuery", back_populates="farmer"
    )
    sessions: Mapped[list["FarmerSession"]] = relationship(
        "FarmerSession", back_populates="farmer", cascade="all, delete-orphan"
    )
    # Kept for backward compat — Prescription is deprecated; use
    # FertilizerRecommendation + IrrigationPlan going forward
    prescriptions: Mapped[list["Prescription"]] = relationship(
        "Prescription", back_populates="farmer"
    )


class FarmerCrop(Base):
    """A crop a specific farmer is currently growing."""

    __tablename__ = "farmer_crops"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # crop_id FK to the crop catalog (added in migration 002)
    crop_id: Mapped[str | None] = mapped_column(
        String(40),
        ForeignKey("crops.crop_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # varchar kept for backward compat — populated from crop_id via trigger / app logic
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    acres: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    season: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sowing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_harvest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="crops")
    crop_ref: Mapped["Crop | None"] = relationship("Crop", back_populates="farmer_crops")
