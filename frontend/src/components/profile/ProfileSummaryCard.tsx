import { Link } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { TN_CROPS } from '@/data/tn-options'
import { cn } from '@/lib/utils'

interface Props {
  lang: 'ta' | 'en'
}

export function ProfileSummaryCard({ lang }: Props) {
  const { profile, completionPct } = useProfileStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const cropObj = TN_CROPS.find((c) => c.value === profile.primaryCrop)
  const cropLabel = cropObj ? (lang === 'ta' ? cropObj.ta : cropObj.en) : profile.primaryCrop

  const hasProfile = profile.district || profile.primaryCrop || profile.name

  if (!hasProfile) {
    return (
      <Link to="/profile/onboarding" className="block card p-4 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👤</span>
          <div>
            <p className="font-semibold text-gray-700 text-sm">{t('சுயவிவரம் அமை', 'Set up your profile')}</p>
            <p className="text-gray-500 text-xs mt-0.5">{t('சரியான திட்டங்களை கண்டறிய', 'To find the right schemes')}</p>
          </div>
          <span className="ml-auto text-gray-400">→</span>
        </div>
      </Link>
    )
  }

  return (
    <Link to="/profile" className="block card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
          {profile.name ? profile.name.charAt(0).toUpperCase() : '👤'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {profile.name || t('விவசாயி', 'Farmer')}
            </p>
            {/* Completion pill */}
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
              completionPct >= 80 ? 'bg-primary-100 text-primary-800' : 'bg-amber-100 text-amber-800',
            )}>
              {completionPct}%
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {profile.district && (
              <span className="text-xs text-gray-500">📍 {profile.district}</span>
            )}
            {cropLabel && (
              <span className="text-xs text-gray-500">🌾 {cropLabel}</span>
            )}
            {profile.landSizeAcres && (
              <span className="text-xs text-gray-500">📐 {profile.landSizeAcres} {t('ஏக்கர்', 'ac')}</span>
            )}
            {profile.aadhaarLinked && (
              <span className="text-xs text-primary-600">✓ {t('ஆதார்', 'Aadhaar')}</span>
            )}
          </div>
        </div>

        <span className="text-gray-400 text-sm mt-1">→</span>
      </div>

      {/* Completion bar */}
      {completionPct < 80 && (
        <div className="mt-3 space-y-1">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-amber-700">
            {t('சுயவிவரம் முழுமையற்றது — திட்டங்கள் தவறலாம்', 'Incomplete profile — schemes may be missed')}
          </p>
        </div>
      )}
    </Link>
  )
}
