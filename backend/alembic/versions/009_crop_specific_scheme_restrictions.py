"""Add eligible_crops to crop-specific state schemes (NADP, FNSM, SADS)

Revision ID: 009
Revises: 008
Create Date: 2026-06-18
"""
from alembic import op
from sqlalchemy.sql import text

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None

# TN-AGRI-163 NADP: maize expansion, transplanted redgram, cotton, paddy improvement
_NADP_CROPS = ["maize", "redgram", "cotton", "rice", "paddy"]

# TN-AGRI-164 FNSM: maize, nutritious millets, cotton, sugarcane, pulses, rice
_FNSM_CROPS = ["maize", "millets", "ragi", "bajra", "jowar", "cotton",
               "sugarcane", "pulses", "rice", "paddy", "redgram", "blackgram", "greengram"]

# TN-AGRI-175 SADS: cotton cultivation, redgram expansion, traditional paddy seeds
_SADS_CROPS = ["cotton", "redgram", "rice", "paddy"]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("UPDATE government_schemes SET eligible_crops = :c WHERE scheme_id = 'TN-AGRI-163'"),
                 {"c": _NADP_CROPS})
    conn.execute(text("UPDATE government_schemes SET eligible_crops = :c WHERE scheme_id = 'TN-AGRI-164'"),
                 {"c": _FNSM_CROPS})
    conn.execute(text("UPDATE government_schemes SET eligible_crops = :c WHERE scheme_id = 'TN-AGRI-175'"),
                 {"c": _SADS_CROPS})


def downgrade() -> None:
    conn = op.get_bind()
    for sid in ("TN-AGRI-163", "TN-AGRI-164", "TN-AGRI-175"):
        conn.execute(text(f"UPDATE government_schemes SET eligible_crops = NULL WHERE scheme_id = '{sid}'"))
