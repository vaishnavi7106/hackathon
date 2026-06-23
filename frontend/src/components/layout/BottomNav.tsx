import { NavLink } from 'react-router-dom'
import { Home, Landmark, Leaf, Sprout, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',               label: 'முகப்பு',   Icon: Home,       end: true  },
  { to: '/navigator',      label: 'திட்டங்கள்', Icon: Landmark,   end: false },
  { to: '/crop-sentinel',  label: 'பயிர்',      Icon: Leaf,       end: false },
  { to: '/soil-optimizer', label: 'மண்',        Icon: Sprout,     end: false },
  { to: '/market',         label: 'சந்தை',      Icon: TrendingUp, end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t z-40"
         style={{ borderColor: '#D1D5DB' }}>
      <div className="flex safe-area-pb">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                isActive ? 'text-[#0A5C47]' : 'text-gray-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  color={isActive ? '#0A5C47' : '#9CA3AF'}
                />
                <span className={cn('font-medium text-[11px]', isActive ? 'text-[#0A5C47]' : 'text-gray-400')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
