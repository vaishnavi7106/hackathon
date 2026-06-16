# Uzhavar AI — 10-Day Implementation Plan

**Goal:** Working hackathon MVP with all 4 pillars demo-ready in 10 days.

**Build order (fastest path to a live demo):**
Pillar 4 → Pillar 3 → Pillar 1 → Pillar 2

Rationale: Pillar 4 (LLM + database, no ML training) ships Day 3. Pillar 3 (Prophet, clean public data) ships Day 5. Pillars 1 and 2 run in parallel after the foundation is solid.

---

## Daily Plan

### Day 1 — Foundation
**Goal:** Running app skeleton end-to-end before a line of ML code.

**Backend:**
- [ ] Init FastAPI project: `main.py`, router stubs for all 4 pillars, `/health` endpoint
- [ ] `docker-compose.yml`: postgres:15, redis:7, fastapi, nginx
- [ ] SQLAlchemy async setup, Alembic for migrations
- [ ] Run migrations: all tables from DATABASE_SCHEMA.md
- [ ] Pydantic schemas for all request/response models (API_SPEC.md)
- [ ] JWT auth: `POST /auth/register` + `POST /auth/login`
- [ ] `GET /farmer/me` + `PUT /farmer/me` + `POST /farmer/soil-test`

**Frontend:**
- [ ] `npx create-vite@latest frontend --template react` + Tailwind CSS
- [ ] Zustand store: `farmerStore` (farmer_id, token, profile, language)
- [ ] React Router: `/` (home), `/diagnose`, `/prescribe`, `/market`, `/schemes`
- [ ] Bottom nav bar (4 pillar icons)
- [ ] Farmer onboarding flow: name → district → crop → language selection
- [ ] i18n setup: `ta.json`, `en.json` base strings

**End of Day 1 check:** `docker compose up` → auth works, farmer profile CRUD works, all 4 tab screens render (empty).

---

### Day 2 — Pillar 4 Setup (Scheme Database)
**Goal:** Scheme database complete and queryable before writing any LLM code.

- [ ] Seed `schemes` table: all 10 schemes from solution doc (plus 5 more for coverage = 15 total)
  - PM-KISAN, PMFBY, PMKSY, Soil Health Card, Kisan Credit Card (Central)
  - TN CM Crop Insurance, TN Drip Subsidy, Free Seeds, TNFISS, e-NAM Support (State)
  - Add 5 additional TN schemes from Agriculture Dept website
- [ ] Tamil translations verified for all scheme fields
- [ ] `POST /schemes/eligible` endpoint: SQL eligibility pre-filter live and tested
- [ ] Test eligibility filter with 3 sample farmer profiles (small farmer, large farmer, no Aadhaar)

**Scheme database quality check:** Every scheme must have: name_ta, benefit_amount_num, documents_required, application_url, last_verified, description_ta.

---

### Day 3 — Pillar 4 Complete (LLM + Voice)
**Goal:** Full Government Navigator working end-to-end in Tamil.

- [ ] `ANTHROPIC_API_KEY` in `.env`, Anthropic Python SDK installed
- [ ] `claude_client.py`: wrapper with retry, token count logging
- [ ] LLM system prompt (store in `prompts/schemes_system.txt`):
  ```
  You are a Tamil-language agricultural scheme advisor for Tamil Nadu farmers.
  RULES:
  - Always respond in Tamil (unless user explicitly asks for English)
  - Never mention a scheme not present in the provided context
  - Always give eligibility verdict: ELIGIBLE / NOT ELIGIBLE / NEED MORE INFO
  - List exact documents required and application URL
  - If deadline within 30 days, start response with urgent warning
  - Keep response under 150 words
  - Address farmer by name warmly
  ```
- [ ] `POST /schemes/chat` endpoint: pre-filter → RAG context → Claude API → response
- [ ] `scheme_queries` table insert after every call
- [ ] Deadline alert logic: flag schemes with deadline ≤ 30 days
- [ ] Test: 20 Tamil queries with known-answer checking (hallucination = 0%)
- [ ] Frontend: Schemes screen — eligibility card list + chat UI (Tamil keyboard support)
- [ ] Web Speech API integration: Tamil voice input → text, TTS for response

**Pillar 4 demo-ready check:** Tamil farmer asks "என்ன திட்டங்கள் கிடைக்கும்?" → gets correct eligible schemes in Tamil in < 3 seconds.

---

