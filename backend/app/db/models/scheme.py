"""Government scheme models — Pillar 4 (Government Navigator).

Table rename history:
  001_initial_schema  → schemes
  002_complete_schema → government_schemes  (ALTER TABLE ... RENAME TO ...)

Scheme is kept as an alias so existing crud/schemes.py imports don't break.

EligibilityResult (new in 002) is the canonical record of a farmer's eligibility
check for a scheme, replacing the ad-hoc SchemeQuery + SchemeDeadlineAlert pattern
for new code.  Both old models are retained for backward compat.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GovernmentScheme(Base):
    """Catalog of Tamil Nadu / Central government farm schemes.

    DB table name: government_schemes (renamed from schemes in migration 002).
    scheme_id is a human-readable slug (e.g. 'pm_kisan', 'tnau_soil_health').
    """

    __tablename__ = "government_schemes"

    scheme_id: Mapped[str] = mapped_column(String(60), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False)
    name_ta: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    state: Mapped[str] = mapped_column(String(60), default="All India", nullable=False)
    benefit_amount: Mapped[str | None] = mapped_column(String(200), nullable=True)
    benefit_amount_ta: Mapped[str | None] = mapped_column(String(200), nullable=True)
    benefit_amount_num: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Eligibility criteria (used for SQL pre-filter)
    min_land_acres: Mapped[float] = mapped_column(Numeric(6, 2), default=0.0, nullable=False)
    max_land_acres: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    requires_aadhaar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    eligible_crops: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    eligible_districts: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # income_band_max kept for compat with migration 001 data
    income_band_max: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # eligible_income_bands replaces income_band_max for new code (added in migration 002)
    eligible_income_bands: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # Structured eligibility constraints (added in migration 007)
    min_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_bank_account: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    eligible_land_ownership: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Application info
    documents_required: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    application_deadline: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )  # human-readable string
    application_deadline_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )  # machine-readable date (added in migration 002)
    application_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    office_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Department info (added in migration 005)
    department_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department_ta: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Scheme metadata (added in migration 005)
    scheme_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    year: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_scheme_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # English content (added in migration 005)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    eligibility_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source provenance URL (separate from application_url; added in migration 005)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Application process detail (added in migration 006)
    application_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    application_portal_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    application_process_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Tamil content
    description_ta: Mapped[str] = mapped_column(Text, nullable=False)
    eligibility_ta: Mapped[str | None] = mapped_column(Text, nullable=True)
    documents_ta: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Meta
    last_verified: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    eligibility_results: Mapped[list["EligibilityResult"]] = relationship(
        "EligibilityResult", back_populates="scheme"
    )
    queries: Mapped[list["SchemeQuery"]] = relationship("SchemeQuery", back_populates="scheme")
    deadline_alerts: Mapped[list["SchemeDeadlineAlert"]] = relationship(
        "SchemeDeadlineAlert", back_populates="scheme"
    )


class EligibilityResult(Base):
    """Canonical record of a farmer eligibility check for a scheme (new in 002).

    Captures:
    - Which criteria passed / failed (criteria_results JSONB)
    - The LLM conversation (query_text, llm_response)
    - Deadline snapshot at time of check (deadline_date, days_to_deadline)
    """

    __tablename__ = "eligibility_results"

    result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheme_id: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("government_schemes.scheme_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Eligibility verdict
    is_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    eligibility_state: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ELIGIBLE|NOT_ELIGIBLE|NEEDS_MORE_INFO

    # Per-criterion pass/fail breakdown
    # e.g. {"land_size": true, "aadhaar": true, "crop_match": false, "district_match": true}
    criteria_results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # LLM interaction
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(5), default="ta", nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Deadline snapshot at time of check
    deadline_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    days_to_deadline: Mapped[int | None] = mapped_column(Integer, nullable=True)

    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="eligibility_results")
    scheme: Mapped["GovernmentScheme"] = relationship(
        "GovernmentScheme", back_populates="eligibility_results"
    )


class SchemeQuery(Base):
    """Audit log of every LLM query through the Government Navigator chat.

    Retained from migration 001 for backward compat.
    New code should use EligibilityResult.
    """

    __tablename__ = "scheme_queries"

    query_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # scheme_id FK added in migration 002 (nullable — not all chats target one scheme)
    scheme_id: Mapped[str | None] = mapped_column(
        String(60),
        ForeignKey("government_schemes.scheme_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(String(5), nullable=True)
    schemes_ctx: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    llm_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="scheme_queries")
    scheme: Mapped["GovernmentScheme | None"] = relationship(
        "GovernmentScheme", back_populates="queries"
    )


class SchemeDeadlineAlert(Base):
    """Farmer × scheme deadline alert (retained from migration 001)."""

    __tablename__ = "scheme_deadline_alerts"

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheme_id: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("government_schemes.scheme_id", ondelete="CASCADE"),
        nullable=False,
    )
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    alert_30d: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alert_7d: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    scheme: Mapped["GovernmentScheme"] = relationship(
        "GovernmentScheme", back_populates="deadline_alerts"
    )


# Backward-compat alias — existing CRUD code imports Scheme and still works.
Scheme = GovernmentScheme
