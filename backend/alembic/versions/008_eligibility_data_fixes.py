"""Eligibility data fixes: PM-KISAN owner-only, TN-AGRI-173 district list, TN-AGRI-165 millet crops

Revision ID: 008
Revises: 007
Create Date: 2026-06-18
"""
from alembic import op
from sqlalchemy.sql import text

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None

# 29 rainfed districts for TN-AGRI-173 (Thanjavur is NOT in this list — it's a delta district)
_TN_AGRI_173_DISTRICTS = [
    "Ariyalur", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul",
    "Karur", "Krishnagiri", "Kallakurichi", "Vellore", "Madurai",
    "Namakkal", "Perambalur", "Ramanathapuram", "Salem", "Thoothukudi",
    "Trichy", "Tiruvannamalai", "Villupuram", "Virudhunagar", "Sivagangai",
    "Tiruppur", "Ranipet", "Thiruppathur", "Thiruvarur", "Tiruvallur",
    "Erode", "Thenkasi", "Pudukottai", "Theni",
]

_MILLET_CROPS = [
    "ragi", "bajra", "jowar", "sorghum",
    "finger millet", "pearl millet", "foxtail millet",
    "little millet", "kodo millet", "barnyard millet",
    "millets",
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. PM-KISAN: owner-only + requires_bank_account
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_land_ownership = ARRAY['own'],
            requires_bank_account   = TRUE
        WHERE scheme_id = 'CEN-PMKISAN'
    """))

    # 2. TN-AGRI-173: restrict to 29 rainfed districts (excludes Thanjavur / delta districts)
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_districts = :districts
        WHERE scheme_id = 'TN-AGRI-173'
    """), {"districts": _TN_AGRI_173_DISTRICTS})

    # 3. TN-AGRI-165: Millet Mission — only for millet-growing farmers
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_crops = :crops
        WHERE scheme_id = 'TN-AGRI-165'
    """), {"crops": _MILLET_CROPS})


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_land_ownership = NULL,
            requires_bank_account   = FALSE
        WHERE scheme_id = 'CEN-PMKISAN'
    """))
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_districts = NULL
        WHERE scheme_id = 'TN-AGRI-173'
    """))
    conn.execute(text("""
        UPDATE government_schemes
        SET eligible_crops = NULL
        WHERE scheme_id = 'TN-AGRI-165'
    """))
