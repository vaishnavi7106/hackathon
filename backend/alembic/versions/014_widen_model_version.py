"""widen diagnoses.model_version to VARCHAR(50)

Revision ID: 014
Revises: 013
Create Date: 2026-06-21
"""

from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "diagnoses",
        "model_version",
        type_=sa.String(50),
        existing_type=sa.String(20),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "diagnoses",
        "model_version",
        type_=sa.String(20),
        existing_type=sa.String(50),
        existing_nullable=True,
    )
