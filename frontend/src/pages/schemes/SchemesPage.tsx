import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import type { EligibleSchemeOut } from '@/types/api'
import { useFarmerStore } from '@/store/farmerStore'
import { SchemeCard } from '@/components/schemes/SchemeCard'
import { SchemeFilterBar } from '@/components/schemes/SchemeFilterBar'
import { EligibilityCheckModal } from '@/components/schemes/EligibilityCheckModal'
import { SchemeCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { PageLayout } from '@/components/layout/Layout'

type LevelFilter = 'all' | 'central' | 'state'

export default function SchemesPage() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [checkScheme, setCheckScheme] = useState<EligibleSchemeOut | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { replace: true })
      return
    }
    fetchSchemes()
  }, [level])

  async function fetchSchemes() {
    setLoading(true)
    setError(null)
    try {
      const res = await schemesApi.list(level === 'all' ? undefined : level)
      setSchemes(res.schemes as EligibleSchemeOut[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'திட்டங்கள் ஏற்ற முடியவில்லை'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return schemes
    const q = search.toLowerCase()
    return schemes.filter(
      (s) =>
        s.name_ta.toLowerCase().includes(q) ||
        (s.name_en?.toLowerCase() || '').includes(q) ||
        (s.benefit_ta?.toLowerCase() || '').includes(q),
    )
  }, [schemes, search])

  return (
    <PageLayout title="அரசு திட்டங்கள்">
      <SchemeFilterBar
        search={search}
        onSearchChange={setSearch}
        level={level}
        onLevelChange={(v) => setLevel(v as LevelFilter)}
      />

      <div className="px-4 py-4 space-y-3">
        {loading && Array.from({ length: 5 }).map((_, i) => <SchemeCardSkeleton key={i} />)}

        {error && <ErrorMessage messageTa={error} onRetry={fetchSchemes} />}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon="🔍"
            titleTa="திட்டங்கள் எதுவும் இல்லை"
            descTa={search ? 'வேறு வார்த்தைகளில் தேடவும்' : 'தேர்ந்தெடுத்த வகையில் திட்டங்கள் இல்லை'}
          />
        )}

        {!loading && !error && filtered.map((scheme) => (
          <SchemeCard
            key={scheme.scheme_id}
            scheme={scheme}
            onCheckEligibility={isLoggedIn() ? setCheckScheme : undefined}
          />
        ))}
      </div>

      {checkScheme && (
        <EligibilityCheckModal scheme={checkScheme} onClose={() => setCheckScheme(null)} />
      )}
    </PageLayout>
  )
}
