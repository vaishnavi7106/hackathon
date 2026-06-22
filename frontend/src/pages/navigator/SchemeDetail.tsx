import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { SchemeDetailSkeleton } from '@/components/ui/Skeleton'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ChatFAB } from '@/components/chat/ChatFAB'
import { BottomNav } from '@/components/layout/BottomNav'
import type { GovernmentSchemeOut, EligibilityResultOut } from '@/types/api'
import { cn } from '@/lib/utils'

export default function SchemeDetail() {
  const { schemeId } = useParams<{ schemeId: string }>()
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const { lang, toggleLang, isSaved, saveScheme, unsaveScheme, isApplied, markApplied, toggleDoc, isDocChecked, getCheckedDocs } = useSchemeStore()

  const [detail, setDetail] = useState<GovernmentSchemeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<EligibilityResultOut | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  function handleSave() {
    if (!schemeId) return
    if (isSaved(schemeId)) {
      unsaveScheme(schemeId)
      showToast(lang === 'ta' ? 'நீக்கப்பட்டது' : 'Removed')
    } else {
      saveScheme(schemeId)
      showToast(lang === 'ta' ? 'சேமிக்கப்பட்டது ✓' : 'Saved ✓')
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    if (!schemeId) return
    load()
  }, [schemeId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const d = await schemesApi.getById(schemeId!)
      setDetail(d)
    } catch {
      setError('திட்ட விவரங்கள் ஏற்றுவதில் பிழை.')
    } finally {
      setLoading(false)
    }
  }

  async function runCheck() {
    if (!schemeId) return
    setCheckLoading(true)
    try {
      const r = await schemesApi.check(schemeId, lang)
      setCheckResult(r)
    } catch {
      setCheckResult(null)
    } finally {
      setCheckLoading(false)
    }
  }

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const docs = detail
    ? (lang === 'ta' ? detail.documents_ta || detail.documents_required : detail.documents_required) || []
    : []
  const checkedDocs = schemeId ? getCheckedDocs(schemeId) : []
  const docsChecked = docs.filter((d) => checkedDocs.includes(d)).length
  const saved = schemeId ? isSaved(schemeId) : false
  const applied = schemeId ? isApplied(schemeId) : false

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
    <div className="w-full max-w-[480px] flex flex-col min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-600 p-1 -ml-1 text-lg"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="flex-1 font-semibold text-gray-900 text-sm truncate min-w-0">
          {detail ? (lang === 'ta' ? detail.name_ta : detail.name_en) : t('திட்ட விவரங்கள்', 'Scheme Details')}
        </h1>
        {/* Save button in TopBar */}
        <button
          onClick={handleSave}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center border text-base transition-colors shrink-0',
            saved
              ? 'bg-saffron-100 border-saffron-400 text-saffron-600'
              : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-saffron-300 hover:text-saffron-500',
          )}
          aria-label={saved ? t('சேமிப்பிலிருந்து நீக்கு', 'Remove') : t('சேமி', 'Save')}
        >
          🔖
        </button>
        <button
          onClick={toggleLang}
          className="text-xs border border-primary-400 text-primary-700 rounded-full px-3 py-1 bg-primary-50 shrink-0"
        >
          {lang === 'ta' ? 'En' : 'த'}
        </button>
      </header>

      {loading && <SchemeDetailSkeleton />}

      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <ErrorMessage messageTa={error} onRetry={load} />
        </div>
      )}

      {!loading && !error && detail && (
        <>
          {/* Hero strip */}
          <div className="bg-primary-900 text-white px-4 pt-5 pb-6">
            <span className={cn(
              'inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2',
              detail.level === 'central'
                ? 'bg-indigo-200 text-indigo-900'
                : 'bg-emerald-200 text-emerald-900',
            )}>
              {detail.level === 'central' ? t('மத்திய திட்டம்', 'Central Scheme') : t('மாநில திட்டம்', 'State Scheme')}
            </span>
            <h2 className="font-bold text-xl leading-snug">
              {lang === 'ta' ? detail.name_ta : (detail.name_en || detail.name_ta)}
            </h2>
            {(detail.department_ta || detail.department_en) && (
              <p className="text-primary-300 text-xs mt-1">
                {lang === 'ta' ? detail.department_ta : (detail.department_en || detail.department_ta)}
              </p>
            )}
            {applied && (
              <div className="mt-3 bg-primary-700 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-primary-300 text-sm">✓</span>
                <span className="text-primary-100 text-xs font-semibold">{t('விண்ணப்பித்தது', 'You have applied')}</span>
              </div>
            )}
          </div>

          <div className="px-4 pb-36 space-y-3 pt-4">
            {/* Benefit */}
            {detail.benefit_amount && (
              <div className="rounded-2xl bg-saffron-50 border border-saffron-200 p-4">
                <p className="text-xs text-saffron-700 font-semibold uppercase tracking-wide mb-1">
                  {t('நலன்', 'Benefit')}
                </p>
                <p className="text-saffron-900 font-bold text-xl">
                  {lang === 'ta' ? (detail.benefit_amount_ta ?? detail.benefit_amount) : detail.benefit_amount}
                </p>
              </div>
            )}

            {/* Description */}
            {(detail.description_ta || detail.description_en) && (
              <div className="card p-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">{t('விளக்கம்', 'Description')}</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {lang === 'ta'
                    ? detail.description_ta
                    : (detail.description_en || detail.description_ta)}
                </p>
              </div>
            )}

            {/* Eligibility */}
            {(detail.eligibility_ta || detail.eligibility_en) && (
              <div className="card p-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">{t('தகுதி நிபந்தனைகள்', 'Eligibility Criteria')}</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {lang === 'ta' ? detail.eligibility_ta : (detail.eligibility_en || detail.eligibility_ta)}
                </p>
              </div>
            )}

            {/* Application info */}
            {(detail.application_mode || detail.application_portal_name || detail.application_process_summary) && (
              <div className="card p-4 space-y-3">
                <p className="text-xs text-gray-500 font-semibold">{t('விண்ணப்பிக்கும் முறை', 'How to Apply')}</p>

                {detail.application_mode && (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-semibold px-3 py-1 rounded-full',
                      detail.application_mode === 'HYBRID'
                        ? 'bg-primary-100 text-primary-800'
                        : 'bg-gray-100 text-gray-700',
                    )}>
                      {detail.application_mode === 'HYBRID'
                        ? t('🌐 ஆன்லைன் / நேரில்', '🌐 Online / In-person')
                        : t('🏢 நேரில் மட்டும்', '🏢 In-person only')}
                    </span>
                  </div>
                )}

                {detail.application_portal_name && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t('போர்டல்', 'Portal')}</p>
                    <p className="text-sm text-gray-800 font-medium">{detail.application_portal_name}</p>
                  </div>
                )}

                {detail.application_process_summary && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t('செயல்முறை', 'Process')}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{detail.application_process_summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* Deadline */}
            {detail.application_deadline && (
              <div className={cn(
                'card p-4 flex items-center gap-3',
                detail.deadline_urgent && 'border-orange-200 bg-orange-50',
              )}>
                <span className="text-2xl">{detail.deadline_urgent ? '⏰' : '📅'}</span>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">{t('கடைசி தேதி', 'Application Deadline')}</p>
                  <p className={cn('text-sm font-bold', detail.deadline_urgent ? 'text-orange-700' : 'text-gray-800')}>
                    {detail.application_deadline}
                  </p>
                </div>
              </div>
            )}

            {/* Eligibility check */}
            <div className="card p-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">{t('தகுதி சரிபார்ப்பு', 'Eligibility Check')}</p>
              {!checkResult ? (
                <button
                  onClick={runCheck}
                  disabled={checkLoading}
                  className="btn-primary text-sm w-full py-3"
                >
                  {checkLoading ? t('சரிபார்க்கிறது…', 'Checking…') : t('இப்போது சரிபார்', 'Check Now')}
                </button>
              ) : (
                <div>
                  <div className={cn(
                    'rounded-xl px-4 py-3 mb-2',
                    checkResult.is_eligible
                      ? 'bg-primary-50 border border-primary-200'
                      : 'bg-red-50 border border-red-200',
                  )}>
                    <p className={cn('font-semibold text-sm', checkResult.is_eligible ? 'text-primary-800' : 'text-red-800')}>
                      {checkResult.is_eligible
                        ? t('✓ நீங்கள் தகுதியுள்ளவர்!', '✓ You are eligible!')
                        : t('✗ தகுதியில்லை', '✗ Not eligible')}
                    </p>
                    {checkResult.llm_response && (
                      <p className="text-gray-700 text-xs mt-2 leading-relaxed">{checkResult.llm_response}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setCheckResult(null)}
                    className="text-xs text-gray-400 underline"
                  >
                    {t('மீண்டும் சரிபார்', 'Check again')}
                  </button>
                </div>
              )}
            </div>

            {/* Document checklist */}
            {docs.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 font-semibold">{t('தேவையான ஆவணங்கள்', 'Required Documents')}</p>
                  <span className="text-xs font-semibold text-primary-700">{docsChecked}/{docs.length}</span>
                </div>
                <div className="space-y-2">
                  {docs.map((doc) => {
                    const checked = isDocChecked(detail.scheme_id, doc)
                    return (
                      <button
                        key={doc}
                        onClick={() => toggleDoc(detail.scheme_id, doc)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors',
                          checked
                            ? 'bg-primary-50 border-primary-200 text-primary-800'
                            : 'bg-gray-50 border-gray-200 text-gray-700',
                        )}
                      >
                        <span className={cn(
                          'w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0',
                          checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-400',
                        )}>
                          {checked && '✓'}
                        </span>
                        <span className="text-sm">{doc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Year / Source */}
            {(detail.year || detail.source_url) && (
              <div className="card p-4 space-y-1">
                {detail.year && (
                  <p className="text-xs text-gray-500">{t('திட்டம் தொடங்கிய ஆண்டு:', 'Launched:')} <span className="text-gray-700 font-medium">{detail.year}</span></p>
                )}
                {detail.source_url && (
                  <p className="text-xs text-gray-500">
                    {t('ஆதாரம்:', 'Source:')} <a href={detail.source_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">{detail.source_url}</a>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Chat FAB — sits above action bar + BottomNav */}
          <ChatFAB bottomOffset={144} />

          {/* Sticky bottom bar — sits above BottomNav (bottom-14 = 56px) */}
          <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-4 py-3 flex gap-3 z-40">
            {detail.application_url ? (
              <a
                href={detail.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-primary text-sm text-center py-3"
              >
                {t('விண்ணப்பிக்கவும்', 'Apply Now')} →
              </a>
            ) : (
              <button className="flex-1 btn-primary text-sm py-3 opacity-70" disabled>
                {t('மாவட்ட அலுவலகத்தில் விண்ணப்பிக்கவும்', 'Apply at District Office')}
              </button>
            )}
            {!applied && (
              <button
                onClick={() => markApplied(detail.scheme_id)}
                className="flex-1 btn-secondary text-sm py-3"
              >
                {t('விண்ணப்பித்தது என்று குறி', 'Mark as Applied')}
              </button>
            )}
          </div>
        </>
      )}
      <BottomNav />
    </div>
    </div>
  )
}
