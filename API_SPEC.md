# Uzhavar AI — API Specification

Base URL: `https://api.uzhavar.ai/v1` (hackathon: `http://localhost:8000/v1`)

All endpoints return `application/json`. Auth via `Authorization: Bearer <jwt>` header (except `/auth`).

---

## Auth

### POST /auth/register
Register a new farmer or return existing farmer for phone number.

**Request:**
```json
{
  "phone": "9876543210",
  "name": "Karthik",
  "district": "Coimbatore",
  "village": "Perur",
  "language": "ta"
}
```

**Response `201`:**
```json
{
  "farmer_id": "uuid",
  "token": "jwt_string",
  "expires_at": "2025-08-01T00:00:00Z"
}
```

---

### POST /auth/login
Simple phone-based login (OTP skipped for hackathon — submit phone, get token).

**Request:** `{ "phone": "9876543210" }`

**Response `200`:** Same as `/auth/register` response.

---

## Farmer Profile

### GET /farmer/me
Returns complete farmer profile with crops and latest soil test.

**Response `200`:**
```json
{
  "farmer_id": "uuid",
  "name": "Karthik",
  "district": "Coimbatore",
  "village": "Perur",
  "land_size_acres": 2.5,
  "pump_type": "electric",
  "storage_facility": "home",
  "language": "ta",
  "aadhaar_linked": true,
  "crops": [
    { "crop": "rice", "acres": 2.5, "season": "kharif" }
  ],
  "latest_soil_test": {
    "test_id": "uuid",
    "tested_at": "2025-06-01",
    "ph": 6.8,
    "nitrogen": 210,
    "phosphorus": 18,
    "potassium": 145
  }
}
```

---

### PUT /farmer/me
Update farmer profile fields. Partial updates accepted.

**Request:**
```json
{
  "land_size_acres": 3.0,
  "pump_type": "diesel",
  "crops": [
    { "crop": "rice", "acres": 2.5, "season": "kharif" },
    { "crop": "groundnut", "acres": 0.5, "season": "rabi" }
  ]
}
```

**Response `200`:** Updated farmer profile object (same as GET /farmer/me).

---

### POST /farmer/soil-test
Submit soil test results.

**Request:**
```json
{
  "tested_at": "2025-06-15",
  "ph": 6.8,
  "nitrogen": 210,
  "phosphorus": 18,
  "potassium": 145,
  "organic_matter": 0.8,
  "zinc": 0.4,
  "iron": 4.2
}
```

**Response `201`:**
```json
{
  "test_id": "uuid",
  "tested_at": "2025-06-15",
  "deficiencies": ["zinc"]
}
```

---

## Pillar 1 — Crop Sentinel

### POST /diagnose
Submit a crop photo for disease diagnosis.

**Request:** `multipart/form-data`
- `image`: JPEG/PNG file (max 5MB)
- `crop`: string — e.g. `"rice"` (optional; improves accuracy)
- `farmer_id`: UUID (from JWT; included for logging)

**Processing:**
1. Validate MIME type and size
2. Resize to 224×224, save original to object store
3. Run MobileNetV2 inference
4. If confidence ≥ 0.70: run SHAP, lookup treatment, return full result
5. If confidence < 0.70: return low-confidence prompt

**Response `200` (confident):**
```json
{
  "diagnosis_id": "uuid",
  "disease": {
    "id": "rice_bacterial_leaf_blight",
    "name_en": "Rice Bacterial Leaf Blight",
    "name_ta": "நெல் பாக்டீரியல் இலை கருக்கல்"
  },
  "confidence": 0.91,
  "confidence_level": "high",
  "heatmap_url": "/media/heatmap/uuid.png",
  "shap_label_ta": "இந்த இலையின் மஞ்சள் பகுதி நோயை காட்டுகிறது",
  "treatment": {
    "modern": {
      "chemical": "Streptocycline 15g + Copper oxychloride 500g",
      "dosage": "Per 100L water, spray 2 times at 7-day interval",
      "cost_per_acre": 240,
      "supply_note": "Available at district agriculture office and licensed dealers"
    },
    "indigenous": {
      "name": "Panchagavya + Neem oil spray",
      "method": "Mix 3% panchagavya + 5ml neem oil per litre. Spray at dawn on affected leaves.",
      "preparation_ta": "3% பஞ்சகவ்யா + 5மில் வேம்பு எண்ணெய் ஒரு லிட்டர் நீரில் கலந்து காலையில் தெளிக்கவும்"
    }
  }
}
```

