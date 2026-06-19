import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'முகப்பு', icon: '🏠', end: true },
  { to: '/navigator', label: 'திட்டங்கள்', icon: '🏛️', end: false },
  { to: '/crop-sentinel', label: 'பயிர்', icon: '🌿', end: false },
  { to: '/market', label: 'சந்தை', icon: '📊', end: false },
  { to: '/outbreak', label: 'நோய்', icon: '🔴', end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 safe-area-pb z-40">
      <div className="flex">
        {navItems.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                isActive ? 'text-primary-700' : 'text-gray-500',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl leading-none">{icon}</span>
                <span className={cn('font-medium', isActive && 'text-primary-700')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
