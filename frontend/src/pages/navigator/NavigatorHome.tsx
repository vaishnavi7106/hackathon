import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { syncProfileToBackend } from '@/api/farmer'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { SchemeCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { BottomNav } from '@/components/layout/BottomNav'
import { ChatFAB } from '@/components/chat/ChatFAB'
import type { EligibleSchemeOut } from '@/types/api'
import { cn } from '@/lib/utils'

type LevelFilter = 'all' | 'central' | 'state'

export default function NavigatorHome() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const clearAuth = useFarmerStore((s) => s.clearAuth)
  const profile = useFarmerStore((s) => s.profile)
  const { lang, toggleLang, savedIds, appliedIds, saveScheme, unsaveScheme, isSaved } = useSchemeStore()
  const localProfile = useProfileStore((s) => s.profile)
  const resetProfile = useProfileStore((s) => s.resetProfile)

  // All schemes
  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Eligible schemes (only fetched when profile exists)
  const [eligibleSchemes, setEligibleSchemes] = useState<EligibleSchemeOut[]>([])
  const [nmiSchemes, setNmiSchemes] = useState<EligibleSchemeOut[]>([])
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [showAllEligible, setShowAllEligible] = useState(false)

  // Filter state
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    load()
    if (profile) loadEligible()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await schemesApi.list()
      setSchemes(res.schemes)
    } catch {
      setError(t('திட்டங்கள் ஏற்றுவதில் பிழை. மீண்டும் முயற்சிக்கவும்.', 'Error loading schemes. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadEligible() {
    setEligibleLoading(true)
    try {
      try { await syncProfileToBackend(localProfile) } catch { /* best-effort */ }
      const res = await schemesApi.eligible()
      setEligibleSchemes(res.schemes)
      setNmiSchemes(res.needs_more_info_schemes ?? [])
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 401) {
        resetProfile()
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      setEligibleSchemes([])
      setNmiSchemes([])
    } finally {
      setEligibleLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleSave(schemeId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isSaved(schemeId)) {
      unsaveScheme(schemeId)
      showToast(t('நீக்கப்பட்டது', 'Removed'))
    } else {
      saveScheme(schemeId)
      showToast(t('சேமிக்கப்பட்டது ✓', 'Saved ✓'))
    }
  }

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const filteredSchemes = useMemo(() => {
    const q = search.toLowerCase()
    return schemes.filter((s) => {
      if (level !== 'all' && s.level !== level) return false
      if (!q) return true
      return (
        s.name_ta.includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        (s.department_ta || '').includes(q) ||
        (s.department_en || '').toLowerCase().includes(q)
      )
    })
  }, [schemes, search, level])

  const visibleEligible = showAllEligible ? eligibleSchemes : eligibleSchemes.slice(0, 3)
  const primaryCrop = profile?.crops?.[0]?.crop

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ backgroundColor: '#F9FAFB' }}>
    <div className="w-full max-w-[480px] flex flex-col min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg transition-opacity">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 px-4 pt-3 pb-3 text-white" style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-base text-white">{t('அரசு திட்ட வழிகாட்டி', 'Government Navigator')}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {t(`${schemes.length || 24} திட்டங்கள் கிடைக்கின்றன`, `${schemes.length || 24} schemes available`)}
            </p>
          </div>
          <button
            onClick={toggleLang}
            className="text-xs border rounded-full px-3 py-1 shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.15)' }}
          >
            {lang === 'ta' ? 'En' : 'த'}
          </button>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 mt-3">
          <Link
            to="/navigator/saved"
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-4 text-xs font-semibold transition-colors relative"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
          >
            <span>🔖</span>
            {t('சேமித்தது', 'Saved')}
            {savedIds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {savedIds.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Profile pill */}
      {profile && (profile.district || primaryCrop) && (
        <div className="bg-primary-50 border-b border-primary-100 px-4 py-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 text-xs text-primary-700 flex-wrap">
            {profile.district && <span>📍 {profile.district}</span>}
            {primaryCrop && <span>🌾 {primaryCrop}</span>}
            {profile.land_size_acres && <span>{profile.land_size_acres} {t('ஏக்கர்', 'ac')}</span>}
          </div>
          <Link to="/navigator/eligible" className="text-xs text-primary-700 font-semibold shrink-0 underline underline-offset-2">
            {t('திருத்து →', 'Edit →')}
          </Link>
        </div>
      )}

      <div className="flex-1 px-4 py-4 pb-28 space-y-4">

        {/* ── Eligible Schemes Section (when profile exists) ── */}
        {profile ? (
          <div>
            {eligibleLoading ? (
              <div className="space-y-3">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
                <SchemeCardSkeleton />
                <SchemeCardSkeleton />
              </div>
            ) : eligibleSchemes.length > 0 ? (
              <div className="space-y-2">
                {/* Section header */}
                <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-primary-600 text-sm">✓</span>
                    <span className="text-primary-800 text-sm font-semibold">
                      {t('உங்களுக்கான திட்டங்கள்', 'Schemes for you')}
                    </span>
                  </div>
                  <span className="text-xs bg-primary-600 text-white font-bold px-2 py-0.5 rounded-full">
                    {eligibleSchemes.length}
                  </span>
                </div>

                {visibleEligible.map((scheme) => (
                  <SchemeCard
                    key={scheme.scheme_id}
                    scheme={scheme}
                    lang={lang}
                    isSaved={isSaved(scheme.scheme_id)}
                    isApplied={appliedIds.includes(scheme.scheme_id)}
                    isEligible
                    onSave={handleSave}
                    onNavigate={() => navigate(`/navigator/${scheme.scheme_id}`)}
                  />
                ))}

                {eligibleSchemes.length > 3 && !showAllEligible && (
                  <button
                    onClick={() => setShowAllEligible(true)}
                    className="w-full text-center text-sm text-primary-600 font-semibold py-2 border border-primary-200 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors"
                  >
                    {t(`அனைத்தும் காண்க (${eligibleSchemes.length}) →`, `Show all ${eligibleSchemes.length} →`)}
                  </button>
                )}
              </div>
            ) : (
              /* No eligible found but profile exists */
              <div className="card p-4 border-orange-100 bg-orange-50 text-center space-y-2">
                <p className="text-orange-700 text-sm font-semibold">
                  {t('தகுதியான திட்டங்கள் கிடைக்கவில்லை', 'No eligible schemes found')}
                </p>
                <p className="text-orange-600 text-xs">
                  {t('சுயவிவரம் மேம்படுத்தினால் மேலும் திட்டங்கள் கிடைக்கலாம்.', 'Update your profile to find more schemes.')}
                </p>
                <Link to="/navigator/eligible" className="inline-block btn-primary text-xs px-4 py-2 mt-1">
                  {t('சுயவிவரம் மேம்படுத்து', 'Update Profile')}
                </Link>
              </div>
            )}

            {/* ── Needs More Info Banner ── */}
            {nmiSchemes.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 text-sm">⚠️</span>
                    <span className="text-amber-800 text-sm font-semibold">
                      {t('சுயவிவரம் பூர்த்தி செய்யவும்', 'Complete your profile')}
                    </span>
                  </div>
                  <span className="text-xs bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                    +{nmiSchemes.length}
                  </span>
                </div>
                <p className="text-amber-700 text-xs leading-relaxed">
                  {t(
                    `${nmiSchemes.length} திட்டங்களுக்கான தகுதியை சரிபார்க்க மேலும் தகவல்கள் தேவை.`,
                    `${nmiSchemes.length} more schemes need additional info to check eligibility.`,
                  )}
                </p>
                <Link
                  to="/navigator/eligible"
                  className="inline-block text-xs font-semibold text-amber-800 underline underline-offset-2"
                >
                  {t('சுயவிவரம் மேம்படுத்து →', 'Update profile →')}
                </Link>
              </div>
            )}

            {/* Divider */}
            {(eligibleSchemes.length > 0 || nmiSchemes.length > 0) && (
              <div className="flex items-center gap-2 mt-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{t('அனைத்து திட்டங்கள்', 'All Schemes')}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
          </div>
        ) : (
          /* ── No profile: onboarding card ── */
          <div className="card p-5 border-primary-100 bg-primary-50 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🎯</span>
              <div>
                <p className="text-gray-900 font-semibold text-sm">
                  {t('நீங்கள் தகுதியான திட்டங்களை கண்டுபிடிக்கவும்', 'Find schemes you qualify for')}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {t('சில கேள்விகளுக்கு பதிலளிக்கவும், தகுதியான திட்டங்கள் கிடைக்கும்.', 'Answer a few questions to see your eligible schemes.')}
                </p>
              </div>
            </div>
            <Link
              to="/navigator/eligible"
              className="block w-full btn-primary text-sm py-2.5 text-center"
            >
              {t('தகுதி சரிபார்க்க →', 'Check My Eligibility →')}
            </Link>
          </div>
        )}

        {/* ── Search + Filter (All Schemes) ── */}
        <div className="space-y-2.5">
          <input
            type="search"
            placeholder={t('திட்டங்களை தேடுங்கள்…', 'Search schemes…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
          />
          <div className="flex gap-2">
            {(['all', 'central', 'state'] as LevelFilter[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={cn(
                  'flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors',
                  level === l
                    ? 'bg-primary-700 text-white border-primary-700'
                    : 'bg-white text-gray-600 border-gray-300',
                )}
              >
                {l === 'all' ? t('அனைத்தும்', 'All') : l === 'central' ? t('மத்திய', 'Central') : t('மாநில', 'State')}
              </button>
            ))}
          </div>
        </div>

        {/* ── All Schemes List ── */}
        <div className="space-y-3">
          {loading && [1, 2, 3, 4].map((i) => <SchemeCardSkeleton key={i} />)}

          {!loading && error && <ErrorMessage messageTa={error} onRetry={load} />}

          {!loading && !error && filteredSchemes.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              {t('திட்டங்கள் இல்லை', 'No schemes found')}
            </div>
          )}

          {!loading && !error && filteredSchemes.map((scheme) => (
            <SchemeCard
              key={scheme.scheme_id}
              scheme={scheme}
              lang={lang}
              isSaved={isSaved(scheme.scheme_id)}
              isApplied={appliedIds.includes(scheme.scheme_id)}
              isEligible={eligibleSchemes.some((e) => e.scheme_id === scheme.scheme_id)}
              onSave={handleSave}
              onNavigate={() => navigate(`/navigator/${scheme.scheme_id}`)}
            />
          ))}
        </div>
      </div>

      {/* Floating Chat FAB */}
      <ChatFAB />
      <BottomNav />
    </div>
    </div>
  )
}

// ── Scheme Card ───────────────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  lang,
  isSaved,
  isApplied,
  isEligible,
  onSave,
  onNavigate,
}: {
  scheme: EligibleSchemeOut
  lang: 'ta' | 'en'
  isSaved: boolean
  isApplied: boolean
  isEligible: boolean
  onSave: (id: string, e: React.MouseEvent) => void
  onNavigate: () => void
}) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  return (
    <div
      onClick={onNavigate}
      className="card p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-snug">
            {lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)}
          </p>
          {(scheme.department_ta || scheme.department_en) && (
            <p className="text-gray-400 text-xs mt-0.5 truncate">
              {lang === 'ta' ? scheme.department_ta : (scheme.department_en || scheme.department_ta)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status badges */}
          <div className="flex flex-col items-end gap-1">
            {isApplied && (
              <span className="text-xs bg-primary-100 text-primary-800 font-semibold px-2 py-0.5 rounded-full">
                {t('விண்ணப்பித்தது', 'Applied')}
              </span>
            )}
            {scheme.level && (
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                scheme.level === 'central' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
              )}>
                {scheme.level === 'central' ? t('மத்திய', 'Central') : t('மாநில', 'State')}
              </span>
            )}
          </div>

          {/* Save button — 36×36 tap target */}
          <button
            onClick={(e) => onSave(scheme.scheme_id, e)}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center transition-colors border text-base',
              isSaved
                ? 'bg-saffron-100 border-saffron-400 text-saffron-600'
                : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-saffron-300 hover:text-saffron-500',
            )}
            aria-label={isSaved ? t('சேமிப்பிலிருந்து நீக்கு', 'Remove from saved') : t('சேமி', 'Save')}
          >
            🔖
          </button>
        </div>
      </div>

      {scheme.benefit_amount && (
        <p className="text-primary-700 text-xs font-semibold mt-2">
          {t('நலன்:', 'Benefit:')} {lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount}
        </p>
      )}

      {scheme.deadline_urgent && scheme.application_deadline && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-orange-500 text-xs">⏰</span>
          <span className="text-orange-700 text-xs font-medium">
            {t('கடைசி தேதி:', 'Deadline:')} {scheme.application_deadline}
          </span>
        </div>
      )}

      {scheme.application_mode && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            scheme.application_mode === 'HYBRID'
              ? 'bg-primary-50 text-primary-700'
              : 'bg-gray-100 text-gray-600',
          )}>
            {scheme.application_mode === 'HYBRID'
              ? t('🌐 ஆன்லைன் / நேரில்', '🌐 Online / In-person')
              : t('🏢 நேரில் மட்டும்', '🏢 In-person only')}
          </span>
          {isEligible && (
            <span className="text-xs text-primary-600 font-medium">✓ {t('தகுதி', 'Eligible')}</span>
          )}
        </div>
      )}
    </div>
  )
}
