import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SoilTest(Base):
    __tablename__ = "soil_tests"

    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tested_at: Mapped[date] = mapped_column(Date, nullable=False)
    ph: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    nitrogen: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    phosphorus: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    potassium: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    organic_matter: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    zinc: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    iron: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    copper: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    boron: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="farmer_input", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="soil_tests")
    fertilizer_recommendations: Mapped[list["FertilizerRecommendation"]] = relationship(
        "FertilizerRecommendation", back_populates="soil_test"
    )
