"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2025-06-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ farmers
    op.create_table(
        "farmers",
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone", sa.String(12), nullable=True),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("district", sa.String(60), nullable=False),
        sa.Column("village", sa.String(100), nullable=True),
        sa.Column("land_size_acres", sa.Numeric(6, 2), nullable=True),
        sa.Column("pump_type", sa.String(20), nullable=True),
        sa.Column("storage_facility", sa.String(20), nullable=True),
        sa.Column("language", sa.String(5), nullable=False, server_default="ta"),
        sa.Column("aadhaar_linked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("income_band", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("farmer_id"),
        sa.CheckConstraint("pump_type IN ('diesel','electric','none')", name="ck_farmer_pump_type"),
        sa.CheckConstraint("storage_facility IN ('home','warehouse','cold_storage')", name="ck_farmer_storage"),
        sa.CheckConstraint("language IN ('ta','hi','en')", name="ck_farmer_language"),
    )
    op.create_index("ix_farmers_phone", "farmers", ["phone"], unique=True)

    # --------------------------------------------------------------- farmer_crops
    op.create_table(
        "farmer_crops",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("crop", sa.String(60), nullable=False),
        sa.Column("acres", sa.Numeric(5, 2), nullable=False),
        sa.Column("season", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_farmer_crops_farmer_id", "farmer_crops", ["farmer_id"])

    # ---------------------------------------------------------------- soil_tests
    op.create_table(
        "soil_tests",
        sa.Column("test_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tested_at", sa.Date, nullable=False),
        sa.Column("ph", sa.Numeric(4, 2), nullable=True),
        sa.Column("nitrogen", sa.Numeric(6, 2), nullable=True),
        sa.Column("phosphorus", sa.Numeric(6, 2), nullable=True),
        sa.Column("potassium", sa.Numeric(6, 2), nullable=True),
        sa.Column("organic_matter", sa.Numeric(5, 2), nullable=True),
        sa.Column("zinc", sa.Numeric(6, 3), nullable=True),
        sa.Column("iron", sa.Numeric(6, 3), nullable=True),
        sa.Column("copper", sa.Numeric(6, 3), nullable=True),
        sa.Column("boron", sa.Numeric(6, 3), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="farmer_input"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("test_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_soil_tests_farmer_id", "soil_tests", ["farmer_id"])

    # ----------------------------------------------------------------- diseases
    op.create_table(
        "diseases",
        sa.Column("disease_id", sa.String(60), nullable=False),
        sa.Column("crop", sa.String(60), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=False),
        sa.Column("name_ta", sa.String(120), nullable=False),
        sa.Column("modern_chemical", sa.String(200), nullable=True),
        sa.Column("modern_dosage", sa.String(100), nullable=True),
        sa.Column("modern_cost_acre", sa.Numeric(8, 2), nullable=True),
        sa.Column("supply_note", sa.String(200), nullable=True),
        sa.Column("indigenous_name", sa.String(120), nullable=True),
        sa.Column("indigenous_method", sa.Text, nullable=True),
        sa.Column("indigenous_method_ta", sa.Text, nullable=True),
        sa.Column("icar_reference", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("disease_id"),
    )

    # ---------------------------------------------------------------- diagnoses
    op.create_table(
        "diagnoses",
        sa.Column("diagnosis_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("image_key", sa.String(500), nullable=False),
        sa.Column("heatmap_key", sa.String(500), nullable=True),
        sa.Column("crop", sa.String(60), nullable=True),
        sa.Column("disease_id", sa.String(60), nullable=True),
        sa.Column("disease_name_en", sa.String(120), nullable=True),
        sa.Column("disease_name_ta", sa.String(120), nullable=True),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("low_confidence", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("model_version", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("diagnosis_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"),
    )
    op.create_index("ix_diagnoses_farmer_id", "diagnoses", ["farmer_id"])
    op.create_index("ix_diagnoses_disease_id", "diagnoses", ["disease_id"])

    # --------------------------------------------------------------- prescriptions
    op.create_table(
        "prescriptions",
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("soil_test_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("crop", sa.String(60), nullable=False),
        sa.Column("season", sa.String(20), nullable=True),
        sa.Column("nitrogen_kg", sa.Numeric(6, 2), nullable=True),
        sa.Column("phosphorus_kg", sa.Numeric(6, 2), nullable=True),
        sa.Column("potassium_kg", sa.Numeric(6, 2), nullable=True),
        sa.Column("micro_flags", postgresql.JSONB, nullable=True),
        sa.Column("fertilizer_cost", sa.Numeric(8, 2), nullable=True),
        sa.Column("fertilizer_save", sa.Numeric(8, 2), nullable=True),
        sa.Column("irrigation_plan", postgresql.JSONB, nullable=False, server_default="'[]'::jsonb"),
        sa.Column("water_cost_est", sa.Numeric(8, 2), nullable=True),
        sa.Column("joint_calendar", postgresql.JSONB, nullable=False, server_default="'[]'::jsonb"),
        sa.Column("weather_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("model_version", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("prescription_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["soil_test_id"], ["soil_tests.test_id"], ondelete="SET NULL"),
    )
    op.create_index("ix_prescriptions_farmer_id", "prescriptions", ["farmer_id"])

    # ------------------------------------------------------------------- mandis
    op.create_table(
        "mandis",
        sa.Column("mandi_id", sa.String(60), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("district", sa.String(60), nullable=False),
        sa.Column("state", sa.String(60), nullable=False, server_default="Tamil Nadu"),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("enam_linked", sa.Boolean, nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("mandi_id"),
    )

    # -------------------------------------------------------------- mandi_prices
    op.create_table(
        "mandi_prices",
        sa.Column("id", sa.BigInteger, nullable=False, autoincrement=True),
        sa.Column("mandi_id", sa.String(60), nullable=False),
        sa.Column("crop", sa.String(60), nullable=False),
        sa.Column("price_date", sa.Date, nullable=False),
        sa.Column("min_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("max_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("modal_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="agmarknet"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["mandi_id"], ["mandis.mandi_id"]),
        sa.UniqueConstraint("mandi_id", "crop", "price_date", "source", name="uq_mandi_price"),
    )
    op.create_index("ix_mandi_prices_lookup", "mandi_prices", ["crop", "mandi_id", "price_date"])

    # -------------------------------------------------------------- price_forecasts
    op.create_table(
        "price_forecasts",
        sa.Column("forecast_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("crop", sa.String(60), nullable=False),
        sa.Column("mandi_id", sa.String(60), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("forecast_data", postgresql.JSONB, nullable=False, server_default="'[]'::jsonb"),
        sa.Column("today_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("peak_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("peak_date", sa.Date, nullable=True),
        sa.Column("storage_type", sa.String(20), nullable=True),
        sa.Column("storage_cost", sa.Numeric(10, 2), nullable=True),
        sa.Column("net_gain", sa.Numeric(10, 2), nullable=True),
        sa.Column("recommendation", sa.String(10), nullable=True),
        sa.Column("model_version", sa.String(20), nullable=True),
        sa.PrimaryKeyConstraint("forecast_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["mandi_id"], ["mandis.mandi_id"], ondelete="SET NULL"),
        sa.CheckConstraint("recommendation IN ('HOLD','SELL')", name="ck_forecast_recommendation"),
    )
    op.create_index("ix_price_forecasts_farmer_id", "price_forecasts", ["farmer_id"])

    # ------------------------------------------------------------------- schemes
    op.create_table(
        "schemes",
        sa.Column("scheme_id", sa.String(60), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=False),
        sa.Column("name_ta", sa.String(200), nullable=False),
        sa.Column("level", sa.String(20), nullable=True),
        sa.Column("state", sa.String(60), nullable=False, server_default="All India"),
        sa.Column("benefit_amount", sa.String(200), nullable=True),
        sa.Column("benefit_amount_num", sa.Numeric(10, 2), nullable=True),
        sa.Column("max_land_acres", sa.Numeric(6, 2), nullable=True),
        sa.Column("min_land_acres", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("requires_aadhaar", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("eligible_crops", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("eligible_districts", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("income_band_max", sa.String(20), nullable=True),
        sa.Column("documents_required", postgresql.ARRAY(sa.String), nullable=False),
        sa.Column("application_deadline", sa.String(200), nullable=True),
        sa.Column("application_url", sa.String(500), nullable=True),
        sa.Column("office_type", sa.String(100), nullable=True),
        sa.Column("description_ta", sa.Text, nullable=False),
        sa.Column("eligibility_ta", sa.Text, nullable=True),
        sa.Column("documents_ta", postgresql.ARRAY(sa.String), nullable=True),
        sa.Column("last_verified", sa.Date, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("scheme_id"),
        sa.CheckConstraint("level IN ('central','state')", name="ck_scheme_level"),
    )

    # -------------------------------------------------------------- scheme_queries
    op.create_table(
        "scheme_queries",
        sa.Column("query_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("query_text", sa.Text, nullable=False),
        sa.Column("language", sa.String(5), nullable=True),
        sa.Column("schemes_ctx", postgresql.JSONB, nullable=True),
        sa.Column("llm_response", sa.Text, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("query_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="SET NULL"),
    )
    op.create_index("ix_scheme_queries_farmer_id", "scheme_queries", ["farmer_id"])

    # -------------------------------------------------------- scheme_deadline_alerts
    op.create_table(
        "scheme_deadline_alerts",
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scheme_id", sa.String(60), nullable=False),
        sa.Column("deadline", sa.Date, nullable=False),
        sa.Column("alert_30d", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("alert_7d", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("dismissed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("alert_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scheme_id"], ["schemes.scheme_id"]),
        sa.UniqueConstraint("farmer_id", "scheme_id", name="uq_farmer_scheme_alert"),
    )
    op.create_index("ix_deadline_alerts_farmer_id", "scheme_deadline_alerts", ["farmer_id"])

    # ------------------------------------------------------------- farmer_sessions
    op.create_table(
        "farmer_sessions",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("farmer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("session_id"),
        sa.ForeignKeyConstraint(["farmer_id"], ["farmers.farmer_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_farmer_sessions_farmer_id", "farmer_sessions", ["farmer_id"])
    op.create_index("ix_farmer_sessions_token_hash", "farmer_sessions", ["token_hash"])

    # ---------------------------------------------------- seed initial disease data
    op.execute("""
    INSERT INTO diseases (disease_id, crop, name_en, name_ta, modern_chemical, modern_dosage, modern_cost_acre, supply_note, indigenous_name, indigenous_method, indigenous_method_ta, icar_reference)
    VALUES
    ('rice_bacterial_leaf_blight', 'rice', 'Rice Bacterial Leaf Blight', 'நெல் பாக்டீரியல் இலை கருக்கல்',
     'Streptocycline 15g + Copper oxychloride 500g per 100L water', 'Spray twice at 7-day interval', 240.00,
     'Available at District Agriculture Office and licensed agrochemical dealers',
     'Panchagavya + Neem oil spray', 'Mix 3% panchagavya + 5ml neem oil per litre water. Spray at dawn on affected leaves.',
     '3% பஞ்சகவ்யா + 5மில் வேம்பு எண்ணெய் ஒரு லிட்டர் நீரில் கலந்து காலையில் தெளிக்கவும்',
     'ICAR-CRRI TN-2022-BLB'),
    ('rice_blast', 'rice', 'Rice Blast', 'நெல் வெடிப்பு நோய்',
     'Tricyclazole 75 WP 300g/acre', 'Spray at tillering and panicle emergence stages', 380.00,
     'Tricyclazole available at registered pesticide shops',
     'Pseudomonas fluorescens bio-agent', 'Mix 500g Pseudomonas per 100L water. Spray at early infection signs.',
     '500 கிராம் Pseudomonas ஐ 100 லிட்டர் நீரில் கலந்து ஆரம்ப நோய் அறிகுறியில் தெளிக்கவும்',
     'ICAR-CRRI TN-2022-BLAST'),
    ('tomato_early_blight', 'tomato', 'Tomato Early Blight', 'தக்காளி ஆரம்ப கருக்கல்',
     'Mancozeb 75 WP 400g/acre', 'Spray every 7-10 days preventively', 320.00,
     'Mancozeb available at most agricultural input shops',
     'Neem oil + Baking soda spray', 'Mix 10ml neem oil + 5g baking soda + 2ml liquid soap per litre. Spray weekly.',
     '10மில் வேம்பு எண்ணெய் + 5 கிராம் சோடா + 2மில் சோப்பு ஒரு லிட்டரில் கலந்து வாரம் ஒரு முறை தெளிக்கவும்',
     'TNAU-Tomato-2023'),
    ('groundnut_early_leaf_spot', 'groundnut', 'Groundnut Early Leaf Spot', 'கடலை ஆரம்ப இலை புள்ளி',
     'Chlorothalonil 75 WP 400g/acre', 'Spray at 40 and 60 days after sowing', 280.00,
     'Available at district seed and pesticide centres',
     'Garlic extract spray', 'Crush 100g garlic, dilute in 5L water, filter and spray on leaves.',
     '100 கிராம் பூண்டு நசுக்கி 5 லிட்டர் நீரில் கலந்து வடிகட்டி தெளிக்கவும்',
     'TNAU-Groundnut-2022'),
    ('cotton_bollworm', 'cotton', 'Cotton Bollworm', 'பருத்தி காய்ப்புழு',
     'Emamectin benzoate 5 SG 80g/acre', 'Spray at 1% ETL — 1 larva per plant', 420.00,
     'Emamectin available at licensed dealers; use protective gear',
     'Neem seed kernel extract (NSKE)', 'Prepare 5% NSKE: soak 50g neem seed kernel powder overnight in 1L water, filter and spray.',
     '50 கிராம் வேம்பு விதை மாவை 1 லிட்டர் நீரில் ஊறவைத்து, வடிகட்டி தெளிக்கவும்',
     'TNAU-Cotton-Pest-2023'),
    ('banana_panama_wilt', 'banana', 'Banana Panama Wilt (Fusarium wilt)', 'வாழை பனாமா வாடல்',
     'Carbendazim 50 WP 1g/litre soil drench', 'Apply around root zone at early symptom', 350.00,
     'Carbendazim at District Horticulture Office',
     'Trichoderma viride bio-agent', 'Mix 50g Trichoderma viride per litre water, drench around root zone monthly.',
     '50 கிராம் Trichoderma viride ஐ 1 லிட்டர் நீரில் கலந்து மாதம் ஒரு முறை வேர் மண்டலத்தில் ஊற்றவும்',
     'TNAU-Banana-2023')
    """)

    # ------------------------------------------------- seed initial mandi data
    op.execute("""
    INSERT INTO mandis (mandi_id, name, district, state, latitude, longitude, enam_linked)
    VALUES
    ('CBE_MAIN', 'Coimbatore Main Market', 'Coimbatore', 'Tamil Nadu', 11.0168, 76.9558, true),
    ('MDU_MAIN', 'Madurai Central Market', 'Madurai', 'Tamil Nadu', 9.9252, 78.1198, true),
    ('TPR_MAIN', 'Tirupur Agricultural Market', 'Tirupur', 'Tamil Nadu', 11.1085, 77.3411, true),
    ('TJ_MAIN', 'Thanjavur Paddy Market', 'Thanjavur', 'Tamil Nadu', 10.7870, 79.1378, true),
    ('VLR_MAIN', 'Vellore Market', 'Vellore', 'Tamil Nadu', 12.9165, 79.1325, true),
    ('SLM_MAIN', 'Salem Market', 'Salem', 'Tamil Nadu', 11.6643, 78.1460, true),
    ('ERD_MAIN', 'Erode Market', 'Erode', 'Tamil Nadu', 11.3410, 77.7172, true),
    ('CHN_MAIN', 'Chennai Koyambedu Market', 'Chennai', 'Tamil Nadu', 13.0694, 80.1948, true),
    ('TCH_MAIN', 'Tiruchirappalli Market', 'Tiruchirappalli', 'Tamil Nadu', 10.7905, 78.7047, true),
    ('DGL_MAIN', 'Dindigul Market', 'Dindigul', 'Tamil Nadu', 10.3673, 77.9803, true)
    """)


def downgrade() -> None:
    op.drop_table("farmer_sessions")
    op.drop_table("scheme_deadline_alerts")
    op.drop_table("scheme_queries")
    op.drop_table("schemes")
    op.drop_table("price_forecasts")
    op.drop_table("mandi_prices")
    op.drop_table("mandis")
    op.drop_table("prescriptions")
    op.drop_table("diagnoses")
    op.drop_table("diseases")
    op.drop_table("soil_tests")
    op.drop_table("farmer_crops")
    op.drop_table("farmers")
