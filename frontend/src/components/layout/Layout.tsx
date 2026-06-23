import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { GlobalAssistant } from '@/components/GlobalAssistant'

interface LayoutProps {
  title?: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export function Layout({ title, showBack, rightAction }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-[480px] flex flex-col min-h-screen">
        {title && (
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 p-1 -ml-1"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <h1 className="flex-1 font-semibold text-gray-900 text-base truncate">{title}</h1>
            {rightAction}
          </header>
        )}
        <main className="flex-1 pb-20">
          <Outlet />
        </main>
        <BottomNav />
        <GlobalAssistant />
      </div>
    </div>
  )
}

export function PageLayout({ title, showBack, rightAction, children }: LayoutProps & { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-[480px] flex flex-col min-h-screen">
        {title && (
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 p-1 -ml-1"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <h1 className="flex-1 font-semibold text-gray-900 text-base truncate">{title}</h1>
            {rightAction}
          </header>
        )}
        <main className="flex-1 pb-20">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