### Day 4 — Pillar 3 Data + Model
**Goal:** Prophet models trained on AGMARKNET data, e-NAM API integrated.

- [ ] Download AGMARKNET dataset (10 years, Tamil Nadu mandis)
  - Source: `data.gov.in` or AGMARKNET download portal
  - Target crops: rice, sugarcane, banana, groundnut, cotton, tomato
- [ ] Data cleaning script: fill gaps (linear interpolation), remove outliers (IQR), engineer features
- [ ] Seed `mandis` table: all e-NAM linked Tamil Nadu mandis with lat/long
- [ ] Train Prophet models: one per (crop × mandi) combination
  - Train-test split: holdout 2023–2024 data for validation
  - Log MAPE per model; target < 12%
- [ ] Save models: `models/prophet/{crop}_{mandi_id}.pkl`
- [ ] e-NAM API client (`services/enam.py`): daily price pull, store in Redis + `mandi_prices` table
- [ ] Hold/sell engine (`models/price_forecast.py`): storage cost table per facility type

**Storage cost table:**
```python
STORAGE_COST_PER_QUINTAL_PER_WEEK = {
    "home": 30,
    "warehouse": 55,
    "cold_storage": 120
}
```

---

### Day 5 — Pillar 3 Complete
**Goal:** Full Market Navigator working end-to-end.

- [ ] `POST /forecast` endpoint: Prophet inference + hold/sell + mandi comparison
- [ ] Distance calculation: haversine formula, nearest 3 mandis from farmer's district centroid
- [ ] Transport cost estimation: `₹2.5 per km per quintal` (flat rate for hackathon)
- [ ] Redis cache for Prophet forecasts (TTL 12h), e-NAM prices (TTL 24h)
- [ ] `GET /prices/live` endpoint
- [ ] Frontend: Market screen
  - 90-day price chart (Recharts line chart with confidence band)
  - HOLD / SELL verdict card (green/red, full calculation shown in Tamil)
  - Mandi comparison table (nearest 3, transport-adjusted price)
  - Historical context: "X out of last 5 years peaked in [month]"
- [ ] Backtest validation: run hold/sell on 2023 holdout data, measure accuracy

**Pillar 3 demo-ready check:** Farmer selects "rice" → sees price chart, HOLD/SELL verdict in Tamil with full calculation, best mandi highlighted.

---

### Day 6 — Pillar 1: Dataset + Model Training
**Goal:** MobileNetV2 training started (runs overnight); disease database complete.

- [ ] Download PlantVillage dataset from Kaggle (54K images)
- [ ] Filter to Tamil Nadu priority crops: rice, sugarcane, banana, groundnut, cotton, tomato
- [ ] Data augmentation pipeline: random rotation ±30°, brightness ±20%, horizontal flip
- [ ] 80/10/10 train/val/test split
- [ ] PyTorch fine-tuning script (`train_crop_sentinel.py`):
  - Load MobileNetV2 (torchvision pretrained ImageNet)
  - Replace final FC layer with 26-class head
  - Freeze base layers epoch 1–3, unfreeze all epoch 4–10
  - LR: 1e-4 (Adam), batch 32, 10 epochs
- [ ] **Start training** (overnight on GPU VM or Google Colab)
- [ ] Build disease treatment database: 26 diseases × {modern + indigenous remedy}
  - Seed `diseases` table
  - Source: ICAR disease bulletins + TN Agriculture Dept

---

### Day 7 — Pillar 1: SHAP + API + Frontend
**Goal:** Crop Sentinel endpoint live; training complete by morning.

- [ ] Load trained model checkpoint; evaluate on test set → confirm > 85% top-1 accuracy
- [ ] Export to TFLite: `torch → ONNX → TFLite` via `ai-edge-torch`
- [ ] SHAP integration (`models/crop_sentinel.py`):
  - `shap.GradientExplainer(model, background_data)`
  - Generate heatmap: overlay on original image using matplotlib, save to object store
- [ ] `POST /diagnose` endpoint: full pipeline (upload → inference → SHAP → treatment lookup)
- [ ] Low-confidence path: confidence < 0.70 → Tamil re-photo prompt, no treatment
- [ ] Frontend: Diagnose screen
  - Camera capture (PWA MediaDevices) + gallery upload
  - Loading state during inference
  - Result card: disease name (Tamil + English), confidence bar
  - SHAP heatmap overlay rendered on photo
  - Treatment accordion: modern treatment / indigenous remedy
  - "Share with neighbor" button (PWA Web Share API)

