import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { schemesApi } from '@/api/schemes'

// Mock the store so api.get/post can read token
vi.mock('@/store/farmerStore', () => ({
  useFarmerStore: {
    getState: () => ({ token: 'test-token' }),
  },
}))

const mockFetch = vi.fn()
beforeEach(() => {
  mockFetch.mockClear()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function mockResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

describe('schemesApi.list', () => {
  it('calls GET /v1/schemes without level param', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse({ total: 2, schemes: [] }),
    )
    const res = await schemesApi.list()
    expect(res.total).toBe(2)
    expect(mockFetch).toHaveBeenCalledWith(
      '/v1/schemes',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('appends ?level=central when specified', async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ total: 1, schemes: [] }))
    await schemesApi.list('central')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('/v1/schemes?level=central')
  })
})

describe('schemesApi.eligible', () => {
  it('calls POST /v1/schemes/eligible', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse({ eligible_count: 3, schemes: [], deadline_alerts: [] }),
    )
    const res = await schemesApi.eligible()
    expect(res.eligible_count).toBe(3)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/v1/schemes/eligible')
    expect(opts.method).toBe('POST')
  })
})

describe('schemesApi.check', () => {
  it('calls POST /v1/schemes/:id/check with language=ta', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse({ result_id: 'r1', is_eligible: true, criteria_results: [], llm_response: null }),
    )
    const res = await schemesApi.check('pm-kisan')
    expect(res.is_eligible).toBe(true)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('/v1/schemes/pm-kisan/check')
  })
})

describe('schemesApi.chat', () => {
  it('calls POST /v1/schemes/chat', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse({ conversation_id: 'c1', response_ta: 'பதில்', eligible_scheme_ids: [], deadline_alerts: [], latency_ms: 100 }),
    )
    const res = await schemesApi.chat({ message: 'என் பயிர்', language: 'ta' })
    expect(res.response_ta).toBe('பதில்')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('/v1/schemes/chat')
  })
})
