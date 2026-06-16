# Uzhavar AI — Database Schema

PostgreSQL 15. All tables use UUID primary keys. `created_at` / `updated_at` on every table.

---

## Farmers

```sql
CREATE TABLE farmers (
    farmer_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone            VARCHAR(12) UNIQUE,             -- used for OTP auth
    name             VARCHAR(100),
    district         VARCHAR(60) NOT NULL,            -- Tamil Nadu district
    village          VARCHAR(100),
    land_size_acres  NUMERIC(6, 2),                  -- total cultivable land
    pump_type        VARCHAR(20) CHECK (pump_type IN ('diesel','electric','none')),
    storage_facility VARCHAR(20) CHECK (storage_facility IN ('home','warehouse','cold_storage')),
    language         VARCHAR(5)  DEFAULT 'ta'         CHECK (language IN ('ta','hi','en')),
    aadhaar_linked   BOOLEAN     DEFAULT FALSE,
    income_band      VARCHAR(20),                    -- 'below_1L', '1L_2L', 'above_2L'
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);
```

## Farmer Crops (one row per crop the farmer currently grows)

```sql
CREATE TABLE farmer_crops (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id   UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
    crop        VARCHAR(60) NOT NULL,   -- 'rice', 'sugarcane', 'banana', etc.
    acres       NUMERIC(5, 2) NOT NULL,
    season      VARCHAR(20),            -- 'kharif', 'rabi', 'summer'
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_farmer_crops_farmer ON farmer_crops(farmer_id);
```

## Soil Tests

```sql
CREATE TABLE soil_tests (
    test_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
    tested_at       DATE NOT NULL,
    ph              NUMERIC(4, 2),
    nitrogen        NUMERIC(6, 2),    -- kg/ha
    phosphorus      NUMERIC(6, 2),
    potassium       NUMERIC(6, 2),
    organic_matter  NUMERIC(5, 2),    -- %
    zinc            NUMERIC(6, 3),
    iron            NUMERIC(6, 3),
    copper          NUMERIC(6, 3),
    boron           NUMERIC(6, 3),
    source          VARCHAR(20) DEFAULT 'farmer_input',  -- 'farmer_input' | 'icar_baseline'
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_soil_tests_farmer ON soil_tests(farmer_id);
```

---

## Pillar 1 — Crop Diagnoses

```sql
CREATE TABLE diagnoses (
    diagnosis_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id        UUID REFERENCES farmers(farmer_id) ON DELETE SET NULL,
    image_key        VARCHAR(500) NOT NULL,    -- S3 / local path to original photo
    heatmap_key      VARCHAR(500),             -- S3 / local path to SHAP heatmap
    crop             VARCHAR(60),
    disease_id       VARCHAR(60),              -- FK to diseases table
    disease_name_en  VARCHAR(120),
    disease_name_ta  VARCHAR(120),
    confidence       NUMERIC(5, 4),            -- 0.0000 – 1.0000
    low_confidence   BOOLEAN DEFAULT FALSE,    -- true if confidence < 0.70
    model_version    VARCHAR(20),
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_diagnoses_farmer ON diagnoses(farmer_id);
CREATE INDEX idx_diagnoses_disease ON diagnoses(disease_id);
```

