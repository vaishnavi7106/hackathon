"""Crop — master catalog of agricultural crops.

crop_id is a human-readable slug (e.g. 'rice', 'sugarcane') used as PK
so FK columns in other tables are self-documenting in raw SQL.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Crop(Base):
    __tablename__ = "crops"

    crop_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(80), nullable=False)
    name_ta: Mapped[str] = mapped_column(String(80), nullable=False)
    # Agronomy metadata
    category: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # cereal | fruit | vegetable | oilseed | cash_crop | spice | pulse
    typical_seasons: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    avg_yield_kg_per_acre: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    water_requirement: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # high | medium | low
    growing_days: Mapped[int | None] = mapped_column(nullable=True)
    icar_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_priority: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # True = top-6 Tamil Nadu priority crops
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships (back-references declared on owning side)
    diseases: Mapped[list["Disease"]] = relationship("Disease", back_populates="crop_ref")
    farmer_crops: Mapped[list["FarmerCrop"]] = relationship("FarmerCrop", back_populates="crop_ref")
    diagnoses: Mapped[list["Diagnosis"]] = relationship("Diagnosis", back_populates="crop_ref")
    fertilizer_recommendations: Mapped[list["FertilizerRecommendation"]] = relationship(
        "FertilizerRecommendation", back_populates="crop_ref"
    )
    irrigation_plans: Mapped[list["IrrigationPlan"]] = relationship(
        "IrrigationPlan", back_populates="crop_ref"
    )
    market_forecasts: Mapped[list["MarketForecast"]] = relationship(
        "MarketForecast", back_populates="crop_ref"
    )
