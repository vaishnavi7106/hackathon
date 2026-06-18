import { useFarmerStore } from '@/store/farmerStore'
import type { ApiErrorResponse } from '@/types/api'

const BASE = '/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public messageTa?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const token = useFarmerStore.getState().token

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    let errTa: string | undefined
    try {
      const errBody: ApiErrorResponse = await res.json()
      const detail = errBody.detail ?? errBody.error
      if (typeof detail === 'string') errMsg = detail
      else if (detail) {
        errMsg = detail.message ?? errMsg
        errTa = detail.message_ta
      }
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(res.status, errMsg, errTa)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, form, true),
}
