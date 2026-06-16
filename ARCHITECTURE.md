# Uzhavar AI — System Architecture

## Overview

Uzhavar AI is an offline-first Progressive Web App serving Tamil Nadu farmers across four AI-powered decision pillars. One farmer profile powers all four pillars; every recommendation is in Tamil.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FARMER (PWA on Android)                       │
│  Camera │ Voice (Web Speech API) │ Tamil / Hindi / English UI   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                ┌────────────▼────────────┐
                │     React PWA (Nginx)    │
                │  Service Worker (cache)  │
                │  TFLite (on-device CNN)  │
                └────────────┬────────────┘
                             │ REST JSON
                ┌────────────▼────────────┐
                │    FastAPI (Python)      │
                │    API Gateway / Auth    │
                └──┬──────┬──────┬────┬──┘
                   │      │      │    │
          ┌────────┘ ┌────┘ ┌───┘ ┌──┘
          ▼          ▼      ▼     ▼
    ┌──────────┐ ┌──────┐ ┌────┐ ┌──────────┐
    │ Pillar 1 │ │ P2   │ │ P3 │ │ Pillar 4 │
    │ Crop     │ │ Soil │ │Mkt │ │ Govt     │
    │ Sentinel │ │&Watr │ │Nav │ │ Nav      │
    └────┬─────┘ └──┬───┘ └──┬─┘ └────┬─────┘
         │          │        │         │
    MobileNetV2  XGBoost  Prophet   Claude API
    + SHAP       + LSTM   + e-NAM   + RAG DB
         │          │        │         │
         └──────────┴────────┴─────────┘
                         │
              ┌──────────▼──────────┐
              │   PostgreSQL         │
              │   Redis (cache)      │
              │   Object Store (S3)  │
              └─────────────────────┘
```

---

## Component Breakdown

### Frontend — React PWA

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | React 18 + Vite | Fast build, wide ecosystem |
| Offline | Service Worker (Workbox) | Cache API responses, last 7 days |
| Camera | PWA MediaDevices API | Native capture, no app install |
| Voice | Web Speech API (browser-native) | Tamil STT/TTS, zero infra |
| State | Zustand | Lightweight, no boilerplate |
| i18n | react-i18next | Tamil/Hindi/English JSON bundles |
| UI | Tailwind CSS | Fast styling, mobile-first |
| On-device ML | TensorFlow.js + TFLite WASM | Crop Sentinel offline inference |

**Offline-first cache strategy (Service Worker):**
- **CacheFirst**: static assets, Tamil UI strings, scheme database JSON
- **NetworkFirst with fallback**: disease diagnoses, soil prescriptions
- **StaleWhileRevalidate**: mandi price data (show cached, refresh in background)
- **Background Sync**: queue offline farmer inputs, flush on reconnect

### Backend — FastAPI

Single FastAPI application split into routers by pillar. Each router is independently testable.

```
backend/
├── main.py                 # App factory, CORS, middleware
├── routers/
│   ├── diagnose.py         # Pillar 1 — POST /diagnose
│   ├── prescribe.py        # Pillar 2 — POST /prescribe
│   ├── forecast.py         # Pillar 3 — POST /forecast
│   └── schemes.py          # Pillar 4 — POST /schemes
├── models/
│   ├── crop_sentinel.py    # MobileNetV2 inference + SHAP
│   ├── soil_optimizer.py   # XGBoost inference
│   ├── irrigation.py       # LSTM inference
│   └── price_forecast.py   # Prophet inference
├── services/
│   ├── enam.py             # e-NAM API client
│   ├── imd.py              # IMD weather API client
│   ├── claude_client.py    # Anthropic SDK wrapper
│   └── scheme_db.py        # RAG scheme lookup
├── db/
│   ├── session.py          # SQLAlchemy async session
│   └── crud.py             # DB operations
└── schemas/                # Pydantic request/response models
```

### ML Services

#### Pillar 1 — Crop Sentinel
- **Model**: MobileNetV2 fine-tuned on PlantVillage (54K images, 26 diseases)
- **Training**: PyTorch → export to TFLite for on-device + ONNX for server
- **Explainability**: SHAP GradientExplainer generates heatmap overlay per inference
- **Serving**: FastAPI loads model at startup; inference < 300ms
- **Fallback**: if confidence < 70%, returns re-photo prompt, no treatment

#### Pillar 2 — Soil & Water Optimizer
- **Fertilizer model**: XGBoost trained on ICAR soil health card data (tabular)
- **Irrigation model**: LSTM (PyTorch) trained on IMD historical weather + FAO-56 crop ET tables
- **Joint layer**: Python rule engine aligns fertilizer + irrigation dates per agronomic constraints
- **IMD integration**: async fetch of 5-day forecast; cached in Redis (TTL 6h)

#### Pillar 3 — Market Navigator
- **Price model**: Prophet (one model per crop × mandi combination)
- **Training data**: AGMARKNET 10-year daily prices
- **Retraining**: weekly cron job, Prophet trains in minutes
- **Hold/sell engine**: deterministic calculation on top of Prophet forecast
- **e-NAM integration**: daily price pull via e-NAM API, stored in Redis (TTL 24h)

#### Pillar 4 — Government Navigator
- **No model training** — Claude API (claude-sonnet-4-6) with RAG
- **RAG flow**: farmer profile → eligibility pre-filter → top-k scheme chunks → LLM prompt
- **Scheme database**: 15+ schemes in PostgreSQL, served as structured JSON context
- **Language**: system prompt forces Tamil output; English on explicit request
- **Voice**: Web Speech API handles STT and TTS in browser, no server audio needed

### Data Layer

#### PostgreSQL (primary store)
- Farmer profiles
- Soil test results
- Diagnosis history
- Scheme database (Pillar 4 RAG)
- Price history snapshots

#### Redis (fast cache)
- IMD weather forecast (TTL 6h)
- e-NAM mandi prices (TTL 24h)
- Prophet forecast results (TTL 12h)
- Session tokens

#### Object Storage (S3 / local filesystem for hackathon)
- Uploaded crop photos (pre-inference)
- SHAP heatmap images (post-inference)
- Trained model files (.pt, .tflite, .onnx)

---

## Data Flow Per Pillar

### Pillar 1 — Crop Sentinel
```
Farmer photo → PWA compresses to 224x224 JPEG
→ POST /diagnose (multipart/form-data)
→ FastAPI: save to S3, load MobileNetV2
→ Inference: disease class + confidence + SHAP heatmap
→ Lookup: treatment DB (disease_id → modern + indigenous remedy)
→ Response: disease name (ta/en) + confidence + heatmap URL + treatments
→ PWA: render heatmap overlay + treatment card
```

### Pillar 2 — Soil & Water Optimizer
```
Farmer profile + soil test → POST /prescribe
→ FastAPI: fetch IMD 5-day forecast (Redis or API)
→ XGBoost: fertilizer prescription (NPK + micronutrients + cost)
→ LSTM: 14-day irrigation schedule
→ Joint optimizer: align dates per agronomic rules
→ Response: integrated calendar + savings summary
→ PWA: render calendar view
```

### Pillar 3 — Market Navigator
```
Crop + location + storage_type → POST /forecast
→ FastAPI: resolve nearest 3 mandis for farmer's district
→ Redis: check cached Prophet forecast (TTL 12h)
  → miss: run Prophet model, cache result
