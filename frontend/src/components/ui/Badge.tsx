import { cn } from '@/lib/utils'

type BadgeVariant = 'central' | 'state' | 'eligible' | 'ineligible' | 'needs-info' | 'neutral'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  central: 'badge-central',
  state: 'badge-state',
  eligible: 'badge-eligible',
  ineligible: 'badge-ineligible',
  'needs-info': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantClasses[variant], className)}>
      {children}
    </span>
  )
}

export function LevelBadge({ level }: { level: 'central' | 'state' }) {
  return (
    <Badge variant={level}>
      {level === 'central' ? 'மத்திய' : 'மாநில'}
    </Badge>
  )
}

export function EligibilityBadge({ isEligible, needsInfo }: { isEligible: boolean; needsInfo?: boolean }) {
  if (needsInfo) return <Badge variant="needs-info">தகவல் தேவை</Badge>
  return (
    <Badge variant={isEligible ? 'eligible' : 'ineligible'}>
      {isEligible ? '✓ தகுதியுள்ளவர்' : '✗ தகுதியில்லை'}
    </Badge>
  )
}
