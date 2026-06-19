import { cn } from '@/lib/utils'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed', isUser ? 'bubble-user' : 'bubble-ai')}>
        {content}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bubble-ai px-4 py-3 rounded-2xl">
        <div className="dot-flashing" />
      </div>
    </div>
  )
}
