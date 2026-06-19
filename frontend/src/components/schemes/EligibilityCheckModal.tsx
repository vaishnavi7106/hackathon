import { useState } from 'react'
import type { EligibilityResultOut, EligibleSchemeOut } from '@/types/api'
import { schemesApi } from '@/api/schemes'
import { Button } from '@/components/ui/Button'

interface Props {
  scheme: EligibleSchemeOut
  onClose: () => void
}

export function EligibilityCheckModal({ scheme, onClose }: Props) {
  const [result, setResult] = useState<EligibilityResultOut | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheck() {
    setLoading(true)
    setError(null)
    try {
      const data = await schemesApi.check(scheme.scheme_id)
      setResult(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ஏதோ தவறு நடந்தது'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-base">தகுதி சரிபார்ப்பு</h2>
          <button onClick={onClose} className="text-gray-500 text-xl" aria-label="Close">✕</button>
        </div>

        <p className="text-gray-700 text-sm">{scheme.name_ta}</p>

        {!result && !loading && !error && (
          <Button onClick={handleCheck} fullWidth>
            இப்போது சரிபார்க்கவும்
          </Button>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <div className="dot-flashing" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-red-700 text-sm">{error}</p>
            <Button variant="ghost" className="mt-2 text-xs" onClick={handleCheck}>
              மீண்டும் முயற்சி
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-xl px-4 py-3 ${result.is_eligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-semibold text-sm ${result.is_eligible ? 'text-green-800' : 'text-red-800'}`}>
                {result.is_eligible ? '✓ நீங்கள் தகுதியுள்ளவர்!' : '✗ தகுதியில்லை'}
              </p>
            </div>

            {result.criteria_results && result.criteria_results.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-700 text-xs font-semibold">நிபந்தனைகள்:</p>
                {result.criteria_results.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={c.met ? 'text-green-600' : 'text-red-500'}>{c.met ? '✓' : '✗'}</span>
                    <span className="text-gray-700 text-xs">{c.criterion_ta || c.criterion}</span>
                  </div>
                ))}
              </div>
            )}

            {result.llm_response && (
              <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
                <p className="text-primary-900 text-sm leading-relaxed">{result.llm_response}</p>
              </div>
            )}

            {result.application_url && (
              <a
                href={result.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full text-center text-sm block"
              >
                விண்ணப்பிக்கவும் →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
