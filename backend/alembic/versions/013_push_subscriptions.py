"""Push subscriptions table — Web Push API opt-in per device.

Revision ID: 013
Revises: 012
Create Date: 2026-06-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "farmer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("farmers.farmer_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(512), nullable=False),
        sa.Column("auth", sa.String(128), nullable=False),
        sa.Column("lang", sa.String(5), nullable=False, server_default="ta"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_push_subscriptions_farmer_id",
        "push_subscriptions",
        ["farmer_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_push_subscriptions_farmer_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