**Response `200` (low confidence):**
```json
{
  "diagnosis_id": "uuid",
  "confidence": 0.54,
  "confidence_level": "low",
  "low_confidence_prompt_ta": "படம் தெளிவாக இல்லை. நோயுற்ற இலையை நெருக்கமாக படம் எடுக்கவும்.",
  "low_confidence_prompt_en": "Image unclear. Please retake a close-up photo of the affected leaf in daylight."
}
```

**Errors:**
- `400` — invalid file type or file too large
- `422` — missing required field
- `503` — model not loaded

---

### GET /diagnose/{diagnosis_id}
Retrieve a previous diagnosis result.

**Response `200`:** Same structure as POST /diagnose response.

---

### GET /diagnose/history
Returns last 10 diagnoses for authenticated farmer.

**Response `200`:**
```json
{
  "diagnoses": [
    {
      "diagnosis_id": "uuid",
      "disease_name_ta": "நெல் பாக்டீரியல் இலை கருக்கல்",
      "confidence": 0.91,
      "created_at": "2025-06-15T08:30:00Z",
      "heatmap_url": "/media/heatmap/uuid.png"
    }
  ]
}
```

---

## Pillar 2 — Soil & Water Optimizer

### POST /prescribe
Generate joint fertilizer + irrigation plan.

**Request:**
```json
{
  "crop": "rice",
  "acres": 2.5,
  "season": "kharif",
  "soil_test_id": "uuid",
  "start_date": "2025-07-01"
}
```

If `soil_test_id` is omitted, ICAR district baseline is used automatically.

**Processing:**
1. Fetch soil test (or ICAR baseline)
2. Fetch IMD 5-day forecast for farmer's district (Redis or API)
3. Run XGBoost fertilizer model
4. Run LSTM irrigation model (14-day forecast)
5. Joint optimizer aligns fertilizer + irrigation dates
6. Return integrated calendar

**Response `200`:**
```json
{
  "prescription_id": "uuid",
  "fertilizer": {
    "nitrogen_kg_per_acre": 18.5,
    "phosphorus_kg_per_acre": 9.0,
    "potassium_kg_per_acre": 12.0,
    "micronutrients": {
      "zinc_deficiency": true,
      "zinc_supplement": "Zinc sulphate 25kg/ha",
      "iron_deficiency": false
    },
    "total_cost_estimate": 1840,
    "savings_vs_standard": 620,
    "savings_note_ta": "இந்த மருந்து உங்கள் பகுதியில் வழக்கமான முறையை விட ₹620 மிச்சப்படுத்தும்"
  },
  "irrigation": {
    "total_sessions": 8,
    "schedule": [
      { "day": 1,  "date": "2025-07-01", "duration_min": 90, "volume_litres": 1800, "cost_estimate": 42 },
      { "day": 4,  "date": "2025-07-04", "duration_min": 60, "volume_litres": 1200, "cost_estimate": 28 }
    ],
    "rain_skips": ["2025-07-07"],
    "rain_skip_note_ta": "ஜூலை 7 அன்று மழை வர வாய்ப்பு உள்ளது. நீர்ப்பாசனம் தேவையில்லை."
  },
  "joint_calendar": [
    { "day": 1, "date": "2025-07-01", "action": "irrigate", "detail": "90 நிமிடம் நீர்ப்பாசனம்" },
    { "day": 2, "date": "2025-07-02", "action": "fertilize", "detail": "1.8kg யூரியா/ஏக்கர் இடவும்" },
    { "day": 4, "date": "2025-07-04", "action": "irrigate", "detail": "60 நிமிடம் நீர்ப்பாசனம்" }
  ],
  "weather_forecast_used": {
    "source": "IMD",
    "fetched_at": "2025-07-01T06:00:00Z",
    "days": [
      { "date": "2025-07-07", "rain_mm": 8.2, "rain_expected": true }
    ]
  }
}
```