```sql
CREATE TABLE diseases (
    disease_id       VARCHAR(60) PRIMARY KEY,  -- e.g. 'rice_bacterial_leaf_blight'
    crop             VARCHAR(60) NOT NULL,
    name_en          VARCHAR(120) NOT NULL,
    name_ta          VARCHAR(120) NOT NULL,
    -- Modern treatment
    modern_chemical  VARCHAR(200),
    modern_dosage    VARCHAR(100),
    modern_cost_acre NUMERIC(8, 2),
    supply_note      VARCHAR(200),
    -- Indigenous remedy
    indigenous_name  VARCHAR(120),
    indigenous_method TEXT,
    -- Meta
    icar_reference   VARCHAR(200),
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## Pillar 2 — Soil & Irrigation Prescriptions

```sql
CREATE TABLE prescriptions (
    prescription_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id        UUID REFERENCES farmers(farmer_id) ON DELETE SET NULL,
    soil_test_id     UUID REFERENCES soil_tests(test_id),
    crop             VARCHAR(60) NOT NULL,
    season           VARCHAR(20),
    -- Fertilizer output
    nitrogen_kg      NUMERIC(6, 2),
    phosphorus_kg    NUMERIC(6, 2),
    potassium_kg     NUMERIC(6, 2),
    micro_flags      JSONB,     -- {"zinc": true, "iron": false, ...}
    fertilizer_cost  NUMERIC(8, 2),
    fertilizer_save  NUMERIC(8, 2),   -- savings vs standard practice
    -- Irrigation output (14-day schedule)
    irrigation_plan  JSONB NOT NULL,  -- see schema note below
    water_cost_est   NUMERIC(8, 2),
    -- Joint plan
    joint_calendar   JSONB NOT NULL,  -- merged day-by-day action list
    weather_snapshot JSONB,           -- IMD 5-day forecast at time of generation
    model_version    VARCHAR(20),
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_prescriptions_farmer ON prescriptions(farmer_id);
```

**`irrigation_plan` JSONB structure:**
```json
[
  { "day": 1,  "date": "2025-07-01", "action": "irrigate", "duration_min": 90, "volume_litres": 1800, "cost": 42 },
  { "day": 3,  "date": "2025-07-03", "action": "fertilize", "input": "urea", "qty_kg": 1.8, "note": "Apply after irrigation" }
]
```

---

## Pillar 3 — Market / Price Data

```sql
CREATE TABLE mandis (
    mandi_id     VARCHAR(60) PRIMARY KEY,   -- e-NAM mandi code
    name         VARCHAR(100) NOT NULL,
    district     VARCHAR(60)  NOT NULL,
    state        VARCHAR(60)  DEFAULT 'Tamil Nadu',
    latitude     NUMERIC(9, 6),
    longitude    NUMERIC(9, 6),
    enam_linked  BOOLEAN DEFAULT TRUE
);
```

```sql
CREATE TABLE mandi_prices (
    id           BIGSERIAL PRIMARY KEY,
    mandi_id     VARCHAR(60) NOT NULL REFERENCES mandis(mandi_id),
    crop         VARCHAR(60) NOT NULL,
    price_date   DATE        NOT NULL,
    min_price    NUMERIC(10, 2),
    max_price    NUMERIC(10, 2),
    modal_price  NUMERIC(10, 2) NOT NULL,
    source       VARCHAR(20) DEFAULT 'agmarknet',   -- 'agmarknet' | 'enam'
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (mandi_id, crop, price_date, source)
);
CREATE INDEX idx_mandi_prices_lookup ON mandi_prices(crop, mandi_id, price_date DESC);
```

```sql
CREATE TABLE price_forecasts (
    forecast_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id      UUID REFERENCES farmers(farmer_id) ON DELETE SET NULL,
    crop           VARCHAR(60) NOT NULL,
    mandi_id       VARCHAR(60) REFERENCES mandis(mandi_id),
    generated_at   TIMESTAMPTZ DEFAULT now(),
    -- Forecast series (90 days)
    forecast_data  JSONB NOT NULL,   -- [{date, yhat, yhat_lower, yhat_upper}]
    -- Hold/sell decision
    today_price    NUMERIC(10, 2),
    peak_price     NUMERIC(10, 2),
    peak_date      DATE,
    storage_type   VARCHAR(20),
    storage_cost   NUMERIC(10, 2),
    net_gain       NUMERIC(10, 2),
    recommendation VARCHAR(10) CHECK (recommendation IN ('HOLD', 'SELL')),
    model_version  VARCHAR(20)
);
CREATE INDEX idx_forecasts_farmer ON price_forecasts(farmer_id);
```

---

## Pillar 4 — Government Schemes

```sql
CREATE TABLE schemes (
    scheme_id            VARCHAR(60) PRIMARY KEY,   -- e.g. 'PM_KISAN_01'
    name_en              VARCHAR(200) NOT NULL,
    name_ta              VARCHAR(200) NOT NULL,
    level                VARCHAR(20) CHECK (level IN ('central','state')),
    state                VARCHAR(60) DEFAULT 'All India',
    benefit_amount       VARCHAR(200),               -- human-readable, e.g. "₹6,000 per year"
    benefit_amount_num   NUMERIC(10, 2),             -- numeric for eligibility calc
    -- Eligibility rules (structured for pre-filter SQL)
    max_land_acres       NUMERIC(6, 2),              -- NULL = no limit
    min_land_acres       NUMERIC(6, 2) DEFAULT 0,
    requires_aadhaar     BOOLEAN DEFAULT FALSE,
    eligible_crops       TEXT[],                     -- NULL = all crops
    eligible_districts   TEXT[],                     -- NULL = all districts
    income_band_max      VARCHAR(20),
    -- Application info
    documents_required   TEXT[] NOT NULL,
    application_deadline VARCHAR(200),               -- 'rolling' or 'YYYY-MM-DD'
    application_url      VARCHAR(500),
    office_type          VARCHAR(100),               -- 'District Agriculture Office'
    -- Tamil content
    description_ta       TEXT NOT NULL,
    eligibility_ta       TEXT,
    documents_ta         TEXT[],
    -- Meta
    last_verified        DATE NOT NULL,
    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);
```

```sql
CREATE TABLE scheme_queries (
    query_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id    UUID REFERENCES farmers(farmer_id) ON DELETE SET NULL,
    query_text   TEXT NOT NULL,
    language     VARCHAR(5),
    schemes_ctx  JSONB,          -- scheme IDs passed to LLM as context
    llm_response TEXT,
    latency_ms   INTEGER,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_scheme_queries_farmer ON scheme_queries(farmer_id);
```

```sql
CREATE TABLE scheme_deadline_alerts (
    alert_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id   UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
    scheme_id   VARCHAR(60) NOT NULL REFERENCES schemes(scheme_id),
    deadline    DATE NOT NULL,
    alert_30d   BOOLEAN DEFAULT FALSE,
    alert_7d    BOOLEAN DEFAULT FALSE,
    dismissed   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (farmer_id, scheme_id)
);
```

---

## Auth

```sql
CREATE TABLE sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id    UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
    token_hash   VARCHAR(64) NOT NULL,   -- SHA-256 of JWT
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_farmer ON sessions(farmer_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

---

## Eligibility Pre-filter Query (Pillar 4)

This SQL runs before the LLM call to narrow schemes — saves tokens, eliminates hallucination risk.

```sql
SELECT scheme_id, name_ta, benefit_amount, documents_required,
       application_deadline, application_url, description_ta
FROM schemes
WHERE is_active = TRUE
  AND (max_land_acres IS NULL OR max_land_acres >= :land_acres)
  AND (min_land_acres IS NULL OR min_land_acres <= :land_acres)
  AND (requires_aadhaar = FALSE OR :aadhaar_linked = TRUE)
  AND (eligible_crops IS NULL OR :crop = ANY(eligible_crops))
  AND (eligible_districts IS NULL OR :district = ANY(eligible_districts))
ORDER BY benefit_amount_num DESC NULLS LAST;
```

---

## Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| `farmer_crops` | `farmer_id` | Fetch all crops for a farmer |
| `soil_tests` | `farmer_id` | Latest soil test lookup |
| `diagnoses` | `farmer_id`, `disease_id` | History + disease analytics |
| `mandi_prices` | `(crop, mandi_id, price_date DESC)` | Price time-series queries |
| `price_forecasts` | `farmer_id` | Forecast history per farmer |
| `scheme_queries` | `farmer_id` | Query history per farmer |
| `sessions` | `token_hash` | Auth token validation |

---

## Redis Keys

| Key Pattern | Type | TTL | Content |
|-------------|------|-----|---------|
| `imd:forecast:{district}` | JSON string | 6h | IMD 5-day weather forecast |
| `enam:price:{crop}:{mandi_id}` | JSON string | 24h | Today's e-NAM modal price |
| `prophet:{crop}:{mandi_id}` | JSON string | 12h | Prophet 90-day forecast |
| `session:{token_hash}` | String | 7d | farmer_id |
