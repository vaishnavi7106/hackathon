// ── Pillar 2 — Soil & Water Optimizer types ─────────────────────────────────

export interface PrescriptionRequest {
  district: string
  crop: string
  season: string
  land_acres: number
  irrigation_type: string
  crop_stage_days: number
  soil_color?: string | null
  symptoms?: string[]
  shc_data?: { n_kg_ha: number; p_kg_ha: number; k_kg_ha: number } | null
  planting_date?: string | null
  lang?: 'ta' | 'en'
}

export interface SplitScheduleItem {
  day: number
  stage: string
  stage_ta: string
  is_past: boolean
  urea_bags: number
  dap_bags: number
  mop_bags: number
  products: string[]
}

export interface IrrigationDay {
  date: string
  day_of_week: string
  action: 'irrigate' | 'skip_rain' | 'skip_sufficient' | 'advisory'
  duration_min: number | null
  rainfall_mm: number
  et0_mm: number
  etc_mm: number
  net_deficit_mm: number
  note: string
}

export interface IrrigationSchedule {
  weekly_schedule: IrrigationDay[]
  kc_used: number
  growth_stage: string
  total_irrigation_days: number
  total_skip_days: number
  weather_source: string
}

export interface CalendarEvent {
  day: number
  date: string | null
  type: 'fertilizer' | 'irrigation' | 'both' | 'rain_advisory'
  actions: string[]
  products: string[]
  irrigation_duration_min: number | null
  note: string | null
  urgency: 'high' | 'normal' | 'low'
}

export interface PrescriptionResponse {
  prescription_id: string
  district: string
  crop: string
  season: string
  land_acres: number
  zone_id: number
  zone_name: string
  zone_name_ta: string
  recommendation: {
    rec_id: string
    n_kg_ha: number
    p_kg_ha: number
    k_kg_ha: number
    n_adjusted: number
    p_adjusted: number
    k_adjusted: number
    adjustments_applied: string[]
    confidence_level: 'soil_health_card' | 'symptom_adjusted' | 'district_default'
    source_ref: string
    source_url: string
  }
  products: {
    urea_bags: number
    dap_bags: number
    mop_bags: number
    urea_kg: number
    dap_kg: number
    mop_kg: number
    cost: {
      urea_inr: number
      dap_inr: number
      mop_inr: number
      total_inr: number
    }
    prices_used: {
      urea_per_bag: number
      dap_per_bag: number
      mop_per_bag: number
      source: string
    }
  }
  split_schedule: SplitScheduleItem[]
  irrigation: IrrigationSchedule | null
  joint_calendar: CalendarEvent[]
  explanation: string
  disclaimer: string
  generated_at: string
  weather_note?: string
}

export interface CropInfo {
  crop: string
  crop_ta: string
}

export interface DistrictInfo {
  id: number
  name: string
  name_ta: string
  zone_id: number
  zone_name: string
  lat: number
  lon: number
}

export interface WeatherDay {
  date: string
  day_of_week: string
  tmax_c: number
  tmin_c: number
  rainfall_mm: number
  et0_mm: number
}

export interface WeatherResponse {
  district: string
  forecast_date: string
  source: string
  days: WeatherDay[]
}
