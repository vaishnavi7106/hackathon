"""Complete schema — add Crop catalog, split Prescription, rename tables, add EligibilityResult

Revision ID: 002
Revises: 001
Create Date: 2026-06-16

Changes:
  NEW TABLES
    crops                        — crop master catalog
    fertilizer_recommendations   — replaces Prescription.fertilizer_* fields
    irrigation_plans             — replaces Prescription.irrigation_* fields
    eligibility_results          — replaces SchemeQuery+SchemeDeadlineAlert pattern

  TABLE RENAMES
    price_forecasts  → market_forecasts
    schemes          → government_schemes
      (PostgreSQL auto-updates FK in scheme_deadline_alerts after rename)

  NEW COLUMNS ON EXISTING TABLES
    diseases              : crop_id, symptoms_en, symptoms_ta
    diagnoses             : crop_id
    farmer_crops          : crop_id, sowing_date, expected_harvest_date
    market_forecasts      : crop_id, hold_sell_calculation_ta, mandi_comparison
    government_schemes    : eligible_income_bands, application_deadline_date
    scheme_queries        : scheme_id

  DATA MIGRATIONS
    crops seed (11 Tamil Nadu crops)
    diseases.crop_id backfill from diseases.crop
    diagnoses.crop_id backfill where crop matches a known crop_id
    farmer_crops.crop_id backfill where crop matches a known crop_id
    market_forecasts.crop_id backfill where crop matches a known crop_id
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Crop seed data ─────────────────────────────────────────────────────────────
_CROPS = [
    # (crop_id, name_en, name_ta, category, typical_seasons, avg_yield_kg/acre,
    #  water_req, growing_days, icar_code, is_priority)
    ("rice", "Rice", "நெல்", "cereal", "{kharif,rabi}", 1600, "high", 120, "RICE-TN", True),
    ("sugarcane", "Sugarcane", "கரும்பு", "cash_crop", "{annual}", 36000, "high", 365, "SUGA-TN", True),
    ("banana", "Banana", "வாழை", "fruit", "{annual}", 12000, "high", 300, "BANA-TN", True),
    ("groundnut", "Groundnut", "கடலை", "oilseed", "{kharif,rabi}", 600, "medium", 110, "GRND-TN", True),
    ("cotton", "Cotton", "பருத்தி", "cash_crop", "{kharif}", 400, "medium", 160, "COTN-TN", True),
    ("tomato", "Tomato", "தக்காளி", "vegetable", "{rabi,summer}", 8000, "medium", 75, "TOMA-TN", True),
    ("onion", "Onion", "வெங்காயம்", "vegetable", "{rabi}", 3200, "medium", 100, "ONIO-TN", False),
    ("maize", "Maize", "மக்காச்சோளம்", "cereal", "{kharif,rabi}", 2000, "medium", 95, "MAIZ-TN", False),
    ("blackgram", "Black Gram", "உளுந்து", "pulse", "{kharif,rabi}", 320, "low", 65, "BLGM-TN", False),
    ("greengram", "Green Gram", "பாசிப்பயறு", "pulse", "{kharif,rabi}", 280, "low", 65, "GRGM-TN", False),
    ("turmeric", "Turmeric", "மஞ்சள்", "spice", "{kharif}", 2400, "high", 240, "TURM-TN", False),
]


def upgrade() -> None:
    # ── 1. Create crops catalog ────────────────────────────────────────────────
    op.create_table(
        "crops",
        sa.Column("crop_id", sa.String(40), nullable=False),
        sa.Column("name_en", sa.String(80), nullable=False),
        sa.Column("name_ta", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("typical_seasons", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("avg_yield_kg_per_acre", sa.Numeric(8, 2), nullable=True),
        sa.Column("water_requirement", sa.String(10), nullable=True),
        sa.Column("growing_days", sa.Integer, nullable=True),
        sa.Column("icar_code", sa.String(20), nullable=True),
        sa.Column(
            "is_priority", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("crop_id"),
    )

    # Seed crop catalog
    op.execute(
        sa.text("""
        INSERT INTO crops
            (crop_id, name_en, name_ta, category, typical_seasons,
             avg_yield_kg_per_acre, water_requirement, growing_days, icar_code, is_priority)
        VALUES
            ('rice',      'Rice',       'நெல்',              'cereal',    ARRAY['kharif','rabi'],  1600,  'high',   120, 'RICE-TN', true),
            ('sugarcane', 'Sugarcane',  'கரும்பு',           'cash_crop', ARRAY['annual'],         36000, 'high',   365, 'SUGA-TN', true),
            ('banana',    'Banana',     'வாழை',              'fruit',     ARRAY['annual'],         12000, 'high',   300, 'BANA-TN', true),
            ('groundnut', 'Groundnut',  'கடலை',              'oilseed',   ARRAY['kharif','rabi'],  600,   'medium', 110, 'GRND-TN', true),
            ('cotton',    'Cotton',     'பருத்தி',           'cash_crop', ARRAY['kharif'],         400,   'medium', 160, 'COTN-TN', true),
            ('tomato',    'Tomato',     'தக்காளி',           'vegetable', ARRAY['rabi','summer'],  8000,  'medium', 75,  'TOMA-TN', true),
            ('onion',     'Onion',      'வெங்காயம்',        'vegetable', ARRAY['rabi'],           3200,  'medium', 100, 'ONIO-TN', false),
            ('maize',     'Maize',      'மக்காச்சோளம்',    'cereal',    ARRAY['kharif','rabi'],  2000,  'medium', 95,  'MAIZ-TN', false),
            ('blackgram', 'Black Gram', 'உளுந்து',           'pulse',     ARRAY['kharif','rabi'],  320,   'low',    65,  'BLGM-TN', false),
            ('greengram', 'Green Gram', 'பாசிப்பயறு',       'pulse',     ARRAY['kharif','rabi'],  280,   'low',    65,  'GRGM-TN', false),
            ('turmeric',  'Turmeric',   'மஞ்சள்',            'spice',     ARRAY['kharif'],         2400,  'high',   240, 'TURM-TN', false)
        ON CONFLICT (crop_id) DO NOTHING
        """)
    )

    # ── 2. Add crop_id + other columns to diseases ─────────────────────────────
    op.add_column("diseases", sa.Column("crop_id", sa.String(40), nullable=True))
    op.add_column("diseases", sa.Column("symptoms_en", sa.Text, nullable=True))
    op.add_column("diseases", sa.Column("symptoms_ta", sa.Text, nullable=True))
    op.create_index("ix_diseases_crop_id", "diseases", ["crop_id"])
    op.create_foreign_key(
        "fk_diseases_crop_id",
        "diseases",
        "crops",
        ["crop_id"],
        ["crop_id"],
        ondelete="SET NULL",
    )
    # Backfill crop_id from crop varchar for all seeded diseases
    op.execute(
        sa.text("""
        UPDATE diseases
        SET crop_id = crop
        WHERE crop IN (SELECT crop_id FROM crops)
        """)
    )

    # ── 3. Add crop_id, sowing_date, expected_harvest_date to farmer_crops ─────
    op.add_column("farmer_crops", sa.Column("crop_id", sa.String(40), nullable=True))
    op.add_column("farmer_crops", sa.Column("sowing_date", sa.Date, nullable=True))
    op.add_column(
        "farmer_crops", sa.Column("expected_harvest_date", sa.Date, nullable=True)
    )
    op.create_index("ix_farmer_crops_crop_id", "farmer_crops", ["crop_id"])
    op.create_foreign_key(
        "fk_farmer_crops_crop_id",
        "farmer_crops",
        "crops",
        ["crop_id"],
        ["crop_id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text("""
        UPDATE farmer_crops
        SET crop_id = crop
        WHERE crop IN (SELECT crop_id FROM crops)
        """)
    )

    # ── 4. Add crop_id to diagnoses ────────────────────────────────────────────
    op.add_column("diagnoses", sa.Column("crop_id", sa.String(40), nullable=True))
    op.create_index("ix_diagnoses_crop_id", "diagnoses", ["crop_id"])
    op.create_foreign_key(
        "fk_diagnoses_crop_id",
        "diagnoses",
        "crops",
        ["crop_id"],
        ["crop_id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text("""
        UPDATE diagnoses
        SET crop_id = crop
        WHERE crop IN (SELECT crop_id FROM crops)
        """)
    )

    # ── 5. Rename price_forecasts → market_forecasts ───────────────────────────
    op.rename_table("price_forecasts", "market_forecasts")
    op.execute(
        sa.text(
            "ALTER INDEX IF EXISTS ix_price_forecasts_farmer_id"
            " RENAME TO ix_market_forecasts_farmer_id"
        )
    )
    # Add new columns
    op.add_column("market_forecasts", sa.Column("crop_id", sa.String(40), nullable=True))
    op.add_column(
        "market_forecasts", sa.Column("hold_sell_calculation_ta", sa.Text, nullable=True)
    )
    op.add_column(
        "market_forecasts",
        sa.Column(
            "mandi_comparison",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.create_index("ix_market_forecasts_crop_id", "market_forecasts", ["crop_id"])
    op.create_foreign_key(
        "fk_market_forecasts_crop_id",
        "market_forecasts",
        "crops",
        ["crop_id"],
        ["crop_id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text("""
        UPDATE market_forecasts
        SET crop_id = crop
        WHERE crop IN (SELECT crop_id FROM crops)
        """)
    )

    # ── 6. Rename schemes → government_schemes ─────────────────────────────────
    # PostgreSQL auto-updates the FK in scheme_deadline_alerts after rename.
    op.rename_table("schemes", "government_schemes")
    # Add new columns
    op.add_column(
        "government_schemes",
        sa.Column("eligible_income_bands", postgresql.ARRAY(sa.String), nullable=True),
    )
    op.add_column(
        "government_schemes",
        sa.Column("application_deadline_date", sa.Date, nullable=True),
    )

    # ── 7. Add scheme_id FK column to scheme_queries ───────────────────────────
    op.add_column("scheme_queries", sa.Column("scheme_id", sa.String(60), nullable=True))
    op.create_index("ix_scheme_queries_scheme_id", "scheme_queries", ["scheme_id"])
    op.create_foreign_key(
        "fk_scheme_queries_scheme_id",
        "scheme_queries",
        "government_schemes",
        ["scheme_id"],
        ["scheme_id"],
        ondelete="SET NULL",
    )

    # ── 8. Create fertilizer_recommendations ───────────────────────────────────
    op.create_table(
        "fertilizer_recommendations",
        sa.Column(
            "recommendation_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("soil_test_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("crop_id", sa.String(40), nullable=False),
        sa.Column("season", sa.String(20), nullable=True),
        sa.Column("acres", sa.Numeric(5, 2), nullable=True),
        sa.Column("nitrogen_kg_per_acre", sa.Numeric(6, 2), nullable=True),
        sa.Column("phosphorus_kg_per_acre", sa.Numeric(6, 2), nullable=True),
        sa.Column("potassium_kg_per_acre", sa.Numeric(6, 2), nullable=True),
        sa.Column("micro_flags", postgresql.JSONB, nullable=True),
        sa.Column("total_cost_estimate", sa.Numeric(8, 2), nullable=True),
        sa.Column("savings_vs_standard", sa.Numeric(8, 2), nullable=True),
        sa.Column("savings_note_ta", sa.Text, nullable=True),
        sa.Column(
            "application_schedule",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("model_version", sa.String(20), nullable=True),
        sa.Column(
            "source", sa.String(20), nullable=False, server_default="icar_baseline"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("recommendation_id"),
        sa.ForeignKeyConstraint(
            ["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["soil_test_id"], ["soil_tests.test_id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["crop_id"], ["crops.crop_id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "source IN ('ml_model','icar_baseline','manual')",
            name="ck_fertilizer_source",
        ),
    )
    op.create_index(
        "ix_fertilizer_recs_farmer_id", "fertilizer_recommendations", ["farmer_id"]
    )
    op.create_index(
        "ix_fertilizer_recs_crop_id", "fertilizer_recommendations", ["crop_id"]
    )

    # ── 9. Create irrigation_plans ─────────────────────────────────────────────
    op.create_table(
        "irrigation_plans",
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "fertilizer_recommendation_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("crop_id", sa.String(40), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column(
            "schedule",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("total_sessions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rain_skips", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("water_cost_estimate", sa.Numeric(8, 2), nullable=True),
        sa.Column(
            "joint_calendar",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("weather_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("model_version", sa.String(20), nullable=True),
        sa.Column(
            "source", sa.String(20), nullable=False, server_default="rule_based"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("plan_id"),
        sa.ForeignKeyConstraint(
            ["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["fertilizer_recommendation_id"],
            ["fertilizer_recommendations.recommendation_id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["crop_id"], ["crops.crop_id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "source IN ('lstm_model','rule_based')", name="ck_irrigation_source"
        ),
    )
    op.create_index("ix_irrigation_plans_farmer_id", "irrigation_plans", ["farmer_id"])
    op.create_index("ix_irrigation_plans_crop_id", "irrigation_plans", ["crop_id"])

    # ── 10. Create eligibility_results ─────────────────────────────────────────
    op.create_table(
        "eligibility_results",
        sa.Column(
            "result_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scheme_id", sa.String(60), nullable=False),
        sa.Column("is_eligible", sa.Boolean, nullable=False),
        sa.Column(
            "criteria_results",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("query_text", sa.Text, nullable=True),
        sa.Column("llm_response", sa.Text, nullable=True),
        sa.Column("language", sa.String(5), nullable=False, server_default="ta"),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("deadline_date", sa.Date, nullable=True),
        sa.Column("days_to_deadline", sa.Integer, nullable=True),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("result_id"),
        sa.ForeignKeyConstraint(
            ["farmer_id"], ["farmers.farmer_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["scheme_id"],
            ["government_schemes.scheme_id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_eligibility_results_farmer_id", "eligibility_results", ["farmer_id"]
    )
    op.create_index(
        "ix_eligibility_results_scheme_id", "eligibility_results", ["scheme_id"]
    )
    # Partial index for fast deadline alert queries
    op.create_index(
        "ix_eligibility_results_deadline",
        "eligibility_results",
        ["deadline_date"],
        postgresql_where=sa.text("is_eligible = true AND deadline_date IS NOT NULL"),
    )


def downgrade() -> None:
    # ── 10. Drop eligibility_results ───────────────────────────────────────────
    op.drop_table("eligibility_results")

    # ── 9. Drop irrigation_plans ───────────────────────────────────────────────
    op.drop_table("irrigation_plans")

    # ── 8. Drop fertilizer_recommendations ─────────────────────────────────────
    op.drop_table("fertilizer_recommendations")

    # ── 7. Remove scheme_id from scheme_queries ────────────────────────────────
    op.drop_constraint("fk_scheme_queries_scheme_id", "scheme_queries", type_="foreignkey")
    op.drop_index("ix_scheme_queries_scheme_id", "scheme_queries")
    op.drop_column("scheme_queries", "scheme_id")

    # ── 6. Rename government_schemes → schemes ─────────────────────────────────
    op.drop_column("government_schemes", "application_deadline_date")
    op.drop_column("government_schemes", "eligible_income_bands")
    op.rename_table("government_schemes", "schemes")

    # ── 5. Rename market_forecasts → price_forecasts ───────────────────────────
    op.drop_constraint(
        "fk_market_forecasts_crop_id", "market_forecasts", type_="foreignkey"
    )
    op.drop_index("ix_market_forecasts_crop_id", "market_forecasts")
    op.drop_column("market_forecasts", "mandi_comparison")
    op.drop_column("market_forecasts", "hold_sell_calculation_ta")
    op.drop_column("market_forecasts", "crop_id")
    op.rename_table("market_forecasts", "price_forecasts")
    op.execute(
        sa.text(
            "ALTER INDEX IF EXISTS ix_market_forecasts_farmer_id"
            " RENAME TO ix_price_forecasts_farmer_id"
        )
    )

    # ── 4. Remove crop_id from diagnoses ───────────────────────────────────────
    op.drop_constraint("fk_diagnoses_crop_id", "diagnoses", type_="foreignkey")
    op.drop_index("ix_diagnoses_crop_id", "diagnoses")
    op.drop_column("diagnoses", "crop_id")

    # ── 3. Remove crop_id, sowing_date, expected_harvest_date from farmer_crops ─
    op.drop_constraint("fk_farmer_crops_crop_id", "farmer_crops", type_="foreignkey")
    op.drop_index("ix_farmer_crops_crop_id", "farmer_crops")
    op.drop_column("farmer_crops", "expected_harvest_date")
    op.drop_column("farmer_crops", "sowing_date")
    op.drop_column("farmer_crops", "crop_id")

    # ── 2. Remove crop_id, symptoms from diseases ──────────────────────────────
    op.drop_constraint("fk_diseases_crop_id", "diseases", type_="foreignkey")
    op.drop_index("ix_diseases_crop_id", "diseases")
    op.drop_column("diseases", "symptoms_ta")
    op.drop_column("diseases", "symptoms_en")
    op.drop_column("diseases", "crop_id")

    # ── 1. Drop crops catalog ──────────────────────────────────────────────────
    op.drop_table("crops")
