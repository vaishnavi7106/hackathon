import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { cn } from '@/lib/utils'

const QUICK_PROMPTS = {
  ta: [
    'எனக்கு என்ன திட்டங்கள் தகுதி?',
    'நெல்லுக்கு பயிர் காப்பீடு',
    'PM கிசான் திட்டம் விவரம்',
    'கிசான் கடன் அட்டை எப்படி பெறுவது?',
  ],
  en: [
    'What schemes am I eligible for?',
    'Crop insurance for rice',
    'PM Kisan scheme details',
    'How to get Kisan Credit Card?',
  ],
}

export default function Chat() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const { lang, toggleLang, chatHistory, chatConvId, addChatMsg, setChatConvId, clearChatHistory } = useSchemeStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [eligibleIds, setEligibleIds] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const msgs = chatHistory.length > 0
    ? chatHistory
    : [{ role: 'bot' as const, text: lang === 'ta'
        ? 'வணக்கம்! நான் உங்கள் அரசு திட்ட ஆலோசகர். அரசு திட்டங்கள், கடன்கள், காப்பீடு பற்றி கேளுங்கள்.'
        : 'Hello! I am your government scheme advisor. Ask me about schemes, loans, and insurance.' }]

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  async function sendChat(text: string) {
    if (!text.trim() || loading) return
    addChatMsg({ role: 'user', text })
    setInput('')
    setLoading(true)
    try {
      const res = await schemesApi.chat({ message: text, language: lang, conversation_id: chatConvId })
      setChatConvId(res.conversation_id)
      setEligibleIds(res.eligible_scheme_ids)
      addChatMsg({
        role: 'bot',
        text: res.response_ta,
        schemeIds: res.eligible_scheme_ids,
      })
    } catch {
      addChatMsg({
        role: 'bot',
        text: t('பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.', 'Could not get a response. Please try again.'),
      })
    } finally {
      setLoading(false)
    }
  }

  const lastBotWithSchemes = [...msgs].reverse().find((m) => m.role === 'bot' && m.schemeIds && m.schemeIds.length > 0)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 p-1 -ml-1 text-lg">←</button>
        <h1 className="flex-1 font-semibold text-gray-900 text-sm">
          {t('AI உதவியாளர் 🏛️', 'Scheme Advisor 🏛️')}
        </h1>
        <button
          onClick={clearChatHistory}
          className="text-xs text-gray-400 px-2 py-1 hover:text-gray-600"
        >
          {t('அழி', 'Clear')}
        </button>
        <button
          onClick={toggleLang}
          className="text-xs border border-primary-400 text-primary-700 rounded-full px-3 py-1 bg-primary-50"
        >
          {lang === 'ta' ? 'En' : 'த'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
        {/* Quick prompts on fresh chat */}
        {chatHistory.length === 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-gray-400 text-center">{t('விரைவு கேள்விகள்', 'Quick prompts')}</p>
            {QUICK_PROMPTS[lang].map((q) => (
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
                ? 'bg-primary-700 text-white rounded-br-sm'
                : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm',
            )}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm shrink-0">🏛️</div>
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Floating eligible count */}
      {lastBotWithSchemes && lastBotWithSchemes.schemeIds && lastBotWithSchemes.schemeIds.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
          <Link
            to="/navigator/eligible"
            className="bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2"
          >
            <span>{lastBotWithSchemes.schemeIds.length} {t('தகுதியான திட்டங்கள்', 'Eligible Schemes')}</span>
            <span>→</span>
          </Link>
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); sendChat(input) }}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-4 py-3 flex gap-2 z-40"
      >
        <input
          className="input flex-1 text-sm"
          placeholder={t('தமிழில் கேளுங்கள்…', 'Ask in Tamil or English…')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          ↑
        </button>
      </form>
    </div>
  )
}
