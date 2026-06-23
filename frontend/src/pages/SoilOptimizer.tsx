import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { DailyHomeCard } from '@/components/pillar2/DailyHomeCard'
import { DailyHistoryView } from '@/components/pillar2/DailyHistoryView'
import { useDailyEngine } from '@/lib/pillar2/useDailyEngine'
import { TN_CROPS } from '@/data/tn-options'
import { cn } from '@/lib/utils'

export default function SoilOptimizer() {
  const { profile } = useProfileStore()
  const lang = profile.language as 'ta' | 'en'
  const t = (ta: string, en: string) => (lang === 'ta' ? ta : en)

  const [searchParams] = useSearchParams()
  const { isCalculating, error, retry } = useDailyEngine()

  const [activeSection, setActiveSection] = useState<'plan' | 'diary'>('plan')

  // Crop tab state — initialise from URL param or first crop
  const defaultCropId = searchParams.get('crop') || profile.crops[0]?.id || ''
  const [activeCropId, setActiveCropId] = useState(defaultCropId)

  const activeCrop = profile.crops.find((c) => c.id === activeCropId) ?? profile.crops[0]
  const effectiveCropId = activeCrop?.id ?? ''
  const effectiveCropName = activeCrop?.name ?? profile.primaryCrop ?? 'rice'

  // Helper: Tamil label for a crop value
  const cropLabel = (value: string) => {
    const found = TN_CROPS.find((c) => c.value === value)
    if (!found) return value
    return lang === 'ta' ? found.ta : found.en
  }

  const noCrops = profile.crops.length === 0

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#F9FAFB', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-0 sticky top-0 z-30" style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
        <p className="text-white font-semibold text-base">
          {t('மண் & நீர் மேலாளர்', 'Soil & Water Optimizer')}
        </p>
        <p className="text-xs mt-0.5 mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('TNAU CPG 2020 • FAO-56 அடிப்படையில்', 'Based on TNAU CPG 2020 & FAO-56')}
        </p>

        {/* Crop tabs — one per crop */}
        {profile.crops.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {profile.crops.map((crop) => (
              <button
                key={crop.id}
                onClick={() => setActiveCropId(crop.id)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border"
                style={activeCropId === crop.id
                  ? { backgroundColor: 'white', color: '#0A5C47', borderColor: 'white' }
                  : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.35)' }}
              >
                {cropLabel(crop.name)}
                {crop.acres > 0 && (
                  <span className="ml-1 opacity-70">· {crop.acres}{t('ஏ', 'ac')}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Section tab bar */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
          {[
            { key: 'plan', ta: 'இன்றைய பணி', en: "Today's Task" },
            { key: 'diary', ta: 'பண்ணை நாட்குறிப்பு', en: 'Farm Diary' },
          ].map(({ key, ta, en }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as 'plan' | 'diary')}
              className="flex-1 text-xs font-semibold py-2.5 border-b-2 transition-colors"
              style={activeSection === key
                ? { borderColor: 'white', color: 'white' }
                : { borderColor: 'transparent', color: 'rgba(255,255,255,0.55)' }}
            >
              {t(ta, en)}
            </button>
          ))}
        </div>
      </div>

      {/* No crops nudge */}
      {noCrops && (
        <div className="p-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0">🌾</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {t('பயிர் விவரங்கள் தேவை', 'Crop details needed')}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t(
                  'சரியான உர & நீர் பரிந்துரைக்கு பயிர் தகவல் சேர்க்கவும்',
                  'Add crop details for accurate fertilizer & water advice',
                )}
              </p>
              <Link
                to="/profile/onboarding"
                className="inline-block mt-2 text-xs font-bold text-amber-900 underline"
              >
                {t('சுயவிவரம் திருத்து →', 'Edit profile →')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Planting date nudge for active crop */}
      {!noCrops && activeCrop && !activeCrop.plantingDate && activeSection === 'plan' && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <span className="text-xl shrink-0">📅</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {t('நடவு தேதி தேவை', 'Planting date needed')}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t(
                  'சரியான உர & நீர் பரிந்துரைக்கு நடவு தேதி அளிக்கவும்',
                  'Enter your transplanting date for accurate fertilizer & water advice',
                )}
              </p>
              <Link
                to="/profile/onboarding"
                className="inline-block mt-2 text-xs font-bold text-amber-900 underline"
              >
                {t('சுயவிவரம் திருத்து →', 'Edit profile →')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Today's Task */}
      {!noCrops && activeSection === 'plan' && effectiveCropId && (
        <div className="p-4 space-y-3">
          <DailyHomeCard
            lang={lang}
            cropId={effectiveCropId}
            isCalculating={isCalculating}
            error={error}
            onRetry={retry}
          />
        </div>
      )}

      {/* Farm Diary */}
      {!noCrops && activeSection === 'diary' && effectiveCropId && (
        <div className="p-4">
          <DailyHistoryView
            lang={lang}
            crop={effectiveCropName}
            cropId={effectiveCropId}
          />
        </div>
      )}
    </div>
  )
}
