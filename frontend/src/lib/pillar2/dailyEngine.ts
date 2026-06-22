import { getDailyData } from '@/api/daily'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { getStageName } from './stageNames'
import type { LocalProfile, FarmerCrop } from '@/types/profile'
import type { DailyRecord, DailyComputedResult, FertilizerApplication } from '@/types/dailyRecord'

/**
 * Returns true if a new daily calculation is needed.
 * Triggers when:
 *  - lastCalculatedAt is null (never run)
 *  - lastCalculatedAt is from a previous calendar day
 *  - current time >= 06:00 AND lastCalculatedAt was before 06:00 today
 */
export function needsRecalculation(lastCalculatedAt: string | null): boolean {
  if (!lastCalculatedAt) return true

  const now = new Date()
  const last = new Date(lastCalculatedAt)

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate())

  if (lastDay < today) return true

  const sixAmToday = new Date(today.getTime())
  sixAmToday.setHours(6, 0, 0, 0)
  if (now >= sixAmToday && last < sixAmToday) return true

  return false
}

/**
 * Compute days since plantingDate, or 0 if not set / invalid.
 */
export function computeStageDays(plantingDateStr: string | null | undefined): number {
  if (!plantingDateStr) return 0
  try {
    const planted = new Date(plantingDateStr)
    if (isNaN(planted.getTime())) return 0
    const now = new Date()
    const diffMs = now.getTime() - planted.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    // Day 1 = planting day (agricultural convention). Add 1 so today → Day 1, not Day 0.
    return Math.max(1, days + 1)
  } catch {
    return 0
  }
}

/**
 * Map the API DailyComputedResult to the local DailyRecord shape.
 */
function mapToRecord(result: DailyComputedResult, crop: string): DailyRecord {
  const stageInfo = getStageName(result.stage_days ?? 0, crop)

  let nextFertilizer: DailyRecord['next_fertilizer'] = null
  if (result.next_fertilizer) {
    const nf = result.next_fertilizer
    const daysUntil = nf.day - (result.stage_days ?? 0)
    const estimateDate = new Date()
    estimateDate.setDate(estimateDate.getDate() + Math.max(0, daysUntil))
    nextFertilizer = {
      stage: nf.stage,
      stage_ta: nf.stage_ta,
      day: nf.day,
      date_estimate: estimateDate.toISOString().slice(0, 10),
    }
  }

  const weather = result.weather
    ? {
        rain_mm: result.weather.today.rain_mm,
        temp_c: result.weather.today.tmean_c,
        humidity_pct: result.weather.today.humidity_pct,
        source: 'OpenWeatherMap',
        pulled_at: new Date().toISOString(),
      }
    : null

  const fertApp: FertilizerApplication | null = result.fertilizer_application
    ? {
        stage: result.fertilizer_application.stage,
        stage_ta: result.fertilizer_application.stage_ta,
        day: result.fertilizer_application.day,
        items: result.fertilizer_application.items,
        total_cost: result.fertilizer_application.total_cost,
        instruction: result.fertilizer_application.instruction,
        instruction_ta: result.fertilizer_application.instruction_ta,
      }
    : null

  return {
    date: result.date,
    weather,
    et0_mm: result.et0_mm,
    crop_water_need_mm: result.crop_water_need_mm,
    kc_used: result.kc_used,
    growth_stage: result.growth_stage,
    display_stage: result.display_stage ?? stageInfo.name,
    display_stage_ta: result.display_stage_ta ?? stageInfo.name_ta,
    stage_days: result.stage_days ?? 0,
    irrigation_recommended: result.irrigation_recommended,
    irrigation_minutes: result.irrigation_minutes,
    irrigation_cost_estimate: null,
    irrigation_confirmed: null,
    fertilizer_due: result.fertilizer_due,
    fertilizer_application: fertApp,
    fertilizer_confirmed: null,
    next_fertilizer: nextFertilizer,
    next_irrigation_day: null,
  }
}

/**
 * Build a synthetic FarmerCrop list from legacy flat profile fields.
 * Used when the profile hasn't been migrated yet.
 */
function legacyCrops(profile: LocalProfile): FarmerCrop[] {
  if (!profile.primaryCrop) return []
  const totalAcres = parseFloat(profile.landSizeAcres) || 1
  const each = profile.secondaryCrop ? totalAcres / 2 : totalAcres
  const crops: FarmerCrop[] = [
    {
      id: 'legacy-primary',
      name: profile.primaryCrop,
      acres: each,
      plantingDate: profile.plantingDate || '',
      season: profile.season || '',
      irrigationType: profile.irrigationType || '',
    },
  ]
  if (profile.secondaryCrop) {
    crops.push({
      id: 'legacy-secondary',
      name: profile.secondaryCrop,
      acres: each,
      plantingDate: '',
      season: profile.season || '',
      irrigationType: profile.irrigationType || '',
    })
  }
  return crops
}

/**
 * Run the daily calculation for every crop in the farmer's profile.
 * Weather is fetched separately per crop (API already handles Kc per crop).
 * Returns a map of cropId → DailyRecord.
 */
export async function runDailyCalculation(
  profile: LocalProfile,
  yesterday_rain_mm = 0,
): Promise<Record<string, DailyRecord>> {
  const store = useDailyRecordStore.getState()
  store.setCalculating(true)

  const results: Record<string, DailyRecord> = {}

  try {
    const crops = profile.crops.length > 0 ? profile.crops : legacyCrops(profile)
    if (crops.length === 0) return results

    for (const crop of crops) {
      if (!crop.name) continue

      const stage_days = computeStageDays(crop.plantingDate || null)

      const result = await getDailyData({
        district: profile.district || 'chennai',
        crop: crop.name,
        stage_days,
        land_acres: crop.acres || 1.0,
        irrigation_type: crop.irrigationType || 'canal',
        yesterday_rain_mm,
        lang: profile.language || 'ta',
      })

      const record: DailyRecord = {
        ...mapToRecord(result, crop.name),
        cropId: crop.id,
        cropName: crop.name,
      }

      store.setTodayForCrop(crop.id, record)
      store.addToHistoryForCrop(crop.id, record)
      store.addToSyncQueue(record)
      store.setLastPlantingDateUsedForCrop(crop.id, crop.plantingDate || '')
      results[crop.id] = record
    }

    store.setLastCalculatedAt(new Date().toISOString())
    return results
  } finally {
    store.setCalculating(false)
  }
}
