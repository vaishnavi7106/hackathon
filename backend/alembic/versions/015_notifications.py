"""create notifications table

Revision ID: 015
Revises: 014
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("notification_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("farmer_id", UUID(as_uuid=True), sa.ForeignKey("farmers.farmer_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("title_en", sa.String(200), nullable=False),
        sa.Column("title_ta", sa.String(200), nullable=False),
        sa.Column("body_en", sa.Text, nullable=False),
        sa.Column("body_ta", sa.Text, nullable=False),
        sa.Column("icon_type", sa.String(20), nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("action_route", sa.String(100), nullable=True),
        sa.Column("action_params", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_notifications_farmer_created", "notifications", ["farmer_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_farmer_created", "notifications")
    op.drop_table("notifications")