**Pillar 1 demo-ready check:** Photo of diseased rice leaf → diagnosis + heatmap in < 5 seconds.

---

### Day 8 — Pillar 2: XGBoost + LSTM Training
**Goal:** Both models trained and validated.

- [ ] Acquire and clean training data:
  - ICAR soil health card dataset (district-level NPK baselines if individual records unavailable)
  - FAO-56 crop ET coefficient tables for all 6 priority crops
  - IMD historical weather data (rainfall, temp, humidity — district-level)
- [ ] XGBoost fertilizer model (`train_soil_optimizer.py`):
  - Features: pH, N, P, K, OM%, crop, district, season, previous_crop
  - Target: optimal NPK application quantities
  - Cross-validate by district; SHAP feature importance for explainability
  - Cost optimization layer: for each NPK target, find cheapest fertilizer combo
- [ ] LSTM irrigation model (`train_irrigation.py`):
  - Input: 7-day window (rainfall, temp, humidity, prev_irrigation)
  - Output: 14-day irrigation schedule (binary per day + duration)
  - Train on historical IMD data with FAO-56 ET as label generation basis
- [ ] IMD API client (`services/imd.py`): fetch 5-day forecast for farmer district, cache Redis

---

### Day 9 — Pillar 2: Joint Optimizer + API + Frontend
**Goal:** Full Soil & Water Optimizer working end-to-end.

- [ ] Joint optimization layer (`models/soil_optimizer.py`):
  ```python
  RULES = [
      # Urea most effective at 60-70% soil moisture → schedule within 48h of irrigation
      # Potash uptake inhibited by waterlogging → 2-day gap from heavy irrigation
      # Skip irrigation if IMD forecast > 5mm rain on that day
  ]
  ```
- [ ] `POST /prescribe` endpoint: XGBoost → LSTM → joint optimizer → integrated calendar
- [ ] Savings calculation: compare prescription cost vs ICAR district standard practice cost
- [ ] Frontend: Prescribe screen
  - Soil test input form (optional — defaults to district baseline)
  - 14-day calendar view with color-coded actions (blue = irrigate, green = fertilize)
  - Fertilizer prescription card: NPK quantities + cost + savings
  - Micronutrient deficiency flags
  - "Rain skip" notification banner when IMD forecast causes a schedule change

**Pillar 2 demo-ready check:** Farmer submits soil test → sees 14-day joint calendar with fertilizer + irrigation days, savings summary in Tamil.

---

### Day 10 — Integration, Offline, Polish, Demo Prep
**Goal:** All 4 pillars integrated; offline mode working; demo script rehearsed.

**Morning (Integration + Offline):**
- [ ] Service Worker (Workbox): cache strategy per endpoint (see ARCHITECTURE.md)
- [ ] TFLite WASM in PWA: on-device Crop Sentinel inference without internet
- [ ] Offline queue: capture diagnose/prescribe requests offline, sync on reconnect
- [ ] Static scheme JSON cached locally (Government Navigator offline)
- [ ] Farmer home screen: summary dashboard showing last diagnosis, next irrigation day, scheme alert count
- [ ] Tamil typography: ensure all screens render correctly with Tamil font (Noto Sans Tamil)

**Afternoon (Polish + Demo):**
- [ ] `/health` endpoint: all 4 models loaded, all external APIs reachable
- [ ] Seed demo farmer profile: "Karthik, Coimbatore, 2.5 acres rice, electric pump, warehouse storage"
- [ ] Pre-warm all caches for demo farmer: run /diagnose, /prescribe, /forecast, /schemes/eligible
- [ ] Save demo diagnoses and forecasts to Redis so demo is instant
- [ ] Prepare demo photo: diseased rice leaf (Bacterial Leaf Blight) for live camera demo
- [ ] Error fallbacks: if e-NAM API is down during demo, Redis cache serves; if Claude API is slow, show spinner with Tamil loading text
- [ ] One-sentence Tamil labels on every screen: every number has a Tamil explanation
- [ ] Record backup video of full demo flow (insurance against live demo failure)

