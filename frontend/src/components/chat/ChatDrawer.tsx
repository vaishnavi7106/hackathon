import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useSchemeStore } from '@/store/schemeStore'
import { useSpeechRecognition, formatElapsed } from '@/hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { cn } from '@/lib/utils'

const QUICK_PROMPTS = {
  ta: [
    'எனக்கு என்ன திட்டங்கள் தகுதி?',
    'PM கிசான் திட்டம் விவரம்',
    'கிசான் கடன் அட்டை எப்படி பெறுவது?',
  ],
  en: [
    'What schemes am I eligible for?',
    'PM Kisan scheme details',
    'How to get Kisan Credit Card?',
  ],
}

interface ChatDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  const navigate = useNavigate()
  const { lang, toggleLang, chatHistory, chatConvId, addChatMsg, setChatConvId } = useSchemeStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRecordOverlay, setShowRecordOverlay] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const speech = useSpeechRecognition(lang)
  const synth = useSpeechSynthesis(lang)

  // Show recording overlay when mic starts
  useEffect(() => {
    if (speech.isRecording) {
      setShowRecordOverlay(true)
    }
  }, [speech.isRecording])

  // When recording stops and we have a transcript, pre-fill the edit field
  useEffect(() => {
    if (!speech.isRecording && speech.transcript) {
      setEditedTranscript(speech.transcript)
    }
  }, [speech.isRecording, speech.transcript])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 350)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory.length, loading])

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const welcomeMsg = {
    role: 'bot' as const,
    text: t(
      'வணக்கம்! அரசு திட்டங்கள், கடன்கள், காப்பீடு பற்றி கேளுங்கள்.',
      'Hello! Ask me about government schemes, loans, and insurance.',
    ),
  }
  const msgs = chatHistory.length > 0 ? chatHistory : [welcomeMsg]

  async function sendChat(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    addChatMsg({ role: 'user', text: trimmed })
    setInput('')
    setLoading(true)
    try {
      const res = await schemesApi.chat({ message: trimmed, language: lang, conversation_id: chatConvId })
      setChatConvId(res.conversation_id)
      addChatMsg({ role: 'bot', text: res.response_ta, schemeIds: res.eligible_scheme_ids })
    } catch {
      addChatMsg({ role: 'bot', text: t('பதில் கிடைக்கவில்லை. மீண்டும் முயற்சிக்கவும்.', 'Could not get a response. Please try again.') })
    } finally {
      setLoading(false)
    }
  }

  function handleMicClick() {
    if (speech.isRecording) {
      speech.stop()
    } else {
      setEditedTranscript('')
      speech.start()
    }
  }

  function sendTranscript() {
    const text = editedTranscript.trim()
    if (text) {
      sendChat(text)
    }
    setShowRecordOverlay(false)
    speech.reset()
    setEditedTranscript('')
  }

  function cancelRecording() {
    speech.reset()
    setShowRecordOverlay(false)
    setEditedTranscript('')
  }

  return (
    <>
      {/* Drawer — full-height overlay within the app column */}
      <div
        className={cn(
          'fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary-900 text-white">
          <span className="text-base">🏛️</span>
          <span className="flex-1 font-semibold text-sm">{t('AI திட்ட வழிகாட்டி', 'AI Scheme Guide')}</span>
          <button
            onClick={toggleLang}
            className="text-xs border border-primary-400 text-primary-100 rounded-full px-2.5 py-0.5 bg-primary-800"
          >
            {lang === 'ta' ? 'EN' : 'த'}
          </button>
          <button onClick={onClose} className="ml-1 text-primary-300 text-xl leading-none hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {chatHistory.length === 0 && (
            <div className="space-y-2 mt-1">
              <p className="text-xs text-gray-400 text-center">{t('விரைவு கேள்விகள்', 'Quick prompts')}</p>
              {QUICK_PROMPTS[lang].map((q) => (
                <button
                  key={q}
                  onClick={() => sendChat(q)}
                  className="w-full text-left text-xs border border-primary-200 text-primary-700 rounded-xl px-3 py-2 bg-white hover:bg-primary-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {msgs.map((msg, i) => {
            const msgId = `msg-${i}`
            const isPlaying = synth.currentId === msgId && synth.isSpeaking
            const isPaused = synth.currentId === msgId && synth.isPaused

            return (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs shrink-0 mt-0.5">🏛️</div>
                )}
                <div className={cn(
                  'max-w-[82%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed transition-colors',
                  msg.role === 'user'
                    ? 'bg-primary-700 text-white rounded-br-sm'
                    : cn(
                      'bg-gray-100 text-gray-800 rounded-bl-sm',
                      (isPlaying || isPaused) && 'bg-primary-50 ring-1 ring-primary-300',
                    ),
                )}>
                  {msg.text}

                  {/* Bot message actions */}
                  {msg.role === 'bot' && (
                    <div className="flex items-center gap-2 mt-2">
                      {/* View schemes CTA */}
                      {msg.schemeIds && msg.schemeIds.length > 0 && (
                        <button
                          onClick={() => { onClose(); navigate('/navigator/eligible') }}
                          className="text-primary-700 text-xs font-semibold hover:text-primary-900 flex items-center gap-1"
                        >
                          {t(`${msg.schemeIds.length} திட்டங்கள் காண்க →`, `View ${msg.schemeIds.length} Schemes →`)}
                        </button>
                      )}

                      {/* TTS play/pause */}
                      {synth.isSupported && (
                        <button
                          onClick={() => synth.toggle(msg.text, msgId)}
                          className={cn(
                            'ml-auto text-xs flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors',
                            isPlaying
                              ? 'bg-primary-200 text-primary-800'
                              : isPaused
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300',
                          )}
                          aria-label={isPlaying ? 'Pause' : 'Play response'}
                        >
                          {isPlaying ? '⏸' : isPaused ? '▶' : '🔊'}
                          <span>{isPlaying ? t('நிறுத்து', 'Pause') : isPaused ? t('தொடர்', 'Resume') : t('கேள்', 'Play')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs shrink-0">🏛️</div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Recording Overlay ── */}
        {showRecordOverlay && (
          <div className="shrink-0 bg-gray-900 px-4 py-3 space-y-2">
            {/* Recording indicator */}
            {speech.isRecording && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold">{t('பேசுகிறீர்கள்…', 'Listening…')}</span>
                </div>
                <span className="text-gray-400 text-xs tabular-nums">{formatElapsed(speech.elapsed)}</span>
              </div>
            )}

            {/* Interim transcript */}
            {(speech.interimTranscript || speech.isRecording) && (
              <p className="text-gray-300 text-xs italic min-h-[1.5rem]">
                {speech.interimTranscript || '…'}
              </p>
            )}

            {/* Final transcript edit area */}
            {!speech.isRecording && editedTranscript && (
              <>
                <p className="text-gray-400 text-xs">{t('திருத்தம் செய்யலாம்:', 'Edit if needed:')}</p>
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                  rows={3}
                />
              </>
            )}

            {speech.error && (
              <p className="text-red-400 text-xs">{speech.error}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="flex-1 py-2 rounded-xl bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                {t('ரத்து', 'Cancel')}
              </button>
              {speech.isRecording ? (
                <button
                  onClick={() => speech.stop()}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  ⏹ {t('நிறுத்து', 'Stop')}
                </button>
              ) : (
                <button
                  onClick={sendTranscript}
                  disabled={!editedTranscript.trim()}
                  className="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {t('அனுப்பு ↑', 'Send ↑')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        {!showRecordOverlay && (
          <form
            onSubmit={(e) => { e.preventDefault(); sendChat(input) }}
            className="shrink-0 border-t border-gray-200 px-3 py-2.5 flex gap-2"
          >
            {/* Mic button */}
            {speech.isSupported && (
              <button
                type="button"
                onClick={handleMicClick}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base transition-colors',
                  speech.isRecording
                    ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200',
                )}
                aria-label={speech.isRecording ? t('நிறுத்து', 'Stop recording') : t('குரல் உள்ளீடு', 'Voice input')}
              >
                🎙️
              </button>
            )}
            <input
              ref={inputRef}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              placeholder={t('தமிழில் கேளுங்கள்…', 'Ask in Tamil or English…')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 text-base"
            >
              ↑
            </button>
          </form>
        )}
      </div>
    </>
  )
}
