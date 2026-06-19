import { useState } from 'react'
import { ChatDrawer } from './ChatDrawer'

interface ChatFABProps {
  bottomOffset?: number
}

export function ChatFAB({ bottomOffset = 80 }: ChatFABProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* FAB pinned to bottom-right of the app column (max-w-[480px] centred) */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] pointer-events-none z-30"
        style={{ bottom: bottomOffset }}
      >
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto absolute right-4 w-[52px] h-[52px] bg-primary-700 hover:bg-primary-800 text-white rounded-full shadow-xl flex items-center justify-center text-2xl transition-transform active:scale-95"
          aria-label="Open AI chat"
        >
          🤖
        </button>
      </div>
      <ChatDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
