// ── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  name?: string
  phone?: string
  district: string
  village?: string
  language?: 'ta' | 'hi' | 'en'
}

export interface LoginRequest {
  phone: string
}

export interface TokenResponse {
  farmer_id: string
  token: string
  expires_at: string
}

// ── Farmer ───────────────────────────────────────────────────────────────────

export interface FarmerCropIn {
  crop_id?: string
  crop: string
  acres: number
  season?: 'kharif' | 'rabi' | 'summer' | 'annual'
  sowing_date?: string
  expected_harvest_date?: string
}

export interface FarmerCropOut extends FarmerCropIn {
  id: string
  created_at: string
}

export interface SoilTestOut {
  test_id: string
  tested_at: string
  ph: number | null
  nitrogen: number | null
  phosphorus: number | null
  potassium: number | null
  organic_matter: number | null
  zinc: number | null
  iron: number | null
  copper: number | null
  boron: number | null
  source: string
  deficiencies: string[]
}

export interface FarmerProfile {
  farmer_id: string
  phone: string | null
  name: string | null
  district: string
  taluk: string | null
  village: string | null
  gender: 'male' | 'female' | 'other' | null
  land_size_acres: number | null
  pump_type: 'diesel' | 'electric' | 'none' | null
  storage_facility: 'home' | 'warehouse' | 'cold_storage' | null
  language: string
  aadhaar_linked: boolean
  income_band: 'below_1L' | '1L_2L' | 'above_2L' | null
  age: number | null
  bank_account_linked: boolean | null
  land_ownership: 'own' | 'lease' | 'tenant' | null
  primary_crop: string | null
  secondary_crop: string | null
  season: 'wet_season' | 'dry_season' | 'summer' | null
  irrigation_type: 'borewell' | 'canal' | 'tank' | 'rainfed' | 'drip' | null
  soil_type: 'clay' | 'loamy' | 'sandy' | 'red' | 'black' | 'other' | null
  soil_health_card_url: string | null
  crops: FarmerCropOut[]
  latest_soil_test: SoilTestOut | null
  created_at: string
  updated_at: string
}

export interface FarmerUpdate {
  name?: string
  district?: string
  village?: string
  land_size_acres?: number
  pump_type?: 'diesel' | 'electric' | 'none'
  storage_facility?: 'home' | 'warehouse' | 'cold_storage'
  language?: 'ta' | 'hi' | 'en'
  aadhaar_linked?: boolean
  income_band?: 'below_1L' | '1L_2L' | 'above_2L'
  age?: number
  bank_account_linked?: boolean
  land_ownership?: 'own' | 'lease' | 'tenant'
  crops?: FarmerCropIn[]
}

// ── Schemes ──────────────────────────────────────────────────────────────────

export interface EligibleSchemeOut {
  scheme_id: string
  name_ta: string
  name_en: string
  level?: 'central' | 'state' | 'district'
  benefit_amount: string | null
  benefit_amount_ta: string | null
  benefit_amount_num: number | null
  application_deadline: string | null
  deadline_urgent: boolean
  documents_required: string[]
  documents_ta: string[] | null
  application_url: string | null
  application_mode: string | null
  application_portal_name: string | null
  application_process_summary: string | null
  description_ta: string
  description_en: string | null
  eligibility_ta: string | null
  department_ta: string | null
  department_en: string | null
  year: string | null
  source_url: string | null
  eligibility_state: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_MORE_INFO'
}

export interface GovernmentSchemeOut extends EligibleSchemeOut {
  state: string
  department_en: string | null
  scheme_code: string | null
  source_scheme_id: string | null
  description_en: string | null
  eligibility_en: string | null
  min_land_acres: number
  max_land_acres: number | null
  requires_aadhaar: boolean
  eligible_crops: string[] | null
  eligible_districts: string[] | null
  income_band_max: string | null
  eligible_income_bands: string[] | null
  office_type: string | null
  last_verified: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SchemeListResponse {
  total: number
  schemes: EligibleSchemeOut[]
}

export interface DeadlineAlert {
  scheme_id: string
  name_ta: string
  deadline: string
  days_remaining: number
  urgent: boolean
}

export interface EligibleSchemesResponse {
  eligible_count: number
  schemes: EligibleSchemeOut[]
  needs_more_info_count: number
  needs_more_info_schemes: EligibleSchemeOut[]
  deadline_alerts: DeadlineAlert[]
}

export interface EligibilityResultOut {
  result_id: string
  farmer_id: string
  scheme_id: string
  is_eligible: boolean
  eligibility_state: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_MORE_INFO' | null
  criteria_results: Record<string, boolean>
  query_text: string | null
  llm_response: string | null
  language: string
  latency_ms: number | null
  deadline_date: string | null
  days_to_deadline: number | null
  checked_at: string
}

export interface SchemeChatRequest {
  message: string
  language?: 'ta' | 'hi' | 'en'
  conversation_id?: string
}

export interface SchemeChatResponse {
  conversation_id: string
  response_ta: string
  eligible_scheme_ids: string[]
  deadline_alerts: DeadlineAlert[]
  latency_ms: number
}

// ── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
  message_ta?: string
}

export interface ApiErrorResponse {
  detail?: ApiError | string
  error?: ApiError
}
