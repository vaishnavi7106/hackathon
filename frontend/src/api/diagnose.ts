import { useFarmerStore } from '@/store/farmerStore'
import { ApiError } from './client'
import type { DiagnoseResponse, DiagnoseHistoryItem } from '@/types/diagnose'

const BASE = '/v1'

async function requestDiagnose<T>(
  method: string,
  path: string,
  body?: FormData | unknown,
): Promise<T> {
  const token = useFarmerStore.getState().token
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const isForm = body instanceof FormData
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    let msgTa: string | undefined
    try {
      const err = await res.json()
      const detail = err.detail ?? err.error
      if (typeof detail === 'string') msg = detail
      else if (detail) {
        msg = detail.message ?? msg
        msgTa = detail.message_ta
      }
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg, msgTa)
  }

  return res.json() as Promise<T>
}

export async function diagnoseImage(
  image: File,
  crop: string,
  latitude?: number,
  longitude?: number,
): Promise<DiagnoseResponse> {
  const form = new FormData()
  form.append('image', image)
  form.append('crop', crop)
  if (latitude != null) form.append('latitude', String(latitude))
  if (longitude != null) form.append('longitude', String(longitude))
  return requestDiagnose<DiagnoseResponse>('POST', '/diagnose', form)
}

export async function submitRiceSymptoms(
  diagnosis_id: string,
  selected_symptoms: string[],
): Promise<DiagnoseResponse> {
  return requestDiagnose<DiagnoseResponse>('POST', '/diagnose/rice-symptoms', {
    diagnosis_id,
    selected_symptoms,
  })
}

export async function getDiagnoseHistory(): Promise<DiagnoseHistoryItem[]> {
  const res = await requestDiagnose<{ diagnoses: DiagnoseHistoryItem[] }>(
    'GET',
    '/diagnose/history',
  )
  return res.diagnoses
}
