import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { ChatMessage, TypingIndicator } from '@/components/schemes/ChatMessage'
import { PageLayout } from '@/components/layout/Layout'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  role: 'assistant',
  content: 'வணக்கம்! நான் உங்கள் அரசு திட்டங்கள் உதவியாளர். அரசு திட்டங்கள், விவசாய கடன்கள், காப்பீடு பற்றி தமிழில் கேள்வி கேளுங்கள்.',
}

const QUICK_QUESTIONS = [
  'என்னுடைய பயிருக்கு என்ன திட்டங்கள் உள்ளன?',
  'PM கிசான் திட்டம் என்றால் என்ன?',
  'விவசாய கடன் எப்படி பெறுவது?',
  'பயிர் காப்பீடு பற்றி சொல்லுங்கள்',
]

export default function ChatPage() {
  const navigate = useNavigate()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { replace: true })
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await schemesApi.chat({
        message: text,
        conversation_id: conversationId,
        language: 'ta',
      })
      setConversationId(res.conversation_id)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response_ta }])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'பதில் கிடைக்கவில்லை. இணைய இணைப்பை சரிபார்க்கவும்.'
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <PageLayout title="AI உதவியாளர் 💬">
      <div className="flex flex-col h-[calc(100vh-8.5rem)]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 1 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-gray-500 text-center">விரைவு கேள்விகள்:</p>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs border border-primary-200 text-primary-700 rounded-xl px-3 py-2 bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-200 bg-white px-4 py-3 flex gap-2"
        >
          <input
            type="text"
            className="input flex-1 text-sm"
            placeholder="தமிழில் கேள்வி கேளுங்கள்…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            aria-label="Chat input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            ↑
          </button>
        </form>
      </div>
    </PageLayout>
  )
}