**Demo narrative (5 minutes):**
1. Farmer Karthik photographs rice leaf → Crop Sentinel: "நெல் பாக்டீரியல் இலை கருக்கல்" (91%)
2. App shows joint calendar: "Tuesday: irrigate 90 min. Wednesday: apply 1.8kg urea."
3. Market: "HOLD. உச்ச விலை ஜூலை 10: ₹2,340. நிகர லாபம் ₹100/குவிண்டால்."
4. Government: "கார்த்திக் சார், 3 திட்டங்களில் தகுதி: PM-KISAN ₹6,000, துளி நீர்ப்பாசனம் 100% மானியம்."

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PlantVillage training doesn't hit 85% accuracy | Medium | Pillar 1 | Use pretrained weights from plant-disease repo; lower demo threshold to 80% |
| AGMARKNET data quality issues | Medium | Pillar 3 | Manual clean 2 priority crops (rice, tomato) first; others use mock data for demo |
| LSTM irrigation model underperforms | Medium | Pillar 2 | Fallback to rule-based irrigation (FAO-56 ET table only, no LSTM) |
| Claude API latency > 3s | Low | Pillar 4 | Pre-compute eligible schemes in SQL; LLM only for narrative generation |
| IMD API unavailable | Low | Pillar 2 | Use cached 5-day forecast; skip rain-skip logic if cache is stale |
| GPU unavailable for training | Medium | Pillar 1,2 | Google Colab (free T4); use smaller dataset if needed |

---

## Repository Structure

```
uzhavar_ai/
├── backend/
│   ├── main.py
│   ├── routers/           # diagnose.py, prescribe.py, forecast.py, schemes.py
│   ├── models/            # crop_sentinel.py, soil_optimizer.py, irrigation.py, price_forecast.py
│   ├── services/          # enam.py, imd.py, claude_client.py, scheme_db.py
│   ├── db/                # session.py, crud.py
│   ├── schemas/           # Pydantic models
│   ├── prompts/           # schemes_system.txt
│   ├── migrations/        # Alembic
│   └── training/          # train_crop_sentinel.py, train_soil_optimizer.py, train_irrigation.py
├── frontend/
│   ├── src/
│   │   ├── pages/         # Diagnose.jsx, Prescribe.jsx, Market.jsx, Schemes.jsx
│   │   ├── components/    # BottomNav, DiseaseCard, CalendarView, PriceChart, SchemeChat
│   │   ├── store/         # farmerStore.js
│   │   ├── i18n/          # ta.json, en.json, hi.json
│   │   └── sw/            # service-worker.js (Workbox)
│   └── public/
├── data/
│   ├── schemes/           # schemes_seed.json
│   ├── diseases/          # disease_treatment_db.json
│   └── mandis/            # mandis_seed.json
├── models/
│   ├── crop_sentinel/     # .pt, .tflite, .onnx
│   ├── soil/              # xgboost.pkl
│   ├── irrigation/        # lstm.pt
│   └── prophet/           # {crop}_{mandi}.pkl
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
├── DATABASE_SCHEMA.md
├── API_SPEC.md
└── IMPLEMENTATION_PLAN.md
```

---

## Environment Variables

```bash
# .env
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/uzhavar
REDIS_URL=redis://redis:6379/0
ANTHROPIC_API_KEY=sk-ant-...
ENAM_API_KEY=...
IMD_API_KEY=...
AWS_S3_BUCKET=uzhavar-media          # or LOCAL_MEDIA_PATH for hackathon
JWT_SECRET=...
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

---

## Daily Completion Gates

| Day | Gate (must pass before Day N+1) |
|-----|--------------------------------|
| 1 | `POST /auth/register` returns JWT; farmer profile CRUD works; all 4 tab screens render |
| 2 | 15 schemes in DB; `POST /schemes/eligible` returns correct results for 3 test profiles |
| 3 | Tamil chat query returns correct scheme in < 3s; zero hallucinated schemes in 20-query test |
| 4 | Prophet models trained for ≥ 2 crops × ≥ 3 mandis; MAPE < 12% on holdout |
| 5 | `POST /forecast` returns HOLD/SELL verdict; price chart renders in frontend |
| 6 | PlantVillage training started; disease DB seeded with all 26 diseases |
| 7 | `POST /diagnose` returns disease + SHAP heatmap in < 5s; confidence < 70% shows re-photo prompt |
| 8 | XGBoost and LSTM trained; savings calc validated against ICAR standard practice baseline |
| 9 | `POST /prescribe` returns 14-day joint calendar with no agronomic conflicts |
| 10 | All 4 pillars working end-to-end; demo farmer pre-warmed; backup video recorded |
