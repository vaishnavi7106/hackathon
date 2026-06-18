"""Pillar 4 — Eligibility engine v2.

Adds per-scheme age/bank/ownership constraints and farmer eligibility fields.
Fixes requires_aadhaar for DBT schemes. Seeds crop lists for oilseed and
Kuruvai paddy schemes. Adds NEEDS_MORE_INFO state to EligibilityResult.

Revision ID: 007
Revises: 006
Create Date: 2026-06-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Add new columns to farmers ────────────────────────────────────────────
    op.add_column("farmers", sa.Column("age", sa.SmallInteger(), nullable=True))
    op.add_column("farmers", sa.Column("bank_account_linked", sa.Boolean(), nullable=True))
    op.add_column("farmers", sa.Column("land_ownership", sa.String(20), nullable=True))

    # ── Add new eligibility-constraint columns to government_schemes ──────────
    op.add_column("government_schemes", sa.Column("min_age", sa.Integer(), nullable=True))
    op.add_column("government_schemes", sa.Column("max_age", sa.Integer(), nullable=True))
    op.add_column(
        "government_schemes",
        sa.Column("requires_bank_account", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "government_schemes",
        sa.Column("eligible_land_ownership", ARRAY(sa.String()), nullable=True),
    )

    # ── Add eligibility_state to eligibility_results ──────────────────────────
    op.add_column(
        "eligibility_results",
        sa.Column("eligibility_state", sa.String(20), nullable=True),
    )
    # Back-fill existing rows from is_eligible
    op.execute(sa.text("""
        UPDATE eligibility_results
        SET eligibility_state = CASE WHEN is_eligible THEN 'ELIGIBLE' ELSE 'NOT_ELIGIBLE' END
        WHERE eligibility_state IS NULL
    """))

    # ── Fix requires_aadhaar for DBT-disbursed schemes ────────────────────────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET requires_aadhaar = TRUE
        WHERE scheme_id IN ('CEN-PMKSY', 'CEN-PMKMY')
    """))

    # ── Set requires_bank_account for schemes with DBT payouts ────────────────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET requires_bank_account = TRUE
        WHERE scheme_id IN ('CEN-PMKISAN', 'CEN-PMKSY', 'CEN-PMKMY', 'CEN-PKVY')
    """))

    # ── Age constraints for PM Kisan Mandhan Yojana (pension scheme 18–40) ────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET min_age = 18, max_age = 40
        WHERE scheme_id = 'CEN-PMKMY'
    """))

    # ── Income band for PM-KMY (small/marginal: income < ₹2 lakh/year) ───────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET eligible_income_bands = ARRAY['below_1L', '1L_2L']
        WHERE scheme_id = 'CEN-PMKMY'
    """))

    # ── Eligible crops: Oilseed Mission (groundnut, gingelly, sunflower) ──────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET eligible_crops = ARRAY['groundnut', 'gingelly', 'sunflower']
        WHERE scheme_id = 'TN-AGRI-172'
    """))

    # ── Eligible crops: Kuruvai Paddy Package ─────────────────────────────────
    op.execute(sa.text("""
        UPDATE government_schemes
        SET eligible_crops = ARRAY['rice']
        WHERE scheme_id = 'TN-AGRI-177'
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        UPDATE government_schemes
        SET eligible_income_bands = NULL
        WHERE scheme_id = 'CEN-PMKMY'
    """))
    op.execute(sa.text("""
        UPDATE government_schemes
        SET eligible_crops = NULL
        WHERE scheme_id IN ('TN-AGRI-172', 'TN-AGRI-177')
    """))
    op.execute(sa.text("""
        UPDATE government_schemes
        SET requires_aadhaar = FALSE
        WHERE scheme_id IN ('CEN-PMKSY', 'CEN-PMKMY')
    """))
    op.execute(sa.text("""
        UPDATE government_schemes
        SET min_age = NULL, max_age = NULL
        WHERE scheme_id = 'CEN-PMKMY'
    """))
    op.drop_column("eligibility_results", "eligibility_state")
    op.drop_column("government_schemes", "eligible_land_ownership")
    op.drop_column("government_schemes", "requires_bank_account")
    op.drop_column("government_schemes", "max_age")
    op.drop_column("government_schemes", "min_age")
    op.drop_column("farmers", "land_ownership")
    op.drop_column("farmers", "bank_account_linked")
    op.drop_column("farmers", "age")
