"""Pillar 5 — Add disease_reports, outbreak_alerts tables; add fcm_token to farmers.

Revision ID: 003
Revises: 002
Create Date: 2026-06-17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── farmers.fcm_token ─────────────────────────────────────────────────────
    op.add_column(
        "farmers",
        sa.Column("fcm_token", sa.String(500), nullable=True),
    )

    # ── disease_reports ───────────────────────────────────────────────────────
    op.create_table(
        "disease_reports",
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "farmer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("farmers.farmer_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "diagnosis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diagnoses.diagnosis_id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("disease_class", sa.String(60), nullable=False),
        sa.Column("disease_name_ta", sa.String(120), nullable=True),
        sa.Column("crop_type", sa.String(60), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_disease_reports_farmer_id", "disease_reports", ["farmer_id"])
    op.create_index("ix_disease_reports_diagnosis_id", "disease_reports", ["diagnosis_id"])
    op.create_index("ix_disease_reports_disease_class", "disease_reports", ["disease_class"])
    op.create_index("ix_disease_reports_crop_type", "disease_reports", ["crop_type"])
    op.create_index("ix_disease_reports_reported_at", "disease_reports", ["reported_at"])

    # ── outbreak_alerts ───────────────────────────────────────────────────────
    op.create_table(
        "outbreak_alerts",
        sa.Column(
            "alert_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("disease_class", sa.String(60), nullable=False),
        sa.Column("disease_name_ta", sa.String(120), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=False),
        sa.Column("center_lng", sa.Float(), nullable=False),
        sa.Column("radius_km", sa.Float(), nullable=False, server_default="10.0"),
        sa.Column("report_count", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("alert_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("webhook_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "affected_report_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
    )
    op.create_index("ix_outbreak_alerts_disease_class", "outbreak_alerts", ["disease_class"])
    op.create_index("ix_outbreak_alerts_severity", "outbreak_alerts", ["severity"])
    op.create_index("ix_outbreak_alerts_detected_at", "outbreak_alerts", ["detected_at"])
    op.create_index("ix_outbreak_alerts_is_active", "outbreak_alerts", ["is_active"])


def downgrade() -> None:
    op.drop_table("outbreak_alerts")
    op.drop_table("disease_reports")
    op.drop_column("farmers", "fcm_token")
