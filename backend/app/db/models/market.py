"""Market models — Pillar 3 (Market Navigator).

Table rename history:
  001_initial_schema  → price_forecasts
  002_complete_schema → market_forecasts   (ALTER TABLE ... RENAME TO ...)

PriceForecast is kept as an alias so existing crud/forecast.py imports don't break.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Mandi(Base):
    __tablename__ = "mandis"

    mandi_id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str] = mapped_column(String(60), default="Tamil Nadu", nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    enam_linked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    prices: Mapped[list["MandiPrice"]] = relationship("MandiPrice", back_populates="mandi")
    forecasts: Mapped[list["MarketForecast"]] = relationship(
        "MarketForecast", back_populates="mandi"
    )


class MandiPrice(Base):
    __tablename__ = "mandi_prices"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mandi_id: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("mandis.mandi_id"),
        nullable=False,
        index=True,
    )
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    price_date: Mapped[date] = mapped_column(Date, nullable=False)
    min_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    max_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    modal_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="agmarknet", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("mandi_id", "crop", "price_date", "source", name="uq_mandi_price"),
    )

    mandi: Mapped["Mandi"] = relationship("Mandi", back_populates="prices")


class MarketForecast(Base):
    """90-day price forecast + hold/sell recommendation (Prophet model).

    DB table name: market_forecasts (renamed from price_forecasts in migration 002).
    """

    __tablename__ = "market_forecasts"

    forecast_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # crop_id FK added in migration 002; varchar crop retained for backward compat
    crop_id: Mapped[str | None] = mapped_column(
        String(40),
        ForeignKey("crops.crop_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    crop: Mapped[str] = mapped_column(String(60), nullable=False)
    mandi_id: Mapped[str | None] = mapped_column(
        String(60),
        ForeignKey("mandis.mandi_id", ondelete="SET NULL"),
        nullable=True,
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    forecast_data: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    today_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    peak_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    peak_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    storage_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    storage_cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    net_gain: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(10), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Tamil-language explanation for hold/sell decision (added in migration 002)
    hold_sell_calculation_ta: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Mandi comparison snapshot (added in migration 002)
    mandi_comparison: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="market_forecasts")
    mandi: Mapped["Mandi"] = relationship("Mandi", back_populates="forecasts")
    crop_ref: Mapped["Crop | None"] = relationship("Crop", back_populates="market_forecasts")


# Backward-compat alias — existing CRUD code imports PriceForecast and still works.
PriceForecast = MarketForecast
