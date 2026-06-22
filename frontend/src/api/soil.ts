import { useFarmerStore } from '@/store/farmerStore'
import type { CropInfo, DistrictInfo, PrescriptionRequest, PrescriptionResponse, WeatherResponse } from '@/types/soil'

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

export const soilApi = {
  getCrops: () =>
    requestV2<{ crops: CropInfo[] }>('GET', '/soil/crops'),

  getDistricts: () =>
    requestV2<{ districts: DistrictInfo[]; total: number }>('GET', '/soil/districts'),

  getPrescription: (req: PrescriptionRequest) =>
    requestV2<PrescriptionResponse>('POST', '/soil/prescribe', req),

  getWeather: (district: string) =>
    requestV2<WeatherResponse>('GET', `/soil/weather/${encodeURIComponent(district)}`),

  getPrices: () =>
    requestV2<{ prices: unknown[] }>('GET', '/soil/prices'),
}
