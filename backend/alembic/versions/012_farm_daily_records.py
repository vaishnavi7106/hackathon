"""Farm daily records table — weather, ET0, irrigation and fertilizer tracking.

Revision ID: 012
Revises: 011
Create Date: 2026-06-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "farm_daily_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "farmer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("record_date", sa.Date(), nullable=False),
        # Weather
        sa.Column("rain_mm", sa.Numeric(6, 2), nullable=True),
        sa.Column("temp_c", sa.Numeric(5, 2), nullable=True),
        sa.Column("humidity_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("weather_source", sa.String(50), nullable=True),
        sa.Column("weather_pulled_at", sa.DateTime(timezone=True), nullable=True),
        # ET0 / irrigation
        sa.Column("et0_mm", sa.Numeric(6, 2), nullable=True),
        sa.Column("crop_water_need_mm", sa.Numeric(6, 2), nullable=True),
        sa.Column("irrigation_recommended", sa.String(10), nullable=True),
        sa.Column("irrigation_minutes", sa.Integer(), nullable=True),
        sa.Column("irrigation_confirmed", sa.Boolean(), nullable=True),
        # Fertilizer
        sa.Column("fertilizer_due", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fertilizer_stage", sa.String(100), nullable=True),
        sa.Column("fertilizer_cost", sa.Numeric(8, 2), nullable=True),
        sa.Column("fertilizer_confirmed", sa.Boolean(), nullable=True),
        sa.Column("fertilizer_items", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # Constraints
        sa.UniqueConstraint("farmer_id", "record_date", name="uq_farmer_daily_record"),
    )

    op.create_index(
        "ix_farm_daily_records_farmer_id",
        "farm_daily_records",
        ["farmer_id"],
    )
    op.create_index(
        "ix_farm_daily_records_farmer_date",
        "farm_daily_records",
        ["farmer_id", "record_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_farm_daily_records_farmer_date", table_name="farm_daily_records")
    op.drop_index("ix_farm_daily_records_farmer_id", table_name="farm_daily_records")
    op.drop_table("farm_daily_records")
