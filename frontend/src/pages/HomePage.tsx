import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { farmerApi } from '@/api/farmer'
import { ProfileSummaryCard } from '@/components/profile/ProfileSummaryCard'
import { ProfileCompletionWidget } from '@/components/profile/ProfileCompletionWidget'
import { PushOptIn } from '@/components/common/PushOptIn'
import { useDailyEngine } from '@/lib/pillar2/useDailyEngine'
import { TN_CROPS } from '@/data/tn-options'
import type { FarmerCrop } from '@/types/profile'
import type { DailyRecord } from '@/types/dailyRecord'

// Compact crop summary card for the home page
function CropDailyCard({
  crop,
  record,
  lang,
}: {
  crop: FarmerCrop
  record: DailyRecord | null
  lang: 'ta' | 'en'
}) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const cropInfo = TN_CROPS.find((c) => c.value === crop.name)
  const cropLabel = cropInfo ? (lang === 'ta' ? cropInfo.ta : cropInfo.en) : crop.name

  const soilSummary = record
    ? record.fertilizer_due
      ? t('இன்று உரம் இட வேண்டும்!', 'Apply fertilizer today!')
      : t('உரம் தேவையில்லை', 'No fertilizer today')
    : null

  const waterSummary = record
    ? record.irrigation_recommended === 'irrigate'
      ? `${t('நீர் பாய்ச்சவும்', 'Irrigate')} — ${record.irrigation_minutes} ${t('நிமிடம்', 'min')}`
      : record.irrigation_recommended === 'skip_rain'
      ? t('மழை — தவிர்', 'Rain — skip')
      : t('நீர் தேவையில்லை', 'Skip irrigation')
    : null

  const stageLine = record
    ? lang === 'ta'
      ? `${record.display_stage_ta} · நாள் ${record.stage_days}`
      : `${record.display_stage} · Day ${record.stage_days}`
    : null

  return (
    <Link
      to={`/soil-optimizer?crop=${crop.id}`}
      className="block rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white"
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1B4332' }}>
        <div>
          <p className="text-sm font-bold text-white">{cropLabel}</p>
          {crop.acres > 0 && (
            <p className="text-xs text-green-400">{crop.acres} {t('ஏக்கர்', 'acres')}</p>
          )}
        </div>
        {stageLine && (
          <span className="text-xs text-green-300">{stageLine}</span>
        )}
      </div>

      {/* Task summary */}
      {(soilSummary || waterSummary) ? (
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{record?.fertilizer_due ? '🟡' : '✅'}</span>
            <p className="text-xs text-gray-700 font-medium leading-tight">{soilSummary}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base">{record?.irrigation_recommended === 'irrigate' ? '💧' : '✅'}</span>
            <p className="text-xs text-gray-700 font-medium leading-tight">{waterSummary}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">{t('கணக்கிட்டு வருகிறது…', 'Calculating…')}</p>
        </div>
      )}

      <div className="px-4 pb-2.5">
        <p className="text-xs text-green-700 font-semibold">{t('விரிவாக காண →', 'View details →')}</p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { isLoggedIn, profile, setProfile, clearAuth } = useFarmerStore()
  const { lang, toggleLang, savedIds, appliedIds, resetUserData } = useSchemeStore()
  const { profile: localProfile, completionPct, resetProfile } = useProfileStore()
  const { todayByCrop, isCalculating } = useDailyRecordStore()
  const [loadingProfile, setLoadingProfile] = useState(false)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  // Trigger daily engine for all crops
  useDailyEngine()

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { replace: true })
      return
    }
    if (!profile) {
      setLoadingProfile(true)
      farmerApi.getProfile()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setLoadingProfile(false))
    }
  }, [])

  function handleLogout() {
    resetProfile()
    resetUserData()
    clearAuth()
    navigate('/login', { replace: true })
  }

  const pillars = [
    {
      to: '/navigator',
      icon: '🏛️',
      ta: 'அரசு திட்ட வழிகாட்டி',
      en: 'Government Navigator',
      descTa: 'திட்டங்கள் • தகுதி • AI உதவி',
      descEn: 'Schemes • Eligibility • AI',
      active: true,
      badge: savedIds.length > 0 ? `${savedIds.length} ${t('சேமித்தது', 'saved')}` : null,
    },
    {
      to: '/crop-sentinel',
      icon: '🌿',
      ta: 'பயிர் காவலன்',
      en: 'Crop Sentinel',
      descTa: 'நோய் கண்டறிதல் • உரம் ஆலோசனை',
      descEn: 'Disease detection • Fertilizer',
      active: false,
      badge: null,
    },
    {
      to: '/market',
      icon: '📊',
      ta: 'சந்தை வழிகாட்டி',
      en: 'Market Navigator',
      descTa: 'விலைகள் • e-NAM • சந்தைகள்',
      descEn: 'Prices • e-NAM • Markets',
      active: false,
      badge: null,
    },
    {
      to: '/outbreak',
      icon: '🔴',
      ta: 'நோய் வலைப்பின்னல்',
      en: 'Outbreak Network',
      descTa: 'நோய் எச்சரிக்கை • அருகில் உள்ளவை',
      descEn: 'Disease alerts • Nearby',
      active: false,
      badge: null,
    },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-primary-900 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">{t('உழவர் AI 🌾', 'Uzhavar AI 🌾')}</h1>
            {profile?.district && (
              <p className="text-primary-300 text-xs">{profile.district}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="text-xs border border-primary-400 text-primary-100 rounded-full px-3 py-1 bg-primary-800"
            >
              {lang === 'ta' ? 'En' : 'த'}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-primary-300 hover:text-white"
            >
              {t('வெளியேறு', 'Logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-24 space-y-4">
        {/* Welcome card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white p-5">
          <p className="text-primary-200 text-xs">{t('வணக்கம்!', 'Welcome back!')}</p>
          <h2 className="text-xl font-bold mt-1">
            {loadingProfile ? '...' : (profile?.name || t('விவசாயி', 'Farmer'))}
          </h2>
          {profile?.land_size_acres && (
            <p className="text-primary-300 text-xs mt-1">
              {t('நில அளவு:', 'Land:')} {profile.land_size_acres} {t('ஏக்கர்', 'acres')}
            </p>
          )}

          {(savedIds.length > 0 || appliedIds.length > 0) && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-primary-600">
              {savedIds.length > 0 && (
                <div>
                  <p className="text-primary-200 text-xs">{t('சேமித்தது', 'Saved')}</p>
                  <p className="text-white font-bold text-lg">{savedIds.length}</p>
                </div>
              )}
              {appliedIds.length > 0 && (
                <div>
                  <p className="text-primary-200 text-xs">{t('விண்ணப்பித்தது', 'Applied')}</p>
                  <p className="text-white font-bold text-lg">{appliedIds.length}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile summary card */}
        <ProfileSummaryCard lang={lang} />

        {/* Daily crop cards — one per crop */}
        {localProfile.crops.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
              {t('இன்றைய பண்ணை பணி', "Today's Farm Tasks")}
              {isCalculating && (
                <span className="ml-2 text-gray-300 font-normal normal-case">
                  {t('கணக்கிட்டு வருகிறது…', 'Calculating…')}
                </span>
              )}
            </p>
            {localProfile.crops.map((crop) => (
              <CropDailyCard
                key={crop.id}
                crop={crop}
                record={todayByCrop[crop.id] ?? null}
                lang={lang as 'ta' | 'en'}
              />
            ))}
          </div>
        )}

        {/* Push notification opt-in */}
        <PushOptIn lang={lang as 'ta' | 'en'} />

        {/* Profile completion widget */}
        {completionPct > 0 && completionPct < 80 && (
          <ProfileCompletionWidget pct={completionPct} lang={lang} />
        )}

        {/* Onboarding nudge */}
        {!localProfile.onboardingComplete && completionPct < 20 && (
          <Link
            to="/profile/onboarding"
            className="flex items-center gap-3 card p-4 border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors"
          >
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary-900">{t('சுயவிவரம் அமை', 'Set up your profile')}</p>
              <p className="text-xs text-primary-600 mt-0.5">{t('2 நிமிடம் • சரியான திட்டங்கள் கண்டறி', '2 mins · find matching schemes')}</p>
            </div>
            <span className="text-primary-400">→</span>
          </Link>
        )}

        {/* Pillar grid */}
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2.5 px-1">
            {t('சேவைகள்', 'Services')}
          </p>
          <div className="space-y-3">
            {pillars.map(({ to, icon, ta, en, descTa, descEn, active, badge }) => (
              <Link
                key={to}
                to={to}
                className={`block card p-4 ${!active ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{t(ta, en)}</p>
                      {!active && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {t('விரைவில்', 'Soon')}
                        </span>
                      )}
                      {badge && (
                        <span className="text-[10px] text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full font-semibold">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{t(descTa, descEn)}</p>
                  </div>
                  <span className="text-gray-300 text-lg">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Helpline */}
        <a href="tel:1800-425-1551" className="block card p-4 flex items-center gap-3">
          <span className="text-3xl">📞</span>
          <div>
            <p className="text-sm font-medium text-gray-800">{t('கிசான் ஹெல்ப்லைன்', 'Kisan Helpline')}</p>
            <p className="text-xs text-gray-500">1800-425-1551</p>
          </div>
        </a>
      </div>
    </div>
  )
}
