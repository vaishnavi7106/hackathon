import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import type { GovernmentSchemeOut } from '@/types/api'
import { LevelBadge } from '@/components/ui/Badge'
import { SchemeDetailSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { PageLayout } from '@/components/layout/Layout'
import { EligibilityCheckModal } from '@/components/schemes/EligibilityCheckModal'
import { formatDate, isUrl } from '@/lib/utils'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}

function ArrayRow({ label, items }: { label: string; items: string[] | null | undefined }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
            <span className="text-primary-600 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function SchemeDetailPage() {
  const { schemeId } = useParams<{ schemeId: string }>()
  const navigate = useNavigate()
  const [scheme, setScheme] = useState<GovernmentSchemeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCheck, setShowCheck] = useState(false)

  useEffect(() => {
    if (!schemeId) return
    fetchScheme()
  }, [schemeId])

  async function fetchScheme() {
    setLoading(true)
    setError(null)
    try {
      const data = await schemesApi.getById(schemeId!)
      setScheme(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'திட்ட விவரங்கள் கிடைக்கவில்லை')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout title={scheme?.name_ta || 'திட்ட விவரங்கள்'} showBack>
      <div className="px-4 py-4 space-y-4">
        {loading && <SchemeDetailSkeleton />}
        {error && <ErrorMessage messageTa={error} onRetry={fetchScheme} />}

        {scheme && (
          <>
            <div className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900 text-base leading-snug">{scheme.name_ta}</h2>
                  {scheme.name_en && <p className="text-gray-500 text-xs mt-0.5">{scheme.name_en}</p>}
                </div>
                <LevelBadge level={scheme.level} />
              </div>
              {scheme.scheme_code && (
                <p className="text-xs text-gray-400">குறியீடு: {scheme.scheme_code}</p>
              )}
            </div>

            {(scheme.description_ta || scheme.description_en) && (
              <div className="card p-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">விளக்கம்</h3>
                {scheme.description_ta && <p className="text-sm text-gray-800 leading-relaxed">{scheme.description_ta}</p>}
                {scheme.description_en && !scheme.description_ta && (
                  <p className="text-sm text-gray-800 leading-relaxed">{scheme.description_en}</p>
                )}
              </div>
            )}

            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">பலன்கள்</h3>
              <Row label="" value={scheme.benefit_ta || scheme.benefit_en} />
              {scheme.benefit_amount && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl px-3 py-2">
                  <p className="text-primary-800 text-sm font-semibold">{scheme.benefit_amount}</p>
                </div>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">தகுதி நிபந்தனைகள்</h3>
              <ArrayRow label="" items={scheme.eligibility_ta?.length ? scheme.eligibility_ta : scheme.eligibility_en} />
            </div>

            {scheme.documents_ta?.length && (
              <div className="card p-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">தேவையான ஆவணங்கள்</h3>
                <ArrayRow label="" items={scheme.documents_ta} />
              </div>
            )}

            <div className="card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">கூடுதல் விவரங்கள்</h3>
              <Row label="துறை" value={scheme.department_ta || scheme.department_en} />
              <Row label="விண்ணப்ப முறை" value={scheme.application_mode_ta || scheme.application_mode_en} />
              <Row label="கடைசி தேதி" value={formatDate(scheme.application_deadline)} />
              {scheme.year && <Row label="ஆண்டு" value={String(scheme.year)} />}
            </div>

            {scheme.source_url && isUrl(scheme.source_url) && (
              <a
                href={scheme.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block card p-4 text-primary-700 text-sm font-medium"
              >
                அதிகாரப்பூர்வ இணையதளம் →
              </a>
            )}

            <button
              onClick={() => setShowCheck(true)}
              className="btn-primary w-full text-sm py-3"
            >
              தகுதி சரிபார்க்கவும்
            </button>
          </>
        )}
      </div>

      {showCheck && scheme && (
        <EligibilityCheckModal
          scheme={{
            scheme_id: scheme.scheme_id,
            name_ta: scheme.name_ta,
            name_en: scheme.name_en,
            level: scheme.level,
            benefit_ta: scheme.benefit_ta,
            is_eligible: false,
            missing_criteria: [],
            match_score: 0,
          }}
          onClose={() => setShowCheck(false)}
        />
      )}
    </PageLayout>
  )
}
