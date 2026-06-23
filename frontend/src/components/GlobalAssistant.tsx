import { useState, useRef, useEffect } from 'react'
import { Sprout, X, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react'
import { assistantApi } from '@/api/assistant'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { useHarvestStore } from '@/store/harvestStore'
import { useFarmerStore } from '@/store/farmerStore'
import type { DailyRecord } from '@/types/dailyRecord'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg { role: 'user' | 'bot'; text: string }

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'இன்று என்ன செய்ய வேண்டும்?',
  'என் பயிருக்கு நீர்பாசனம் தேவையா?',
  'சந்தையில் விற்பது சரியா?',
  'எனக்கு என்ன திட்டங்கள் தகுதி?',
]

// ─── Context builder ──────────────────────────────────────────────────────────

function buildFarmerContext(
  profile: ReturnType<typeof useProfileStore.getState>['profile'],
  todayRecord: DailyRecord | null,
  harvests: ReturnType<typeof useHarvestStore.getState>['harvests'],
) {
  const lines: string[] = []

  // Profile
  if (profile.primaryCrop)    lines.push(`பயிர்: ${profile.primaryCrop}`)
  if (profile.landSizeAcres)  lines.push(`நிலம்: ${profile.landSizeAcres} ஏக்கர்`)
  if (profile.village)        lines.push(`கிராமம்: ${profile.village}`)
  if (profile.irrigationType) lines.push(`நீர்பாசன வகை: ${profile.irrigationType}`)
  if (profile.soilType)       lines.push(`மண் வகை: ${profile.soilType}`)

  // Today's record
  if (todayRecord) {
    lines.push('')
    lines.push('இன்றைய நிலை:')
    if (todayRecord.stage_days)               lines.push(`  பயிர் நிலை: ${todayRecord.stage_days} நாட்கள்`)
    if (todayRecord.weather?.temp_c)          lines.push(`  வெப்பநிலை: ${todayRecord.weather.temp_c}°C`)
    if (todayRecord.irrigation_recommended != null)
      lines.push(`  நீர்பாசனம்: ${todayRecord.irrigation_recommended ? 'தேவை' : 'தேவையில்லை'}`)
    if (todayRecord.fertilizer_due != null)
      lines.push(`  உரம்: ${todayRecord.fertilizer_due ? 'இன்று தேவை' : 'தேவையில்லை'}`)
    if (todayRecord.next_fertilizer)         lines.push(`  அடுத்த உரம்: ${todayRecord.next_fertilizer} நாட்களில்`)
  }

  // Active harvests
  const active = harvests.filter(h => !h.sold)
  if (active.length > 0) {
    lines.push('')
    lines.push('அறுவடை நிலை:')
    active.forEach(h => {
      const rec = h.recommendation
        ? (h.recommendation === 'SELL' ? 'விற்கவும்' : `${h.weeksToHold || ''} வாரம் காக்கவும்`)
        : 'சரிபார்க்கவில்லை'
      lines.push(`  ${h.cropTa}: ${h.quantity} குவி. — ${rec}`)
    })
  }

  return lines.join('\n')
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GlobalAssistant() {
  const profile      = useProfileStore(s => s.profile)
  const farmerStore  = useFarmerStore()
  const todayByCrop  = useDailyRecordStore(s => s.todayByCrop)
  const harvests     = useHarvestStore(s => s.harvests)
  // Pick today's record for the primary crop
  const primaryCropId = profile.crops[0]?.id ?? ''
  const todayRecord   = primaryCropId ? (todayByCrop[primaryCropId] ?? null) : null

  const [isOpen,    setIsOpen]    = useState(false)
  const [messages,  setMessages]  = useState<ChatMsg[]>([
    { role: 'bot', text: `வணக்கம்${profile.name ? ' ' + profile.name : ''}! நான் உழவர் AI உதவியாளர். என்ன உதவி வேண்டும்?` },
  ])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking,  setSpeaking]  = useState(false)
  const [convId,    setConvId]    = useState<string | null>(null)
  const [voiceMode, setVoiceMode] = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const recognizerRef = useRef<SpeechRecognition | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  // Stop recognition when panel closes
  useEffect(() => {
    if (!isOpen) {
      recognizerRef.current?.abort()
      setListening(false)
      window.speechSynthesis?.cancel()
      setSpeaking(false)
    }
  }, [isOpen])

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setMessages(m => [...m, { role: 'user', text: trimmed }])
    setInput('')
    setLoading(true)

    const context = buildFarmerContext(profile, todayRecord, harvests)

    try {
      const res = await assistantApi.chat({
        message:        trimmed,
        farmer_context: context,
        conversation_id: convId,
      })
      setConvId(res.conversation_id)
      setMessages(m => [...m, { role: 'bot', text: res.response }])
      if (voiceMode) speakText(res.response)
    } catch {
      const fallback = 'மன்னிக்கவும் நண்பரே, இப்போது பதில் சொல்ல முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
      setMessages(m => [...m, { role: 'bot', text: fallback }])
    } finally {
      setLoading(false)
    }
  }

  // ── Voice input ───────────────────────────────────────────────────────────

  function toggleListening() {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition

    if (!SR) {
      setMessages(m => [...m, { role: 'bot', text: 'உங்கள் browser இல் voice அம்சம் கிடைக்கவில்லை.' }])
      return
    }

    if (listening) {
      recognizerRef.current?.abort()
      setListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'ta-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognizerRef.current = recognition

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      setInput(text)
      setListening(false)
      sendMessage(text)
    }

    recognition.onerror = () => setListening(false)
    recognition.onend   = () => setListening(false)

    recognition.start()
    setListening(true)
    setVoiceMode(true)
  }

  // ── Voice output ──────────────────────────────────────────────────────────

  function speakText(text: string) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang  = 'ta-IN'
    utterance.rate  = 0.88
    utterance.pitch = 1.0
    utterance.onstart = () => setSpeaking(true)
    utterance.onend   = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Only show if logged in
  if (!farmerStore.isLoggedIn()) return null

  return (
    <>
      {/* Panel overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 48, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Chat panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, height: '75vh',
          background: '#F5F6F5', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          zIndex: 49, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D5DB' }} />
          </div>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '10px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sprout size={18} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'white' }}>உழவர் AI உதவியாளர்</p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                {speaking ? '🔊 பேசுகிறது...' : listening ? '🎙️ கேட்கிறது...' : 'எந்த கேள்வியும் கேளுங்கள்'}
              </p>
            </div>
            {speaking && (
              <button onClick={stopSpeaking}
                style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Volume2 size={15} color="white" />
              </button>
            )}
            <button onClick={() => setIsOpen(false)}
              style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="white" />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Quick prompts (shown only on fresh chat) */}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>விரைவு கேள்விகள்</p>
                {QUICK_PROMPTS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    style={{ textAlign: 'left', background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '9px 12px', fontSize: 13, color: '#0A5C47', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                {msg.role === 'bot' && (
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
                    <Sprout size={14} color="#0A5C47" />
                  </div>
                )}
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? '#0A5C47' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1E293B',
                    fontSize: 13, lineHeight: 1.6, fontWeight: 500,
                    boxShadow: msg.role === 'bot' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                  }}>
                    {msg.text}
                  </div>
                  {msg.role === 'bot' && i > 0 && (
                    <button onClick={() => speakText(msg.text)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>
                      {speaking
                        ? <VolumeX size={12} color="#94A3B8" />
                        : <Volume2 size={12} color="#94A3B8" />}
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{speaking ? 'நிறுத்து' : 'கேளுங்கள்'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sprout size={14} color="#0A5C47" />
                </div>
                <div style={{ background: 'white', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#A7F3D0', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ background: 'white', borderTop: '1px solid #E2E8F0', padding: '10px 14px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Mic button */}
            <button onClick={toggleListening}
              style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: listening ? '#DC2626' : '#F0FDF4', transition: 'all 0.15s' }}>
              {listening
                ? <MicOff size={18} color="white" />
                : <Mic size={18} color="#0A5C47" />}
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder={listening ? 'கேட்கிறது...' : 'தமிழில் கேளுங்கள்…'}
              disabled={loading}
              style={{ flex: 1, height: 40, borderRadius: 20, border: '1px solid #E2E8F0', padding: '0 14px', fontSize: 13, outline: 'none', color: '#1E293B', background: '#F8FAFC' }}
            />

            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', background: input.trim() && !loading ? '#0A5C47' : '#E2E8F0', transition: 'all 0.15s' }}>
              <Send size={16} color={input.trim() && !loading ? 'white' : '#94A3B8'} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button — bottom-right, inside max-480px mobile container */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 76,
          right: 'calc(max(0px, (100vw - 480px) / 2) + 16px)',
          width: 52, height: 52, borderRadius: 26,
          background: isOpen ? '#065F46' : 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)',
          border: '2px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 16px rgba(10,92,71,0.4)',
          cursor: 'pointer', zIndex: 47,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        aria-label="உழவர் AI உதவியாளர்"
      >
        {isOpen
          ? <X size={22} color="white" />
          : <Sprout size={22} color="white" />}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
