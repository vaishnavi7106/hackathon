import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import type { EligibleSchemeOut, GovernmentSchemeOut, DeadlineAlert, EligibilityResultOut } from '@/types/api'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = 'chat' | 'list' | 'detail'
type Lang = 'ta' | 'en'

interface Msg {
  role: 'user' | 'bot'
  text: string
  schemeCount?: number
}

type AppStatus = 'none' | 'pending' | 'submitted' | 'approved' | 'paid'

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEME_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EF4444', '#06B6D4', '#84CC16', '#EC4899',
]

const t = (ta: string, en: string, lang: Lang) => lang === 'ta' ? ta : en

const QUICK_PROMPTS = (lang: Lang) => [
  { ta: 'எனக்கு என்ன திட்டங்கள் தகுதி?', en: 'What schemes am I eligible for?' },
  { ta: 'நெல்லுக்கு பயிர் காப்பீடு', en: 'Crop insurance for rice' },
  { ta: 'PM கிசான் திட்டம் விவரம்', en: 'PM Kisan scheme details' },
  { ta: 'கிசான் கடன் அட்டை எப்படி பெறுவது?', en: 'How to get Kisan Credit Card?' },
].map(p => lang === 'ta' ? p.ta : p.en)

const STATUS_STEPS: { key: AppStatus; ta: string; en: string }[] = [
  { key: 'pending', ta: 'நிலுவை', en: 'Pending' },
  { key: 'submitted', ta: 'சமர்ப்பிக்கப்பட்டது', en: 'Submitted' },
  { key: 'approved', ta: 'அங்கீகரிக்கப்பட்டது', en: 'Approved' },
  { key: 'paid', ta: 'பணம் பெறப்பட்டது', en: 'Payment Received' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({
  lang, onToggleLang, onBack, title
}: {
  lang: Lang
  onToggleLang: () => void
  onBack?: () => void
  title: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
      {onBack && (
        <button onClick={onBack} className="text-gray-500 text-lg w-7">←</button>
      )}
      <h1 className="flex-1 font-semibold text-gray-900 text-sm truncate">{title}</h1>
      <button
        onClick={onToggleLang}
        className="text-xs border border-primary-400 text-primary-700 rounded-full px-3 py-1 font-medium bg-primary-50 shrink-0"
      >
        {lang === 'ta' ? 'English' : 'தமிழ்'}
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GovernmentNavigator() {
  const navigate = useNavigate()
  const profile = useFarmerStore(s => s.profile)
  const isLoggedIn = useFarmerStore(s => s.isLoggedIn)

  const [screen, setScreen] = useState<Screen>('chat')
  const [lang, setLang] = useState<Lang>('ta')
  const [levelFilter, setLevelFilter] = useState<'all' | 'central' | 'state'>('all')

  // Chat state
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'bot',
    text: 'ta' === 'ta'
      ? 'வணக்கம்! நான் உங்கள் அரசு திட்ட ஆலோசகர். அரசு திட்டங்கள், கடன்கள், காப்பீடு பற்றி கேளுங்கள்.'
      : 'Hello! I am your government scheme advisor. Ask me about schemes, loans, and insurance.',
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [convId, setConvId] = useState<string | undefined>()
  const [eligibleIds, setEligibleIds] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scheme list state
  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [appliedSchemes, setAppliedSchemes] = useState<Set<string>>(new Set())

  // Scheme detail state
  const [detail, setDetail] = useState<GovernmentSchemeOut | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkResult, setCheckResult] = useState<EligibilityResultOut | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set())
  const [appStatus, setAppStatus] = useState<AppStatus>('none')
  const [deadlines, setDeadlines] = useState<DeadlineAlert[]>([])

  useEffect(() => {
    if (!isLoggedIn()) navigate('/login', { replace: true })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, chatLoading])

  // Update welcome message when lang changes
  useEffect(() => {
    setMsgs(prev => [{
      ...prev[0],
      text: lang === 'ta'
        ? 'வணக்கம்! நான் உங்கள் அரசு திட்ட ஆலோசகர். அரசு திட்டங்கள், கடன்கள், காப்பீடு பற்றி கேளுங்கள்.'
        : 'Hello! I am your government scheme advisor. Ask me about schemes, loans, and insurance.',
    }, ...prev.slice(1)])
  }, [lang])

  async function sendChat(text: string) {
    if (!text.trim() || chatLoading) return
    setMsgs(prev => [...prev, { role: 'user', text }])
    setInput('')
    setChatLoading(true)
    try {
      const res = await schemesApi.chat({ message: text, language: lang, conversation_id: convId })
      setConvId(res.conversation_id)
      setEligibleIds(res.eligible_scheme_ids)
      setDeadlines(res.deadline_alerts)
      setMsgs(prev => [...prev, {
        role: 'bot',
        text: res.response_ta,
        schemeCount: res.eligible_scheme_ids.length,
      }])
    } catch (e: unknown) {
      setMsgs(prev => [...prev, {
        role: 'bot',
        text: lang === 'ta'
          ? 'பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.'
          : 'Could not get a response. Please try again.',
      }])
    } finally {
      setChatLoading(false)
    }
  }

  async function openSchemeList() {
    setScreen('list')
    setListLoading(true)
    try {
      if (eligibleIds.length > 0) {
        const res = await schemesApi.eligible()
        setSchemes(res.schemes)
        setDeadlines(res.deadline_alerts)
      } else {
        const res = await schemesApi.list()
        setSchemes(res.schemes)
      }
    } catch {
      setSchemes([])
    } finally {
      setListLoading(false)
    }
  }

  async function openDetail(scheme: EligibleSchemeOut) {
    setScreen('detail')
    setDetail(null)
    setCheckResult(null)
    setCheckedDocs(new Set())
    setAppStatus(appliedSchemes.has(scheme.scheme_id) ? 'submitted' : 'none')
    setDetailLoading(true)
    try {
      const d = await schemesApi.getById(scheme.scheme_id)
      setDetail(d)
    } catch {
      setDetail(scheme as unknown as GovernmentSchemeOut)
    } finally {
      setDetailLoading(false)
    }
  }

  async function runEligibilityCheck() {
    if (!detail) return
    setCheckLoading(true)
    try {
      const r = await schemesApi.check(detail.scheme_id, lang)
      setCheckResult(r)
    } catch {
      setCheckResult(null)
    } finally {
      setCheckLoading(false)
    }
  }

  function markApplied(schemeId: string) {
    setAppliedSchemes(prev => new Set([...prev, schemeId]))
    setAppStatus('submitted')
  }

  const filteredSchemes = schemes.filter(s =>
    levelFilter === 'all' || s.level === levelFilter
  )
  const eligibleSchemes = eligibleIds.length > 0
    ? filteredSchemes.filter(s => eligibleIds.includes(s.scheme_id))
    : filteredSchemes
  const ineligibleSchemes = eligibleIds.length > 0
    ? filteredSchemes.filter(s => !eligibleIds.includes(s.scheme_id))
    : []

  const schemeColor = (idx: number) => SCHEME_COLORS[idx % SCHEME_COLORS.length]

  // ── Render: Chat ──────────────────────────────────────────────────────────

  if (screen === 'chat') {
    const lastBotMsg = [...msgs].reverse().find(m => m.role === 'bot')
    const showFloating = lastBotMsg?.schemeCount && lastBotMsg.schemeCount > 0

    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <Header
          lang={lang}
          onToggleLang={() => setLang(l => l === 'ta' ? 'en' : 'ta')}
          title={t('AI உதவியாளர் 🏛️', 'Scheme Advisor 🏛️', lang)}
        />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
          {/* Quick prompts shown only at start */}
          {msgs.length === 1 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-gray-400 text-center">
                {t('விரைவு கேள்விகள்', 'Quick prompts', lang)}
              </p>
              {QUICK_PROMPTS(lang).map((q) => (
                <button
                  key={q}
                  onClick={() => sendChat(q)}
                  className="w-full text-left text-xs border border-primary-200 text-primary-700 rounded-xl px-3 py-2.5 bg-white hover:bg-primary-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {msgs.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0 mt-1">🏛️</div>
              )}
              <div className={cn(
                'max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
              )}>
                {msg.text}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0">🏛️</div>
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Floating scheme count button */}
        {showFloating && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={openSchemeList}
              className="bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2"
            >
              <span>{lastBotMsg!.schemeCount} {t('தகுதியான திட்டங்கள்', 'Eligible Schemes', lang)}</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); sendChat(input) }}
          className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2"
        >
          <input
            className="input flex-1 text-sm"
            placeholder={t('தமிழில் கேளுங்கள்…', 'Ask in English or Tamil…', lang)}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={chatLoading}
          />
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"
            aria-label="Voice input"
          >
            🎤
          </button>
          <button
            type="submit"
            disabled={chatLoading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            ↑
          </button>
        </form>
      </div>
    )
  }

  // ── Render: Scheme List ───────────────────────────────────────────────────

  if (screen === 'list') {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <Header
          lang={lang}
          onToggleLang={() => setLang(l => l === 'ta' ? 'en' : 'ta')}
          onBack={() => setScreen('chat')}
          title={t('அரசு திட்டங்கள்', 'Government Schemes', lang)}
        />

        {/* Deadline alerts */}
        {deadlines.filter(d => d.urgent).map(d => (
          <div key={d.scheme_id} className="mx-4 mt-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex gap-2 items-start">
            <span className="text-orange-500 shrink-0">⏰</span>
            <p className="text-orange-800 text-xs">
              <span className="font-semibold">{d.name_ta}</span> — {t('கடைசி தேதி:', 'Deadline:', lang)} {formatDate(d.deadline.toString())} ({d.days_remaining} {t('நாட்கள்', 'days', lang)})
            </p>
          </div>
        ))}

        {/* Level filter */}
        <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-200">
          {(['all', 'central', 'state'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors',
                levelFilter === l
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300'
              )}
            >
              {l === 'all' ? t('அனைத்தும்', 'All', lang) : l === 'central' ? t('மத்திய', 'Central', lang) : t('மாநில', 'State', lang)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-6 space-y-3">
          {listLoading && [1, 2, 3, 4].map(i => (
            <div key={i} className="card p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}

          {!listLoading && eligibleSchemes.map((s, i) => (
            <SchemeCard
              key={s.scheme_id}
              scheme={s}
              color={schemeColor(i)}
              lang={lang}
              isApplied={appliedSchemes.has(s.scheme_id)}
              isEligible={true}
              onClick={() => openDetail(s)}
            />
          ))}

          {!listLoading && ineligibleSchemes.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{t('பிற திட்டங்கள்', 'Other schemes', lang)}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {ineligibleSchemes.map((s, i) => (
                <SchemeCard
                  key={s.scheme_id}
                  scheme={s}
                  color={schemeColor(eligibleSchemes.length + i)}
                  lang={lang}
                  isApplied={appliedSchemes.has(s.scheme_id)}
                  isEligible={false}
                  onClick={() => openDetail(s)}
                />
              ))}
            </>
          )}

          {!listLoading && eligibleSchemes.length === 0 && ineligibleSchemes.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              {t('திட்டங்கள் இல்லை', 'No schemes found', lang)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Scheme Detail ─────────────────────────────────────────────────

  const docs = detail
    ? (lang === 'ta' ? detail.documents_ta || detail.documents_required : detail.documents_required) || []
    : []
  const docsChecked = docs.filter(d => checkedDocs.has(d)).length
  const heroColor = schemeColor(schemes.findIndex(s => s.scheme_id === detail?.scheme_id))

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header
        lang={lang}
        onToggleLang={() => setLang(l => l === 'ta' ? 'en' : 'ta')}
        onBack={() => setScreen('list')}
        title={t('திட்ட விவரங்கள்', 'Scheme Details', lang)}
      />

      {detailLoading && (
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-16 bg-gray-200 rounded-2xl" />
          <div className="h-32 bg-gray-200 rounded-2xl" />
        </div>
      )}

      {!detailLoading && detail && (
        <>
          {/* Hero strip */}
          <div className="px-4 pt-4 pb-2">
            <div className="rounded-2xl p-5 text-white" style={{ background: heroColor }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs opacity-80 font-medium uppercase tracking-wide">
                    {detail.level === 'central' ? t('மத்திய திட்டம்', 'Central Scheme', lang) : t('மாநில திட்டம்', 'State Scheme', lang)}
                  </p>
                  <h2 className="font-bold text-base mt-1 leading-snug">
                    {lang === 'ta' ? detail.name_ta : (detail.name_en || detail.name_ta)}
                  </h2>
                  {detail.department_ta && (
                    <p className="text-xs opacity-75 mt-1">{lang === 'ta' ? detail.department_ta : (detail.department_en || detail.department_ta)}</p>
                  )}
                </div>
                {appliedSchemes.has(detail.scheme_id) && (
                  <span className="bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full shrink-0">
                    {t('விண்ணப்பித்தது', 'Applied', lang)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 pb-32 space-y-3">
            {/* Benefit card — saffron */}
            {detail.benefit_amount && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">
                  {t('நலன்', 'Benefit', lang)}
                </p>
                <p className="text-amber-900 font-bold text-lg">{lang === 'ta' ? (detail.benefit_amount_ta ?? detail.benefit_amount) : detail.benefit_amount}</p>
              </div>
            )}

            {/* Description */}
            {(detail.description_ta || detail.description_en) && (
              <div className="card p-4">
                <p className="text-xs text-gray-500 font-semibold mb-1">{t('விளக்கம்', 'Description', lang)}</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {lang === 'ta' ? detail.description_ta : (detail.description_en || detail.description_ta)}
                </p>
              </div>
            )}

            {/* Eligibility check */}
            <div className="card p-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">{t('தகுதி சரிபார்ப்பு', 'Eligibility Check', lang)}</p>
              {!checkResult && (
                <button
                  onClick={runEligibilityCheck}
                  disabled={checkLoading}
                  className="btn-primary text-sm w-full"
                >
                  {checkLoading
                    ? t('சரிபார்க்கிறது…', 'Checking…', lang)
                    : t('இப்போது சரிபார்', 'Check Now', lang)}
                </button>
              )}
              {checkResult && (
                <div className={cn('rounded-xl px-4 py-3', checkResult.is_eligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200')}>
                  <p className={cn('font-semibold text-sm', checkResult.is_eligible ? 'text-green-800' : 'text-red-800')}>
                    {checkResult.is_eligible
                      ? t('✓ நீங்கள் தகுதியுள்ளவர்!', '✓ You are eligible!', lang)
                      : t('✗ தகுதியில்லை', '✗ Not eligible', lang)}
                  </p>
                  {checkResult.llm_response && (
                    <p className="text-gray-700 text-xs mt-2 leading-relaxed">{checkResult.llm_response}</p>
                  )}
                </div>
              )}
            </div>

            {/* Document checklist */}
            {docs.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 font-semibold">{t('தேவையான ஆவணங்கள்', 'Required Documents', lang)}</p>
                  <span className="text-xs font-semibold text-primary-700">{docsChecked}/{docs.length}</span>
                </div>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <button
                      key={doc}
                      onClick={() => setCheckedDocs(prev => {
                        const n = new Set(prev)
                        n.has(doc) ? n.delete(doc) : n.add(doc)
                        return n
                      })}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors',
                        checkedDocs.has(doc)
                          ? 'bg-primary-50 border-primary-200 text-primary-800'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0',
                        checkedDocs.has(doc)
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-gray-400'
                      )}>
                        {checkedDocs.has(doc) && '✓'}
                      </span>
                      <span className="text-sm">{doc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Application status tracker */}
            {appStatus !== 'none' && (
              <div className="card p-4">
                <p className="text-xs text-gray-500 font-semibold mb-3">{t('விண்ணப்ப நிலை', 'Application Status', lang)}</p>
                <div className="flex items-center">
                  {STATUS_STEPS.map((step, i) => {
                    const stepIdx = STATUS_STEPS.findIndex(s => s.key === appStatus)
                    const done = i <= stepIdx
                    return (
                      <div key={step.key} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center flex-1">
                          <div className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                            done ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                          )}>
                            {done ? '✓' : i + 1}
                          </div>
                          <p className={cn('text-xs mt-1 text-center leading-tight', done ? 'text-primary-700 font-medium' : 'text-gray-400')}>
                            {lang === 'ta' ? step.ta : step.en}
                          </p>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={cn('h-0.5 flex-1 mb-4', done && i < stepIdx ? 'bg-primary-600' : 'bg-gray-200')} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
            {detail.application_url ? (
              <a
                href={detail.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn-primary text-sm text-center py-3"
              >
                {t('விண்ணப்பிக்கவும்', 'Apply Now', lang)} →
              </a>
            ) : (
              <button className="flex-1 btn-primary text-sm py-3" disabled>
                {t('மாவட்ட அலுவலகத்தில் விண்ணப்பிக்கவும்', 'Apply at District Office', lang)}
              </button>
            )}
            {!appliedSchemes.has(detail.scheme_id) && (
              <button
                onClick={() => markApplied(detail.scheme_id)}
                className="flex-1 btn-secondary text-sm py-3"
              >
                {t('விண்ணப்பித்தது என்று குறி', 'Mark as Applied', lang)}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── SchemeCard ────────────────────────────────────────────────────────────────

function SchemeCard({
  scheme, color, lang, isApplied, isEligible, onClick
}: {
  scheme: EligibleSchemeOut
  color: string
  lang: Lang
  isApplied: boolean
  isEligible: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full card p-4 text-left border-l-4 transition-opacity',
        !isEligible && 'opacity-50'
      )}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm leading-snug">
              {lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)}
            </span>
          </div>
          {(scheme.department_ta || scheme.department_en) && (
            <p className="text-gray-400 text-xs mt-0.5 truncate">{lang === 'ta' ? scheme.department_ta : (scheme.department_en || scheme.department_ta)}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isApplied && (
            <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
              {t('விண்ணப்பித்தது', 'Applied', lang)}
            </span>
          )}
          {!isApplied && isEligible && (
            <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
              {t('புதியது', 'New', lang)}
            </span>
          )}
          {scheme.level && (
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              scheme.level === 'central' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
            )}>
              {scheme.level === 'central' ? t('மத்திய', 'Central', lang) : t('மாநில', 'State', lang)}
            </span>
          )}
        </div>
      </div>

      {scheme.benefit_amount && (
        <p className="text-primary-700 text-xs font-semibold mt-2">{lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount}</p>
      )}

      {scheme.deadline_urgent && scheme.application_deadline && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-orange-500 text-xs">⏰</span>
          <span className="text-orange-700 text-xs font-medium">
            {t('கடைசி தேதி:', 'Deadline:', lang)} {scheme.application_deadline}
          </span>
        </div>
      )}
    </button>
  )
}
