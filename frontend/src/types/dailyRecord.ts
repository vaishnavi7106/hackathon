export interface DailyWeather {
  rain_mm: number
  temp_c: number
  humidity_pct: number
  source: string
  pulled_at: string
}

export interface FertilizerItem {
  name: string  // "Urea" | "DAP" | "MOP"
  bags: number
  price_per_bag: number
  total: number
}

export interface FertilizerApplication {
  stage: string
  stage_ta: string
  day: number
  items: FertilizerItem[]
  total_cost: number
  instruction: string       // plain text application instruction
  instruction_ta: string
}

export interface DailyRecord {
  date: string              // YYYY-MM-DD
  cropId?: string           // FarmerCrop.id — undefined for legacy records
  cropName?: string         // "rice", "banana", etc.
  weather: DailyWeather | null
  et0_mm: number
  crop_water_need_mm: number
  kc_used: number
  growth_stage: string      // FAO stage for calculation
  display_stage: string     // Farmer-friendly stage name (English)
  display_stage_ta: string  // Farmer-friendly stage name (Tamil)
  stage_days: number
  irrigation_recommended: 'skip' | 'irrigate' | 'skip_rain'
  irrigation_minutes: number | null
  irrigation_cost_estimate: number | null
  irrigation_confirmed: boolean | null
  fertilizer_due: boolean
  fertilizer_application: FertilizerApplication | null
  fertilizer_confirmed: boolean | null
  next_fertilizer?: { stage: string; stage_ta: string; day: number; date_estimate: string } | null
  next_irrigation_day?: string | null
}

export interface DailyComputedResult {
  district: string
  date: string
  weather: {
    today: {
      tmax_c: number
      tmin_c: number
      tmean_c: number
      humidity_pct: number
      rain_mm: number
      et0_mm: number
    }
    tomorrow: {
      rain_mm: number
      et0_mm: number
    }
  } | null
  et0_mm: number
  kc_used: number
  stage_days: number
  growth_stage: string
  display_stage: string
  display_stage_ta: string
  crop_water_need_mm: number
  yesterday_rain_mm: number
  deficit_mm: number
  irrigation_recommended: 'skip' | 'irrigate' | 'skip_rain'
  irrigation_minutes: number | null
  fertilizer_due: boolean
  fertilizer_application: FertilizerApplication | null
  next_fertilizer: { stage: string; stage_ta: string; day: number } | null
}
