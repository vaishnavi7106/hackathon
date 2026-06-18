import { api } from './client'
import type {
  EligibilityResultOut,
  EligibleSchemesResponse,
  GovernmentSchemeOut,
  SchemeChatRequest,
  SchemeChatResponse,
  SchemeListResponse,
} from '@/types/api'

export const schemesApi = {
  /** GET /v1/schemes — full catalog with optional level filter */
  list: (level?: 'central' | 'state') => {
    const qs = level ? `?level=${level}` : ''
    return api.get<SchemeListResponse>(`/schemes${qs}`)
  },

  /** GET /v1/schemes/:id — single scheme detail */
  getById: (schemeId: string) =>
    api.get<GovernmentSchemeOut>(`/schemes/${schemeId}`),

  /** POST /v1/schemes/eligible — schemes the authenticated farmer qualifies for */
  eligible: () => api.post<EligibleSchemesResponse>('/schemes/eligible'),

  /** POST /v1/schemes/:id/check — per-scheme eligibility with LLM explanation */
  check: (schemeId: string, language = 'ta') =>
    api.post<EligibilityResultOut>(`/schemes/${schemeId}/check`, { language }),

  /** POST /v1/schemes/chat — Tamil-first conversational scheme advisor */
  chat: (body: SchemeChatRequest) =>
    api.post<SchemeChatResponse>('/schemes/chat', body),
}
