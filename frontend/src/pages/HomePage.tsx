import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Scan, BookOpen, ChevronRight } from 'lucide-react'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { farmerApi } from '@/api/farmer'
import { useDailyEngine } from '@/lib/pillar2/useDailyEngine'
import { TN_CROPS } from '@/data/tn-options'
import type { FarmerCrop } from '@/types/profile'
import type { DailyRecord } from '@/types/dailyRecord'

function CropTaskCard({ crop, record }: { crop: FarmerCrop; record: DailyRecord | null }) {
  const cropInfo = TN_CROPS.find((c) => c.value === crop.name)
  const cropLabel = cropInfo ? cropInfo.ta : crop.name
  const cropLabelEn = cropInfo ? cropInfo.en : crop.name

  const needsAction = record?.fertilizer_due || record?.irrigation_recommended === 'irrigate'

  const fertLine = record
    ? record.fertilizer_due
      ? 'இன்று உரம் இட வேண்டும்'
      : null
    : null

  const waterLine = record
    ? record.irrigation_recommended === 'irrigate'
      ? `நீர் பாய்ச்சவும் — ${record.irrigation_minutes} நிமிடம்`
      : record.irrigation_recommended === 'skip_rain'
      ? 'மழை — நீர் தேவையில்லை'
      : null
    : null

  const stageLine = record
    ? `${record.display_stage_ta} · நாள் ${record.stage_days}`
    : null

  return (
    <Link
      to={`/soil-optimizer?crop=${crop.id}`}
      className="block rounded-xl bg-white border overflow-hidden"
      style={{
        borderColor: '#D1D5DB',
        borderLeft: needsAction ? '3px solid #F59E0B' : '3px solid #0A5C47',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="px-4 py-3"
        style={{ backgroundColor: needsAction ? '#FEF3C7' : '#E8F5F1' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>
              {cropLabel}
              {cropLabelEn !== cropLabel && (
                <span className="ml-1 font-normal text-xs" style={{ color: '#6B7280' }}>({cropLabelEn})</span>
              )}
              {crop.acres > 0 && (
                <span className="ml-2 text-xs font-normal" style={{ color: '#6B7280' }}>· {crop.acres} ஏக்கர்</span>
              )}
            </p>
          </div>
          {stageLine && (
            <span className="text-xs" style={{ color: '#6B7280' }}>{stageLine}</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {(fertLine || waterLine) ? (
          <div className="space-y-1">
            {fertLine && (
              <p className="text-sm font-medium" style={{ color: '#92400E' }}>{fertLine}</p>
            )}
            {waterLine && (
              <p className="text-sm" style={{ color: '#374151' }}>{waterLine}</p>
            )}
          </div>
        ) : record ? (
          <p className="text-sm" style={{ color: '#6B7280' }}>இன்று எந்த பணியும் தேவையில்லை</p>
        ) : (
          <p className="text-sm" style={{ color: '#9CA3AF' }}>கணக்கிட்டு வருகிறது…</p>
        )}
        <p className="text-xs mt-2 font-medium flex items-center gap-1" style={{ color: '#0A5C47' }}>
          விரிவாக காண <ChevronRight size={12} />
        </p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { isLoggedIn, profile, setProfile, clearAuth } = useFarmerStore()
  const { resetUserData } = useSchemeStore()
  const { profile: localProfile, resetProfile } = useProfileStore()
  const { todayByCrop, isCalculating } = useDailyRecordStore()
  useDailyEngine()

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { replace: true })
      return
    }
    if (!profile) {
      farmerApi.getProfile()
        .then(setProfile)
        .catch(() => {})
    }
  }, [])

  function handleLogout() {
    resetProfile()
    resetUserData()
    clearAuth()
    navigate('/login', { replace: true })
  }

  const today = new Date().toLocaleDateString('ta-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Header — Forest green gradient */}
      <header className="sticky top-0 z-30 px-4 py-3" style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-base text-white">உழவர் AI</h1>
          <div className="flex items-center gap-2">
            {profile?.name && (
              <span className="text-sm" style={{ color: '#C5E8DC' }}>
                {profile.name}
                {profile.district && <span style={{ color: '#8FD1BE' }}> · {profile.district}</span>}
              </span>
            )}
            <Link
              to="/profile"
              className="p-1.5 rounded-full"
              style={{ color: '#C5E8DC' }}
              aria-label="சுயவிவரம்"
            >
              <User size={20} />
            </Link>
          </div>
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#8FD1BE' }}>{today}</p>
      </header>

      <div className="px-4 py-4 pb-24 space-y-5">
        {/* Today's farm tasks */}
        {localProfile.crops.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#0A5C47' }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#374151', letterSpacing: '0.05em' }}>
                இன்றைய பண்ணை பணி
              </p>
              {isCalculating && <span className="text-xs font-normal ml-1" style={{ color: '#D1D5DB' }}>கணக்கிட்டு வருகிறது…</span>}
            </div>
            {localProfile.crops.map((crop) => (
              <CropTaskCard
                key={crop.id}
                crop={crop}
                record={todayByCrop[crop.id] ?? null}
              />
            ))}
          </div>
        ) : (
          <Link
            to="/profile/onboarding"
            className="block rounded-xl bg-white border p-4"
            style={{ borderColor: '#D1D5DB', borderLeft: '3px solid #F59E0B', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>உங்கள் பயிர்களை சேர்க்கவும்</p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>தினசரி பண்ணை பணி பரிந்துரைகளை பெற</p>
          </Link>
        )}

        {/* Quick actions */}
        <div>
          <div className="flex items-center gap-2 px-1 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#374151', letterSpacing: '0.05em' }}>
              விரைவு செயல்கள்
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/crop-sentinel"
              className="flex items-center gap-3 rounded-xl px-4 py-3.5"
              style={{ backgroundColor: '#0A5C47', boxShadow: '0 2px 6px rgba(10,92,71,0.25)' }}
            >
              <Scan size={20} color="white" />
              <span className="text-sm font-semibold text-white">இலை ஸ்கேன்</span>
            </Link>
            <Link
              to="/navigator"
              className="flex items-center gap-3 rounded-xl px-4 py-3.5"
              style={{ backgroundColor: '#E8F5F1', border: '1px solid #C5E8DC', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <BookOpen size={20} color="#0A5C47" />
              <span className="text-sm font-semibold" style={{ color: '#0A5C47' }}>திட்டங்கள்</span>
            </Link>
          </div>
        </div>

        {/* Helpline */}
        <a
          href="tel:1800-425-1551"
          className="flex items-center gap-3 rounded-xl bg-white border px-4 py-3"
          style={{ borderColor: '#D1D5DB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: '#111827' }}>கிசான் ஹெல்ப்லைன்</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>1800-425-1551</p>
          </div>
          <ChevronRight size={16} color="#9CA3AF" />
        </a>

        {/* Logout — bottom of page, secondary style */}
        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="w-full rounded-xl border py-3 text-sm font-medium transition-colors"
            style={{ borderColor: '#D1D5DB', color: '#6B7280', backgroundColor: 'white' }}
          >
            வெளியேறு
          </button>
        </div>
      </div>
    </div>
  )
}
