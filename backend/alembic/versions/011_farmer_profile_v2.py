"""Farmer Profile v2 — profile-centric architecture.

Adds crop/season/irrigation/soil fields directly on the farmers table so every
pillar can read profile data without hitting the FarmerCrop child table.

Revision ID: 011
Revises: 010
Create Date: 2026-06-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("farmers", sa.Column("taluk", sa.String(100), nullable=True))
    op.add_column("farmers", sa.Column("gender", sa.String(10), nullable=True))
    op.add_column("farmers", sa.Column("primary_crop", sa.String(60), nullable=True))
    op.add_column("farmers", sa.Column("secondary_crop", sa.String(60), nullable=True))
    op.add_column("farmers", sa.Column("season", sa.String(20), nullable=True))
    op.add_column("farmers", sa.Column("irrigation_type", sa.String(20), nullable=True))
    op.add_column("farmers", sa.Column("soil_type", sa.String(20), nullable=True))
    op.add_column("farmers", sa.Column("soil_health_card_path", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("farmers", "soil_health_card_path")
    op.drop_column("farmers", "soil_type")
    op.drop_column("farmers", "irrigation_type")
    op.drop_column("farmers", "season")
    op.drop_column("farmers", "secondary_crop")
    op.drop_column("farmers", "primary_crop")
    op.drop_column("farmers", "gender")
    op.drop_column("farmers", "taluk")