**Errors:**
- `404` — soil_test_id not found for this farmer
- `503` — IMD API unavailable (fallback to cached forecast or no rain skip)

---

### GET /prescribe/{prescription_id}
Retrieve a past prescription.

**Response `200`:** Same as POST /prescribe.

---

## Pillar 3 — Market Navigator

### POST /forecast
Generate price forecast and hold/sell recommendation.

**Request:**
```json
{
  "crop": "rice",
  "storage_facility": "home",
  "override_mandi_ids": []
}
```

`override_mandi_ids` is optional; if empty, the 3 nearest mandis to farmer's district are used.

**Processing:**
1. Resolve 3 nearest mandis for farmer's district
2. Fetch today's modal price from Redis (e-NAM TTL 24h)
3. Check Redis for cached Prophet forecast; if miss, run Prophet and cache
4. Calculate hold/sell: net_gain = (peak_price - today_price) - storage_cost
5. Calculate transport-adjusted net price for each mandi

**Response `200`:**
```json
{
  "forecast_id": "uuid",
  "crop": "rice",
  "generated_at": "2025-07-01T09:00:00Z",
  "mandis": [
    {
      "mandi_id": "CBE_01",
      "name": "Coimbatore Mandi",
      "distance_km": 12,
      "today_price": 1820,
      "transport_cost_per_quintal": 40,
      "net_price": 1780
    },
    {
      "mandi_id": "TPR_01",
      "name": "Tirupur Mandi",
      "distance_km": 35,
      "today_price": 1940,
      "transport_cost_per_quintal": 80,
      "net_price": 1860
    }
  ],
  "best_mandi": {
    "mandi_id": "TPR_01",
    "name": "Tirupur Mandi",
    "net_price": 1860,
    "note_ta": "திருப்பூர் சந்தை இன்று சிறந்தது (போக்குவரத்துக்கு பிறகு ₹1,860/குவிண்டால்)"
  },
  "price_forecast": {
    "mandi_id": "CBE_01",
    "series": [
      { "date": "2025-07-01", "yhat": 1820, "yhat_lower": 1780, "yhat_upper": 1860 },
      { "date": "2025-07-02", "yhat": 1835, "yhat_lower": 1790, "yhat_upper": 1875 }
    ],
    "peak_price": 2340,
    "peak_date": "2025-09-10",
    "peak_confidence_range": [2200, 2480]
  },
  "hold_sell": {
    "recommendation": "HOLD",
    "today_price": 1820,
    "forecast_peak_price": 2340,
    "weeks_to_hold": 6,
    "storage_cost_per_quintal": 420,
    "net_gain_per_quintal": 100,
    "calculation_ta": "இன்றைய விலை: ₹1,820. ஜூலை 10 அன்று உச்சம்: ₹2,340. சேமிப்பு செலவு: ₹420. நிகர லாபம்: ₹100/குவிண்டால்.",
    "historical_note_ta": "கடந்த 5 ஆண்டுகளில் 3 முறை ஜூலை மாதத்தில் விலை உச்சத்தை எட்டியது."
  }
}
```

**Response when SELL is recommended:**
`hold_sell.recommendation` = `"SELL"` and `net_gain_per_quintal` will be negative or below threshold.

**Errors:**
- `404` — crop not supported for forecasting
- `503` — e-NAM API unavailable (falls back to last cached price)

---

### GET /prices/live
Real-time mandi prices for a crop near farmer's district.

**Query params:** `crop=rice`

**Response `200`:**
```json
{
  "crop": "rice",
  "district": "Coimbatore",
  "prices": [
    { "mandi_id": "CBE_01", "name": "Coimbatore", "modal_price": 1820, "price_date": "2025-07-01", "source": "enam" }
  ],
  "cache_age_seconds": 3600
}
```

---

## Pillar 4 — Government Navigator

### POST /schemes/eligible
Pre-filter eligible schemes for farmer (no LLM, fast SQL).

**Request:** No body — farmer profile is read from JWT.

