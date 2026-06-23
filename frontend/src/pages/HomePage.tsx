import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Droplet, Sprout, CloudRain, CheckCircle, Camera, Landmark, ChevronRight, TrendingUp, FlaskConical, TrendingDown, LogOut } from 'lucide-react'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useForecastStore } from '@/store/forecastStore'
import { farmerApi } from '@/api/farmer'
import { useDailyEngine } from '@/lib/pillar2/useDailyEngine'
import { TN_CROPS } from '@/data/tn-options'
import { NotificationBell } from '@/components/NotificationBell'
import type { FarmerCrop } from '@/types/profile'
import type { DailyRecord } from '@/types/dailyRecord'

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function tamilDate() {
  return new Date().toLocaleDateString('ta-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function wxLabel(rain_mm: number, temp_c: number): { text: string; emoji: string } {
  if (rain_mm >= 8)  return { text: 'மழை பெய்கிறது',    emoji: '🌧️' }
  if (rain_mm >= 2)  return { text: 'இலேசான மழை',       emoji: '🌦️' }
  if (temp_c >= 37)  return { text: 'அதிக வெப்பம்',     emoji: '☀️'  }
  if (temp_c >= 32)  return { text: 'சூடான நாள்',       emoji: '🌤️' }
  return               { text: 'மிதமான வானிலை',        emoji: '⛅'  }
}

function rainChance(mm: number) {
  if (mm >= 10) return 85
  if (mm >= 5)  return 65
  if (mm >= 1)  return 35
  return 10
}

function cropTa(name: string) {
  return TN_CROPS.find((c) => c.value === name)?.ta ?? name
}

// ─── Weather Widget ───────────────────────────────────────────────────────────

function WeatherWidget({ record }: { record: DailyRecord | null }) {
  const wx = record?.weather
  if (!wx) return null

  const temp   = Math.round(wx.temp_c)
  const humid  = Math.round(wx.humidity_pct)
  const rainMm = wx.rain_mm ?? 0
  const { text, emoji } = wxLabel(rainMm, wx.temp_c)
  const chance = rainChance(rainMm)

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '12px 16px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Left: temp + condition */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 34, fontWeight: 300, color: '#0F172A', letterSpacing: '-1.5px', lineHeight: 1 }}>{temp}°</span>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{text}</span>
        </div>
        {/* Stats inline */}
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>💧 {humid}%</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>🌧 {chance}%</span>
        </div>
      </div>
      {/* Right: weather emoji */}
      <span style={{ fontSize: 42, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

type TaskRowProps = {
  to: string
  bg: string
  iconBg: string
  icon: React.ReactNode
  title: string
  subtitle: string
  titleIcon?: React.ReactNode
}

function TaskRow({ to, bg, iconBg, icon, title, subtitle, titleIcon }: TaskRowProps) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: bg, borderRadius: 14, padding: '14px 16px',
      textDecoration: 'none',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 22, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 5 }}>
          {titleIcon && <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{titleIcon}</span>}
          {title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748B' }}>{subtitle}</p>
      </div>
      <ChevronRight size={16} color="#CBD5E1" />
    </Link>
  )
}

function CropTaskRows({ crop, record }: { crop: FarmerCrop; record: DailyRecord | null }) {
  const ta = cropTa(crop.name)

  if (!record) return (
    <TaskRow
      to={`/soil-optimizer?crop=${crop.id}`}
      bg="#F8FAF8" iconBg="#DCFCE7"
      icon={<Sprout size={20} color="#16A34A" />}
      title={ta}
      subtitle="கணக்கிட்டு வருகிறது…"
    />
  )

  const irrigate = record.irrigation_recommended === 'irrigate'
  const rainSkip = record.irrigation_recommended === 'skip_rain'
  const fertDue  = record.fertilizer_due

  return (
    <>
      {irrigate && (
        <TaskRow
          to={`/soil-optimizer?crop=${crop.id}`}
          bg="#EFF8FF" iconBg="#DBEAFE"
          icon={<Droplet size={20} color="#2563EB" fill="#93C5FD" />}
          titleIcon={<Droplet size={13} color="#2563EB" fill="#93C5FD" />}
          title={ta}
          subtitle={`நீர்ப்பாசனம் — ${record.irrigation_minutes} நிமிடம் · காலை`}
        />
      )}
      {fertDue && record.fertilizer_application && (
        <TaskRow
          to={`/soil-optimizer?crop=${crop.id}`}
          bg="#FFFBF0" iconBg="#FEF3C7"
          icon={<FlaskConical size={20} color="#D97706" />}
          titleIcon={<FlaskConical size={13} color="#D97706" />}
          title={ta}
          subtitle={`${record.fertilizer_application.stage_ta} · ${record.fertilizer_application.items[0]?.name ?? 'உரம்'} இடவும்`}
        />
      )}
      {rainSkip && (
        <TaskRow
          to={`/soil-optimizer?crop=${crop.id}`}
          bg="#F5F3FF" iconBg="#EDE9FE"
          icon={<CloudRain size={20} color="#6366F1" />}
          title={ta}
          subtitle="மழை இன்று — நீர் தேவையில்லை"
        />
      )}
      {!irrigate && !fertDue && !rainSkip && (
        <Link to={`/soil-optimizer?crop=${crop.id}`} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#F0FDF4', borderRadius: 14, padding: '12px 16px',
          textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={20} color="#16A34A" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{ta}</p>
            <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#16A34A', fontWeight: 600 }}>அமைதியான நாள்</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B' }}>
                <Droplet size={11} color="#93C5FD" fill="#93C5FD" />
                நீர் தேவையில்லை
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748B' }}>
                <FlaskConical size={11} color="#86EFAC" />
                உரம் தேவையில்லை
              </span>
            </div>
          </div>
          <ChevronRight size={16} color="#CBD5E1" />
        </Link>
      )}
    </>
  )
}

// ─── Market Card ──────────────────────────────────────────────────────────────

function MarketCard({ crops, district }: { crops: FarmerCrop[]; district: string }) {
  const [data, setData] = useState<{ recommendation: string; price: number; gain: number } | null>(null)
  const cropName = crops[0]?.name ?? ''
  const ta = cropTa(cropName)

  useEffect(() => {
    if (!district || !cropName) return
    import('@/api/client').then(({ api }) => {
      api.post<any>('/forecast', { crop: cropName, district, storage_type: 'home' })
        .then((r) => r?.recommendation && setData({ recommendation: r.recommendation, price: r.current_price ?? 0, gain: r.net_gain ?? 0 }))
        .catch(() => {})
    })
  }, [district, cropName])

  const isSell = data?.recommendation === 'SELL'

  return (
    <Link to="/market" style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: '#FFFBF0', borderRadius: 16,
      padding: '16px 18px', textDecoration: 'none',
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      border: '1px solid #FEF3C7',
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 22, background: '#FEF3C7',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <TrendingUp size={20} color="#D97706" />
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          சந்தை அறிவுரை · {ta}
        </p>
        {data ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'white',
              background: isSell ? '#DC2626' : '#0A5C47',
              padding: '2px 8px', borderRadius: 6,
            }}>
              {isSell ? 'SELL' : 'HOLD'}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#78350F', letterSpacing: '-0.5px' }}>
              ₹{data.price.toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: 11, color: '#B45309' }}>/குவி.</span>
          </div>
        ) : (
          <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: '#92400E' }}>
            சந்தை விலை காண தட்டவும்
          </p>
        )}
        {data?.gain && data.gain > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: isSell ? '#DC2626' : '#059669' }}>
            {isSell ? '▲ இப்போது விற்க நல்ல நேரம்' : `▲ ₹${data.gain.toLocaleString('en-IN')} லாப வாய்ப்பு`}
          </p>
        )}
      </div>

      <ChevronRight size={16} color="#CBD5E1" />
    </Link>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { isLoggedIn, profile: serverProfile, setProfile, clearAuth } = useFarmerStore()
  const { resetUserData } = useSchemeStore()
  const { profile: lp, resetProfile } = useProfileStore()
  const { todayByCrop, isCalculating } = useDailyRecordStore()
  const { savedIds, appliedIds } = useSchemeStore()
  const { notifications, markRead } = useNotificationStore()
  const activeForecast = useForecastStore((s) => s.getActive())
  useDailyEngine()

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    if (!serverProfile) farmerApi.getProfile().then(setProfile).catch(() => {})
  }, [])

  const name     = serverProfile?.name || lp.name || ''
  const district = serverProfile?.district || lp.district || ''
  const lang     = lp.language as 'ta' | 'en'

  const firstId  = lp.crops[0]?.id
  const firstRec = firstId ? (todayByCrop[firstId] ?? null) : null

  const approvedCount = appliedIds.length
  const pendingCount  = savedIds.filter((id) => !appliedIds.includes(id)).length
  const hasSchemes    = approvedCount + pendingCount > 0

  const diseaseNotif  = notifications.find((n) => n.type === 'disease' && !n.is_read) ?? null

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>

        <img src="/banner.png" alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />

        {/* Overlay — keeps text legible without killing the image */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(175deg, rgba(4,30,18,0.72) 0%, rgba(8,50,30,0.45) 55%, rgba(8,50,30,0.08) 100%)',
        }} />

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 72,
          background: 'linear-gradient(to bottom, transparent, #F5F6F5)',
        }} />

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', padding: '14px 16px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {/* Logo as blended sticker — mix-blend-mode makes it feel part of the scene */}
            <img
              src="/logo.png" alt=""
              style={{ width: 32, height: 32, objectFit: 'contain', mixBlendMode: 'screen', opacity: 0.92 }}
            />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>உழவர் AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 17,
                background: 'rgba(255,255,255,0.18)',
                border: '1.5px solid rgba(255,255,255,0.35)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white',
              }}>
                {initials(name) || '?'}
              </div>
            </Link>
          </div>
        </div>

        {/* Welcome text */}
        <div style={{ position: 'absolute', bottom: 42, left: 18, zIndex: 2 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {tamilDate()}
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            வணக்கம்{name ? `, ${name.split(' ')[0]}` : ''} 👋
          </p>
          {district && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.88)', display: 'flex', alignItems: 'center', gap: 4 }}>
              📍 {district}, தமிழ்நாடு
            </p>
          )}
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Weather Widget */}
        {firstRec?.weather && (
          <WeatherWidget record={firstRec} />
        )}

        {/* Disease alert */}
        {diseaseNotif && (
          <div
            onClick={() => { markRead(diseaseNotif.notification_id); navigate(diseaseNotif.action_route ?? '/crop-sentinel') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#FFF1F2', borderRadius: 14, padding: '12px 16px',
              border: '1px solid #FECACA', cursor: 'pointer',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 19, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🔬</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                {lang === 'ta' ? diseaseNotif.title_ta : diseaseNotif.title_en}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#B91C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lang === 'ta' ? diseaseNotif.body_ta : diseaseNotif.body_en}
              </p>
            </div>
            <ChevronRight size={15} color="#FCA5A5" />
          </div>
        )}

        {/* Farm Tasks */}
        <section>
          <p style={sectionLabel}>🌿 இன்று செய்ய வேண்டியவை {isCalculating && <span style={{ fontWeight: 400, color: '#CBD5E1' }}>· கணக்கிடுகிறது</span>}</p>

          {lp.crops.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lp.crops.map((crop) => (
                <CropTaskRows key={crop.id} crop={crop} record={todayByCrop[crop.id] ?? null} />
              ))}
            </div>
          ) : (
            <Link to="/profile/onboarding" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'white', borderRadius: 14, padding: '14px 16px',
              textDecoration: 'none', border: '1px dashed #D1D5DB',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sprout size={20} color="#16A34A" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>பயிரை சேர்க்கவும்</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>தினசரி பண்ணை பணி பரிந்துரைகள் பெற</p>
              </div>
              <ChevronRight size={16} color="#CBD5E1" />
            </Link>
          )}
        </section>

        {/* Active market alert — shown only when farmer has an active HOLD/SELL forecast */}
        {activeForecast ? (
          <Link to="/market" style={{ textDecoration: 'none' }}>
            <div style={{
              borderRadius: 16, padding: '14px 16px',
              background: activeForecast.recommendation === 'SELL' ? '#FFF1F2' : '#ECFDF5',
              border: `1px solid ${activeForecast.recommendation === 'SELL' ? '#FECACA' : '#A7F3D0'}`,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22, flexShrink: 0,
                background: activeForecast.recommendation === 'SELL' ? '#FEE2E2' : '#D1FAE5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {activeForecast.recommendation === 'SELL'
                  ? <TrendingDown size={20} color="#DC2626" />
                  : <TrendingUp size={20} color="#059669" />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: activeForecast.recommendation === 'SELL' ? '#DC2626' : '#059669' }}>
                  சந்தை அறிவுரை
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: activeForecast.recommendation === 'SELL' ? '#991B1B' : '#065F46' }}>
                  {activeForecast.cropTa}:{' '}
                  {activeForecast.recommendation === 'SELL'
                    ? `இப்போதே விற்கவும் ${activeForecast.priceAtForecast ? `₹${activeForecast.priceAtForecast.toLocaleString('en-IN')}` : ''}`
                    : `${activeForecast.weeksToHold ?? ''} வாரம் காத்திரு`}
                </p>
                {activeForecast.netGainTotal != null && activeForecast.recommendation === 'HOLD' && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#059669' }}>
                    ▲ ₹{activeForecast.netGainTotal.toLocaleString('en-IN')} லாப வாய்ப்பு · {activeForecast.quantity} குவி.
                  </p>
                )}
              </div>
              <ChevronRight size={16} color="#CBD5E1" />
            </div>
          </Link>
        ) : lp.crops.length > 0 && (
          <section>
            <p style={sectionLabel}>📈 சந்தை</p>
            <MarketCard crops={lp.crops} district={district} />
          </section>
        )}

        {/* Scheme applied banner — only if farmer has applied to any scheme */}
        {appliedIds.length > 0 && (
          <Link to="/navigator/saved" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#F0FDF4', borderRadius: 14, padding: '12px 16px',
              border: '1px solid #BBF7D0',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                🏛️
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  திட்ட நிலை
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                  {appliedIds.length} திட்டத்தில் விண்ணப்பிக்கப்பட்டது ✓
                </p>
                {savedIds.filter(id => !appliedIds.includes(id)).length > 0 && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                    + {savedIds.filter(id => !appliedIds.includes(id)).length} நிலுவையில் உள்ளது
                  </p>
                )}
              </div>
              <ChevronRight size={15} color="#86EFAC" />
            </div>
          </Link>
        )}

        {/* Quick Actions */}
        <section>
          <p style={sectionLabel}>⚡ விரைவான செயல்கள்</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            <Link to="/crop-sentinel" style={actionCard}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={22} color="#059669" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>இலை ஸ்கேன்</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>நோய் கண்டறிய</p>
              </div>
            </Link>

            <Link to="/navigator" style={actionCard}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Landmark size={22} color="#2563EB" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>திட்டங்கள்</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>அரசு உதவிகள்</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Saved-only scheme nudge — only show if has saved but NOT applied yet */}
        {pendingCount > 0 && appliedIds.length === 0 && (
          <Link to="/navigator/saved" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white', borderRadius: 14, padding: '14px 16px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Landmark size={20} color="#D97706" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                  ⏳ {pendingCount} திட்டங்கள் விண்ணப்பம் காத்திருக்கின்றன
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>
                  இப்போது விண்ணப்பிக்கவும்
                </p>
              </div>
              <ChevronRight size={16} color="#CBD5E1" />
            </div>
          </Link>
        )}

        {/* Helpline */}
        <a href="tel:1800-425-1551" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'white', borderRadius: 14, padding: '12px 16px',
          textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 19, background: '#F0F9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
            📞
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1E293B' }}>கிசான் ஹெல்ப்லைன்</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#94A3B8' }}>1800-425-1551 · இலவசம்</p>
          </div>
          <ChevronRight size={14} color="#CBD5E1" />
        </a>

        {/* Logout */}
        <button
          onClick={() => { resetProfile(); clearAuth(); navigate('/login', { replace: true }) }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'white', color: '#DC2626', border: '1.5px solid #FECACA',
            borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <LogOut size={16} color="#DC2626" />
          வெளியேறு
        </button>

      </div>
    </div>
  )
}

// ─── shared styles ────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  margin: '4px 0 10px',
  fontSize: 11, fontWeight: 700,
  color: '#94A3B8',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

const actionCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
  background: 'white', borderRadius: 16, padding: '18px 16px',
  textDecoration: 'none',
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
}
