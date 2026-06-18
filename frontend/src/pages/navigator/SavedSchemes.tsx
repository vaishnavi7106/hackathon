import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { SchemeCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { BottomNav } from '@/components/layout/BottomNav'
import type { EligibleSchemeOut } from '@/types/api'
import { cn } from '@/lib/utils'

export default function SavedSchemes() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const { lang, toggleLang, savedIds, unsaveScheme, isApplied } = useSchemeStore()

  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    if (savedIds.length > 0) load()
  }, [savedIds.length])

  async function load() {
    setLoading(true)
    try {
      const res = await schemesApi.list()
      setSchemes(res.schemes.filter((s) => savedIds.includes(s.scheme_id)))
    } catch {
      setSchemes([])
    } finally {
      setLoading(false)
    }
  }

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1 -ml-1 text-lg">←</button>
        <h1 className="flex-1 font-semibold text-gray-900 text-sm">
          {t('சேமித்த திட்டங்கள்', 'Saved Schemes')}
          {savedIds.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({savedIds.length})</span>
          )}
        </h1>
        <button
          onClick={toggleLang}
          className="text-xs border border-primary-400 text-primary-700 rounded-full px-3 py-1 bg-primary-50"
        >
          {lang === 'ta' ? 'En' : 'த'}
        </button>
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading && [1, 2].map((i) => <SchemeCardSkeleton key={i} />)}

        {!loading && savedIds.length === 0 && (
          <EmptyState
            icon="🔖"
            titleTa={t('சேமித்த திட்டங்கள் இல்லை', 'No saved schemes')}
            descTa={t('திட்ட விவரத்தில் 🔖 அழுத்தி சேமிக்கவும்.', 'Tap 🔖 on any scheme to save it.')}
            action={
              <Link to="/navigator" className="btn-primary text-sm px-4 py-2">
                {t('திட்டங்கள் காண்க', 'Browse Schemes')}
              </Link>
            }
          />
        )}

        {!loading && schemes.map((scheme) => {
          const applied = isApplied(scheme.scheme_id)
          return (
            <div key={scheme.scheme_id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/navigator/${scheme.scheme_id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)}
                  </p>
                  {(scheme.department_ta || scheme.department_en) && (
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{lang === 'ta' ? scheme.department_ta : (scheme.department_en || scheme.department_ta)}</p>
                  )}
                  {scheme.benefit_amount && (
                    <p className="text-primary-700 text-xs font-semibold mt-1">{lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount}</p>
                  )}
                  {applied && (
                    <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-800 font-semibold px-2 py-0.5 rounded-full">
                      {t('விண்ணப்பித்தது', 'Applied')}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => unsaveScheme(scheme.scheme_id)}
                  className={cn(
                    'p-1.5 rounded-full text-saffron-500 hover:bg-saffron-50 transition-colors shrink-0',
                  )}
                  aria-label="Remove from saved"
                >
                  🔖
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <BottomNav />
    </div>
  )
}