→ e-NAM: fetch today's real price (Redis TTL 24h)
→ Hold/sell engine: calculate net gain = (forecast_peak - today) - storage_cost
→ Response: 90-day price chart data + hold/sell verdict + mandi comparison
```

### Pillar 4 — Government Navigator
```
Farmer profile + Tamil query → POST /schemes
→ Eligibility pre-filter: SQL query returns eligible scheme IDs
→ RAG: fetch scheme details as JSON context (top 5 by relevance)
→ Claude API: system_prompt + scheme_context + farmer_profile + query
→ Response: Tamil text (< 150 words) + scheme list + document checklist
→ PWA: render conversation thread + deadline alerts
```

---

## Deployment (Hackathon)

```
┌─────────────────────────────────────────┐
│  Single Ubuntu VM (AWS t3.medium or     │
│  GCP e2-standard-2, free-tier eligible) │
│                                         │
│  Docker Compose:                        │
│  ├── nginx (reverse proxy + PWA serve)  │
│  ├── fastapi (gunicorn + uvicorn)       │
│  ├── postgres:15                        │
│  ├── redis:7                            │
│  └── ml-worker (model inference)        │
└─────────────────────────────────────────┘
```

**docker-compose.yml** runs everything. Single `docker compose up` to launch. Models preloaded at container start to eliminate cold-start latency during demo.

---

## Security (Minimum Viable)

- **Auth**: JWT tokens issued on farmer registration (phone OTP or anonymous device ID for hackathon)
- **API keys**: Claude API key, IMD key, e-NAM key — stored in `.env`, never in code
- **Image uploads**: validated MIME type + size limit (5MB) before S3 write
- **SQL**: all queries via SQLAlchemy ORM (parameterized, no raw SQL with user input)
- **CORS**: whitelist PWA origin only

---

## Key Architectural Decisions

| Decision | Choice | Alternative Rejected | Reason |
|----------|--------|---------------------|--------|
| ML serving | Models loaded in FastAPI process | Separate model server (TorchServe) | Simpler, fast enough for hackathon scale |
| LLM for Pillar 4 | Claude API (RAG) | Fine-tuned open-source model | No training time; scheme accuracy via RAG guardrails |
| Price forecasting | Prophet | LSTM for prices | Prophet trains in minutes on AGMARKNET; interpretable output |
| On-device ML | TFLite WASM | Server-only | Offline crop diagnosis without connectivity |
| Database | PostgreSQL only | PostgreSQL + MongoDB | Schemas are well-defined; single DB reduces ops |
| Cache | Redis | PostgreSQL materialized views | IMD/e-NAM TTL-based freshness is natural for Redis |
