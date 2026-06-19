import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { syncProfileToBackend } from '@/api/farmer'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { SchemeCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { BottomNav } from '@/components/layout/BottomNav'
import { MissingFieldWarnings } from '@/components/profile/MissingFieldWarnings'
import { ProfileCompletionWidget } from '@/components/profile/ProfileCompletionWidget'
import type { EligibleSchemeOut, DeadlineAlert } from '@/types/api'
import { cn } from '@/lib/utils'

export default function EligibilityChecker() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const clearAuth = useFarmerStore((s) => s.clearAuth)
  const backendProfile = useFarmerStore((s) => s.profile)
  const { lang, toggleLang } = useSchemeStore()
  const { profile: localProfile, completionPct, resetProfile } = useProfileStore()

  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [nmiSchemes, setNmiSchemes] = useState<EligibleSchemeOut[]>([])
  const [alerts, setAlerts] = useState<DeadlineAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
  }, [])

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  async function check() {
    setLoading(true)
    setError(null)
    try {
      try { await syncProfileToBackend(localProfile) } catch { /* best-effort */ }
      const res = await schemesApi.eligible()
      setSchemes(res.schemes)
      setNmiSchemes(res.needs_more_info_schemes ?? [])
      setAlerts(res.deadline_alerts)
      setChecked(true)
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 401) {
        resetProfile()
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      setError(t('தகுதி சரிபார்க்கும்போது பிழை ஏற்பட்டது.', 'Error checking eligibility. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const urgentAlerts = alerts.filter((a) => a.urgent)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1 -ml-1 text-lg">←</button>
        <h1 className="flex-1 font-semibold text-gray-900 text-sm">{t('தகுதி சரிபார்ப்பு', 'Eligibility Check')}</h1>
        <button
          onClick={toggleLang}
          className="text-xs border border-primary-400 text-primary-700 rounded-full px-3 py-1 bg-primary-50"
        >
          {lang === 'ta' ? 'En' : 'த'}
        </button>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Profile completion widget */}
        {completionPct < 80 && (
          <ProfileCompletionWidget pct={completionPct} lang={lang} />
        )}

        {/* Profile summary (uses local profile with fallback to backend) */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <p className="text-xs text-primary-700 font-semibold mb-2">{t('உங்கள் விவரங்கள்', 'Your Profile')}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
            {(localProfile.district || backendProfile?.district) && (
              <span>📍 {localProfile.district || backendProfile?.district}</span>
            )}
            {(localProfile.landSizeAcres || backendProfile?.land_size_acres) && (
              <span>📐 {localProfile.landSizeAcres || backendProfile?.land_size_acres} {t('ஏக்கர்', 'ac')}</span>
            )}
            {localProfile.primaryCrop && <span>🌾 {localProfile.primaryCrop}</span>}
            {(localProfile.aadhaarLinked ?? backendProfile?.aadhaar_linked) && (
              <span className="text-primary-700">✓ {t('ஆதார்', 'Aadhaar')}</span>
            )}
            {localProfile.incomeBand && <span>💰 {localProfile.incomeBand}</span>}
            {localProfile.landOwnership && <span>🏡 {localProfile.landOwnership}</span>}
          </div>
        </div>

        {/* Missing field warnings */}
        <MissingFieldWarnings lang={lang} />

        {/* Check button */}
        {!checked && !loading && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-5xl">🔍</div>
            <p className="text-gray-700 text-sm">
              {t('உங்கள் சுயவிவரத்தின் அடிப்படையில் தகுதியான திட்டங்களை கண்டுபிடிக்க கீழே அழுத்துங்கள்.',
                'Press below to find schemes you\'re eligible for based on your profile.')}
            </p>
            <button onClick={check} className="btn-primary w-full py-3">
              {t('தகுதியான திட்டங்கள் காட்டு', 'Show Eligible Schemes')}
            </button>
          </div>
        )}

        {loading && [1, 2, 3].map((i) => <SchemeCardSkeleton key={i} />)}

        {!loading && error && <ErrorMessage messageTa={error} onRetry={check} />}

        {/* Deadline alerts */}
        {urgentAlerts.length > 0 && (
          <div className="space-y-2">
            {urgentAlerts.map((a) => (
              <div key={a.scheme_id} className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 flex gap-2 items-start">
                <span className="text-orange-500 shrink-0">⏰</span>
                <p className="text-orange-800 text-xs">
                  <span className="font-semibold">{a.name_ta}</span> — {t('கடைசி தேதி:', 'Deadline:')} {a.deadline} ({a.days_remaining} {t('நாட்கள்', 'days')})
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {checked && !loading && !error && schemes.length === 0 && (
          <EmptyState
            icon="😔"
            titleTa={t('தகுதியான திட்டங்கள் இல்லை', 'No eligible schemes found')}
            descTa={t('உங்கள் சுயவிவரத்தை முழுமைப்படுத்தி மீண்டும் முயற்சிக்கவும்.',
              'Complete your profile and try again.')}
          />
        )}

        {checked && !loading && schemes.map((scheme) => (
          <Link
            key={scheme.scheme_id}
            to={`/navigator/${scheme.scheme_id}`}
            className="block card p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">
                  {lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)}
                </p>
                {(scheme.department_ta || scheme.department_en) && (
                  <p className="text-gray-400 text-xs mt-0.5 truncate">
                    {lang === 'ta' ? scheme.department_ta : (scheme.department_en || scheme.department_ta)}
                  </p>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                scheme.level === 'central' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
              )}>
                {scheme.level === 'central' ? t('மத்திய', 'Central') : t('மாநில', 'State')}
              </span>
            </div>
            {scheme.benefit_amount && (
              <p className="text-primary-700 text-xs font-semibold mt-2">{lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount}</p>
            )}
            <div className="mt-2 flex items-center gap-1 text-primary-600 text-xs font-medium">
              <span className="text-primary-500">✓</span>
              <span>{t('தகுதியுள்ளீர்கள்', 'You are eligible')}</span>
              <span className="ml-auto text-gray-400">→</span>
            </div>
          </Link>
        ))}

        {/* ── Needs More Info Section ── */}
        {checked && !loading && nmiSchemes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 h-px bg-amber-200" />
              <span className="text-xs text-amber-600 font-semibold whitespace-nowrap">
                ⚠️ {t('மேலும் தகவல் தேவை', 'Needs more info')}
              </span>
              <div className="flex-1 h-px bg-amber-200" />
            </div>
            <p className="text-xs text-amber-700 text-center">
              {t(
                'இந்த திட்டங்களுக்கான தகுதியை சரிபார்க்க சுயவிவரத்தை பூர்த்தி செய்யவும்.',
                'Complete your profile to check eligibility for these schemes.',
              )}
            </p>
            {nmiSchemes.map((scheme) => (
              <Link
                key={scheme.scheme_id}
                to={`/navigator/${scheme.scheme_id}`}
                className="block card p-4 border-amber-200 bg-amber-50 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)}
                    </p>
                    {(scheme.department_ta || scheme.department_en) && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {lang === 'ta' ? scheme.department_ta : (scheme.department_en || scheme.department_ta)}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    scheme.level === 'central' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
                  )}>
                    {scheme.level === 'central' ? t('மத்திய', 'Central') : t('மாநில', 'State')}
                  </span>
                </div>
                {scheme.benefit_amount && (
                  <p className="text-primary-700 text-xs font-semibold mt-2">{lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount}</p>
                )}
                <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs font-medium">
                  <span>⚠️</span>
                  <span>{t('சுயவிவரம் முழுமையடையவில்லை', 'Profile incomplete')}</span>
                  <span className="ml-auto text-gray-400">→</span>
                </div>
              </Link>
            ))}
            <Link
              to="/navigator/eligible"
              className="block w-full text-center btn-secondary text-sm py-2.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
            >
              {t('சுயவிவரம் மேம்படுத்து →', 'Update profile →')}
            </Link>
          </div>
        )}

        {checked && !loading && (schemes.length > 0 || nmiSchemes.length > 0) && (
          <button onClick={check} className="w-full btn-secondary text-sm py-2.5 mt-2">
            {t('மீண்டும் சரிபார்', 'Check Again')}
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
