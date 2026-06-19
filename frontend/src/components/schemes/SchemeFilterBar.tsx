import { cn } from '@/lib/utils'

type LevelFilter = 'all' | 'central' | 'state'

interface SchemeFilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  level: LevelFilter
  onLevelChange: (v: LevelFilter) => void
}

const levels: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'அனைத்தும்' },
  { value: 'central', label: 'மத்திய' },
  { value: 'state', label: 'மாநில' },
]

export function SchemeFilterBar({ search, onSearchChange, level, onLevelChange }: SchemeFilterBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3 sticky top-0 z-20">
      <input
        type="search"
        className="input"
        placeholder="திட்டம் தேடுக…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="திட்டம் தேடுக"
      />
      <div className="flex gap-2">
        {levels.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onLevelChange(value)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              level === value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
