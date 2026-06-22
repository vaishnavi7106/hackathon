import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FarmDailyRecord(Base):
    __tablename__ = "farm_daily_records"

    __table_args__ = (
        UniqueConstraint("farmer_id", "record_date", name="uq_farmer_daily_record"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    record_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Weather
    rain_mm: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    temp_c: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    weather_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weather_pulled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Water / irrigation
    et0_mm: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    crop_water_need_mm: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    irrigation_recommended: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # "skip" | "irrigate" | "skip_rain"
    irrigation_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    irrigation_confirmed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Fertilizer
    fertilizer_due: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fertilizer_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fertilizer_cost: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    fertilizer_confirmed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fertilizer_items: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