**Response `200`:**
```json
{
  "eligible_count": 3,
  "schemes": [
    {
      "scheme_id": "PM_KISAN_01",
      "name_ta": "பிஎம் கிசான் சம்மான் நிதி",
      "name_en": "PM Kisan Samman Nidhi",
      "benefit_amount": "₹6,000 per year",
      "benefit_amount_num": 6000,
      "application_deadline": "rolling",
      "deadline_urgent": false,
      "documents_required": ["Aadhaar", "Land record (patta)", "Bank account"],
      "application_url": "https://pmkisan.gov.in",
      "description_ta": "சிறு மற்றும் குறு விவசாயிகளுக்கு ஆண்டுக்கு ₹6,000 வருமான ஆதரவு."
    }
  ],
  "deadline_alerts": [
    {
      "scheme_id": "TN_DRIP_01",
      "name_ta": "தமிழ்நாடு துளி நீர்ப்பாசன மானியம்",
      "deadline": "2025-07-15",
      "days_remaining": 14,
      "urgent": true
    }
  ]
}
```

---

### POST /schemes/chat
Conversational Tamil query about schemes (LLM-backed RAG).

**Request:**
```json
{
  "message": "எனக்கு என்ன மானியங்கள் கிடைக்கும்?",
  "language": "ta",
  "conversation_id": "uuid_or_null"
}
```

**Processing:**
1. Run eligibility pre-filter SQL → get scheme IDs
2. Fetch scheme detail JSON for eligible schemes
3. Build RAG context: system_prompt + scheme_context + farmer_profile + user_message
4. Call Claude API (claude-sonnet-4-6), max 300 tokens output
5. Store query + response in scheme_queries

**Response `200`:**
```json
{
  "conversation_id": "uuid",
  "response_ta": "கார்த்திக் சார், உங்களுக்கு 3 திட்டங்களில் தகுதி உள்ளது:\n1. PM-KISAN: ₹6,000/ஆண்டு\n2. துளி நீர்ப்பாசனம்: 100% மானியம்\n3. TNFISS: ₹8,000/ஆண்டு\nவிண்ணப்பிக்க: pmkisan.gov.in",
  "eligible_scheme_ids": ["PM_KISAN_01", "TN_DRIP_01", "TNFISS_01"],
  "deadline_alerts": [
    { "scheme_id": "TN_DRIP_01", "deadline": "2025-07-15", "days_remaining": 14 }
  ],
  "latency_ms": 1820
}
```

**Errors:**
- `503` — Claude API unavailable (return eligible schemes list without LLM narrative)

---

### GET /schemes/{scheme_id}
Full scheme detail.

**Response `200`:**
```json
{
  "scheme_id": "PM_KISAN_01",
  "name_en": "PM Kisan Samman Nidhi",
  "name_ta": "பிஎம் கிசான் சம்மான் நிதி",
  "level": "central",
  "benefit_amount": "₹6,000 per year (3 installments of ₹2,000)",
  "eligibility_ta": "சிறு மற்றும் குறு விவசாயிகளுக்கு (2 ஹெக்டேர் வரை நிலம்) தகுதி உண்டு.",
  "documents_required": ["Aadhaar", "Land record (patta)", "Bank account"],
  "documents_ta": ["ஆதார் அட்டை", "பட்டா", "வங்கி கணக்கு"],
  "application_deadline": "rolling",
  "application_url": "https://pmkisan.gov.in",
  "last_verified": "2025-01-15"
}
```

---

## Health

### GET /health
Service health check for all components.

**Response `200`:**
```json
{
  "status": "ok",
  "components": {
    "database": "ok",
    "redis": "ok",
    "crop_sentinel_model": "ok",
    "xgboost_model": "ok",
    "lstm_model": "ok",
    "prophet_models_loaded": 12,
    "claude_api": "ok",
    "enam_api": "ok",
    "imd_api": "ok"
  },
  "version": "0.1.0"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "IMAGE_TOO_LARGE",
    "message": "Image must be under 5MB",
    "message_ta": "படத்தின் அளவு 5MB-க்கும் குறைவாக இருக்க வேண்டும்"
  }
}
```

---

## Rate Limits (Hackathon defaults)

| Endpoint | Limit |
|----------|-------|
| `POST /diagnose` | 20 req/min per farmer |
| `POST /schemes/chat` | 30 req/min per farmer (Claude API cost) |
| `POST /forecast` | 60 req/min per farmer |
| All others | 120 req/min per farmer |
