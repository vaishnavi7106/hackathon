import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Props {
  pct: number
  lang: 'ta' | 'en'
  showCta?: boolean
}

export function ProfileCompletionWidget({ pct, lang, showCta = true }: Props) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const color = pct >= 80 ? 'bg-primary-600' : pct >= 50 ? 'bg-amber-500' : 'bg-orange-500'
  const textColor = pct >= 80 ? 'text-primary-700' : pct >= 50 ? 'text-amber-700' : 'text-orange-700'
  const label = pct >= 80
    ? t('சுயவிவரம் கிட்டத்தட்ட முழுமையானது', 'Profile almost complete')
    : pct >= 50
    ? t('சுயவிவரம் பாதி முடிந்துள்ளது', 'Profile half complete')
    : t('சுயவிவரத்தை நிரப்புங்கள்', 'Complete your profile')

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{t('சுயவிவர நிறைவு', 'Profile Completion')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
        <span className={cn('text-2xl font-bold tabular-nums', textColor)}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {showCta && pct < 100 && (
        <Link
          to="/profile/onboarding"
          className="block w-full text-center text-sm font-semibold text-primary-700 py-2 border border-primary-200 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          {t('சுயவிவரம் முடிக்க →', 'Complete Profile →')}
        </Link>
      )}
    </div>
  )
}
