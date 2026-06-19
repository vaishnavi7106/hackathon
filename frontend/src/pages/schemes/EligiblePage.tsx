import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import type { EligibleSchemeOut, DeadlineAlert } from '@/types/api'
import { useFarmerStore } from '@/store/farmerStore'
import { SchemeCard } from '@/components/schemes/SchemeCard'
import { EligibilityCheckModal } from '@/components/schemes/EligibilityCheckModal'
import { DeadlineAlerts } from '@/components/schemes/DeadlineAlert'
import { SchemeCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { PageLayout } from '@/components/layout/Layout'

export default function EligiblePage() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const [eligible, setEligible] = useState<EligibleSchemeOut[]>([])
  const [deadlines, setDeadlines] = useState<DeadlineAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkScheme, setCheckScheme] = useState<EligibleSchemeOut | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { replace: true })
      return
    }
    fetchEligible()
  }, [])

  async function fetchEligible() {
    setLoading(true)
    setError(null)
    try {
      const res = await schemesApi.eligible()
      setEligible(res.schemes)
      setDeadlines(res.deadline_alerts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'தகுதியான திட்டங்கள் ஏற்ற முடியவில்லை')
    } finally {
      setLoading(false)
    }
  }

  const eligibleSchemes = eligible.filter((s) => s.is_eligible)
  const needsInfo = eligible.filter((s) => !s.is_eligible && s.missing_criteria.length > 0)
  const notEligible = eligible.filter((s) => !s.is_eligible && s.missing_criteria.length === 0)

  return (
    <PageLayout title="தகுதி சரிபார்ப்பு">
      <div className="px-4 py-4 space-y-4">
        {loading && Array.from({ length: 4 }).map((_, i) => <SchemeCardSkeleton key={i} />)}
        {error && <ErrorMessage messageTa={error} onRetry={fetchEligible} />}

        {!loading && !error && (
          <>
            <DeadlineAlerts alerts={deadlines} />

            {eligible.length === 0 ? (
              <EmptyState
                icon="✅"
                titleTa="தகுதி தகவல் இல்லை"
                descTa="உங்கள் சுயவிவரத்தை முழுமைப்படுத்தினால் சரியான திட்டங்கள் கிடைக்கும்"
              />
            ) : (
              <>
                {eligibleSchemes.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                      <span>✓</span> தகுதியுள்ள திட்டங்கள் ({eligibleSchemes.length})
                    </h2>
                    {eligibleSchemes.map((s) => (
                      <SchemeCard key={s.scheme_id} scheme={s} showEligibility onCheckEligibility={setCheckScheme} />
                    ))}
                  </section>
                )}

                {needsInfo.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-yellow-700 flex items-center gap-1.5">
                      <span>!</span> கூடுதல் தகவல் தேவை ({needsInfo.length})
                    </h2>
                    {needsInfo.map((s) => (
                      <SchemeCard key={s.scheme_id} scheme={s} showEligibility onCheckEligibility={setCheckScheme} />
                    ))}
                  </section>
                )}

                {notEligible.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                      <span>✗</span> தகுதியில்லாத திட்டங்கள் ({notEligible.length})
                    </h2>
                    {notEligible.map((s) => (
                      <SchemeCard key={s.scheme_id} scheme={s} showEligibility />
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      {checkScheme && (
        <EligibilityCheckModal scheme={checkScheme} onClose={() => setCheckScheme(null)} />
      )}
    </PageLayout>
  )
}
