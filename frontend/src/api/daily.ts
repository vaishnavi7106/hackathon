import { useFarmerStore } from '@/store/farmerStore'
import type { DailyComputedResult, DailyRecord } from '@/types/dailyRecord'

const BASE_V2 = '/v2'

async function requestV2<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useFarmerStore.getState().token
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_V2}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const errBody = await res.json()
      if (typeof errBody.detail === 'string') errMsg = errBody.detail
      else if (typeof errBody.error === 'string') errMsg = errBody.error
      else if (errBody.error?.message) errMsg = errBody.error.message
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }

  return res.json() as Promise<T>
}

// GET /v2/soil/daily/{district}
export async function getDailyData(params: {
  district: string
  crop: string
  stage_days: number
  land_acres: number
  irrigation_type: string
  yesterday_rain_mm: number
  lang: string
}): Promise<DailyComputedResult> {
  const qs = new URLSearchParams({
    crop: params.crop,
    stage_days: String(params.stage_days),
    land_acres: String(params.land_acres),
    irrigation_type: params.irrigation_type,
    yesterday_rain_mm: String(params.yesterday_rain_mm),
    lang: params.lang,
  })
  return requestV2<DailyComputedResult>(
    'GET',
    `/soil/daily/${encodeURIComponent(params.district)}?${qs.toString()}`,
  )
}

// POST /v2/soil/daily-record
// Maps the nested DailyRecord shape to the flat DailyRecordIn schema the backend expects.
export async function saveDailyRecord(record: DailyRecord): Promise<void> {
  const payload = {
    record_date: record.date,
    rain_mm: record.weather?.rain_mm ?? null,
    temp_c: record.weather?.temp_c ?? null,
    humidity_pct: record.weather?.humidity_pct ?? null,
    weather_source: record.weather?.source ?? null,
    weather_pulled_at: record.weather?.pulled_at ?? null,
    et0_mm: record.et0_mm,
    crop_water_need_mm: record.crop_water_need_mm,
    irrigation_recommended: record.irrigation_recommended,
    irrigation_minutes: record.irrigation_minutes,
    irrigation_confirmed: record.irrigation_confirmed,
    fertilizer_due: record.fertilizer_due,
    fertilizer_stage: record.fertilizer_application?.stage ?? null,
    fertilizer_cost: record.fertilizer_application?.total_cost ?? null,
    fertilizer_confirmed: record.fertilizer_confirmed,
    fertilizer_items: record.fertilizer_application
      ? { items: record.fertilizer_application.items }
      : null,
  }
  await requestV2<void>('POST', '/soil/daily-record', payload)
}

// GET /v2/soil/daily-records
export async function getDailyHistory(days = 30): Promise<DailyRecord[]> {
  const result = await requestV2<{ records: DailyRecord[]; total: number }>(
    'GET',
    `/soil/daily-records?days=${days}`,
  )
  return result.records
}
