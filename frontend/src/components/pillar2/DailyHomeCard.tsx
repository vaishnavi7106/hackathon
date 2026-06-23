import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sun, Cloud, CloudRain, Droplets, Thermometer,
  Sprout, FlaskConical, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Info, Waves, Calendar,
} from 'lucide-react'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { useSoilStore } from '@/store/soilStore'
import { TN_CROPS } from '@/data/tn-options'
import type { DailyRecord } from '@/types/dailyRecord'

type Lang = 'ta' | 'en'

const L = {
  ta: {
    loading: 'இன்றைய தரவு கணக்கிடுகிறது…',
    retry: 'மீண்டும் முயற்சி',
    no_profile: 'சுயவிவரம் அமைக்கவும்',
    humidity: 'ஈரப்பதம்',
    rainfall: 'மழை',
    no_irrigation: 'நீர்பாசனம் தேவையில்லை',
    irrigate_today: 'இன்று மாலை நீர் பாய்ச்சவும்',
    rain_skip: 'மழை — நீர்பாசனம் வேண்டாம்',
    no_fertilizer: 'இன்று உரம் தேவையில்லை',
    fertilizer_today: 'இன்று உரம் இட வேண்டும்',
    next_fert_prefix: 'அடுத்து:',
    days_away: 'நாட்களில்',
    min: 'நிமிடம்',
    est_cost: 'மதிப்பிட்ட செலவு ₹',
    confirm_irr: 'நீர் பாய்ச்சினேன் ✓',
    confirmed_irr: 'நீர்பாசனம் உறுதி',
    bags: 'பை',
    total: 'மொத்தம்',
    confirm_fert: 'உரம் இட்டேன் ✓',
    confirmed_fert: 'உரம் இட்டது உறுதி',
    irrigation_plan: '5 நாள் நீர்பாசன திட்டம்',
    today_label: 'இன்று',
    tomorrow_label: 'நாளை',
    fertilizer_plan: 'உர அட்டவணை',
    done_label: 'முடிந்தது',
    upcoming_label: 'வரும்',
    today_task: 'இன்று',
    details: 'தொழில்நுட்ப விவரங்கள்',
    et0: 'ET₀',
    kc: 'Kc',
    deficit: 'குறைபாடு',
    threshold: 'குறைபாடு 2mm-ஐ தாண்டும்போது நீர்பாசனம்',
    source: 'Hargreaves-Samani + OpenWeatherMap',
    updated: 'புதுப்பிக்கப்பட்டது',
    tnau_note: 'TNAU CPG 2020 பிரித்து இடுவதன் அட்டவணை',
    crop_status: 'பயிர் நிலை',
    day_label: 'நாள்',
    acres: 'ஏக்கர்',
    tasks_today: 'இன்றைய வேலை',
    weather_today: 'இன்றைய வானிலை',
    growth: 'வளர்ச்சி',
  },
  en: {
    loading: "Calculating today's data…",
    retry: 'Retry',
    no_profile: 'Complete your profile first',
    humidity: 'Humidity',
    rainfall: 'Rain',
    no_irrigation: 'No irrigation today',
    irrigate_today: 'Irrigate this evening',
    rain_skip: 'Rain received — skip irrigation',
    no_fertilizer: 'No fertilizer today',
    fertilizer_today: 'Apply fertilizer today',
    next_fert_prefix: 'Next:',
    days_away: 'days away',
    min: 'min',
    est_cost: 'Est. cost ₹',
    confirm_irr: 'Done — Irrigated ✓',
    confirmed_irr: 'Irrigation confirmed',
    bags: 'bags',
    total: 'Total',
    confirm_fert: 'Done — Applied ✓',
    confirmed_fert: 'Application confirmed',
    irrigation_plan: '5-Day Irrigation Plan',
    today_label: 'Today',
    tomorrow_label: 'Tomorrow',
    fertilizer_plan: 'Fertilizer Schedule',
    done_label: 'Done',
    upcoming_label: 'Upcoming',
    today_task: 'Today',
    details: 'Scientific Details',
    et0: 'ET₀',
    kc: 'Kc',
    deficit: 'Deficit',
    threshold: 'Irrigate when deficit exceeds 2mm',
    source: 'Hargreaves-Samani + OpenWeatherMap',
    updated: 'Updated',
    tnau_note: 'TNAU CPG 2020 split-application schedule',
    crop_status: 'Crop Status',
    day_label: 'Day',
    acres: 'ac',
    tasks_today: "Today's Tasks",
    weather_today: "Today's Weather",
    growth: 'Growth',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WeatherIcon({ rain, humidity, size = 28 }: { rain: number; humidity: number; size?: number }) {
  if (rain > 2) return <CloudRain size={size} color="#2563EB" />
  if (rain > 0) return <CloudRain size={size} color="#60A5FA" />
  if (humidity > 78) return <Cloud size={size} color="#64748B" />
  return <Sun size={size} color="#F59E0B" />
}

function weatherBg(rain: number, humidity: number) {
  if (rain > 2) return { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB' }
  if (rain > 0) return { bg: '#EFF6FF', border: '#BFDBFE', accent: '#60A5FA' }
  if (humidity > 78) return { bg: '#F8FAFC', border: '#E2E8F0', accent: '#64748B' }
  return { bg: '#FFFBEB', border: '#FDE68A', accent: '#F59E0B' }
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </p>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DailyHomeCard({
  lang, cropId, isCalculating, error, onRetry,
}: {
  lang: Lang
  cropId: string
  isCalculating: boolean
  error: string | null
  onRetry?: () => void
}) {
  const t = L[lang]
  const { profile } = useProfileStore()
  const { todayByCrop, confirmFertilizerForCrop, confirmIrrigationForCrop } = useDailyRecordStore()
  const soilResult = useSoilStore((s) => s.result)
  const weeklySchedule = soilResult?.irrigation?.weekly_schedule ?? null

  const todayStr = new Date().toISOString().slice(0, 10)
  const today = todayByCrop[cropId] ?? null
  const todayIsStale = today?.date !== todayStr

  const [showDetails, setShowDetails] = useState(false)
  const [showFertDetails, setShowFertDetails] = useState(false)
  const [showIrrDetails, setShowIrrDetails] = useState(false)

  // ── Loading ──
  if (isCalculating || (todayIsStale && !today)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 80, background: 'white', borderRadius: 14, opacity: 0.5, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }} />
        ))}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>{t.loading}</p>
      </div>
    )
  }

  // ── No profile ──
  if (!profile.district || profile.crops.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 20, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748B' }}>{t.no_profile}</p>
        <Link to="/profile/onboarding" style={{ fontSize: 12, color: '#0A5C47', fontWeight: 700 }}>
          {lang === 'ta' ? 'சுயவிவரம் அமை →' : 'Set up profile →'}
        </Link>
      </div>
    )
  }

  // ── Error ──
  if (error && !today) {
    return (
      <div style={{ background: '#FEF2F2', borderRadius: 14, padding: '16px', textAlign: 'center', border: '1px solid #FECACA' }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#DC2626' }}>{error}</p>
        {onRetry && (
          <button onClick={onRetry} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 20, background: '#0A5C47', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            {t.retry}
          </button>
        )}
      </div>
    )
  }

  if (!today) return null

  const record: DailyRecord = today

  // ── Data shortcuts ──
  const weather = record.weather
  const rain = weather?.rain_mm ?? 0
  const humidity = weather?.humidity_pct ?? 0
  const temp = weather?.temp_c ?? null

  const action = record.irrigation_recommended
  const minutes = record.irrigation_minutes ?? 0
  const irrConfirmed = record.irrigation_confirmed === true
  const fertConfirmed = record.fertilizer_confirmed === true
  const fertDue = record.fertilizer_due
  const app = record.fertilizer_application
  const fertItems = (app?.items ?? []).filter((it) => it.bags > 0)
  const nf = record.next_fertilizer
  const daysUntilNext = nf ? nf.day - record.stage_days : null

  const isIrrigate = action === 'irrigate'
  const isSkipRain = action === 'skip_rain'
  const estCost = minutes ? Math.round((minutes / 60) * 8) : null

  const stageName = lang === 'ta' ? record.display_stage_ta : record.display_stage

  // Crop info from profile
  const cropObj = profile.crops.find((c) => c.id === cropId) ?? profile.crops[0]
  const cropEntry = TN_CROPS.find((c) => c.value === cropObj?.name)
  const cropLabel = cropEntry ? (lang === 'ta' ? cropEntry.ta : cropEntry.en) : (cropObj?.name ?? '')
  const cropAcres = cropObj?.acres ?? 0

  // Growth progress (cap at 100%)
  const TOTAL_DAYS = 120
  const progressPct = Math.min(100, Math.round((record.stage_days / TOTAL_DAYS) * 100))

  const wc = weatherBg(rain, humidity)

  const pulledAt = weather?.pulled_at
  const timeStr = pulledAt
    ? new Date(pulledAt).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── 1. WEATHER CARD ──────────────────────────────────────────────── */}
      {weather && (
        <div style={{ background: wc.bg, borderRadius: 16, padding: '14px 16px', border: `1px solid ${wc.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <WeatherIcon rain={rain} humidity={humidity} size={36} />
              <div>
                {temp !== null && (
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>{temp.toFixed(0)}°C</p>
                )}
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                  {rain > 0
                    ? `${rain.toFixed(1)}mm ${lang === 'ta' ? 'மழை' : 'rain'}`
                    : lang === 'ta' ? 'மழை இல்லை' : 'No rain'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Droplets size={13} color="#60A5FA" />
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{humidity}%</span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{t.humidity}</span>
              </div>
              {temp !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Thermometer size={13} color={wc.accent} />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{profile.district}</span>
                </div>
              )}
              {timeStr && (
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>{t.updated}: {timeStr}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. CROP STATUS CARD ──────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderLeft: '3px solid #0A5C47' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sprout size={20} color="#0A5C47" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{cropLabel}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>
                {cropAcres > 0 ? `${cropAcres} ${t.acres}` : ''}
                {cropAcres > 0 && stageName ? ' · ' : ''}
                {stageName}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0A5C47', lineHeight: 1 }}>{record.stage_days}</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#94A3B8' }}>{t.day_label}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.growth}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0A5C47' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 7, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #0A5C47, #12A07A)', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* ── 3. TODAY'S TASKS CARD ────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.tasks_today}</p>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Irrigation task row */}
          <button
            onClick={() => setShowIrrDetails((v) => !v)}
            style={{
              width: '100%', textAlign: 'left', border: `1px solid ${isIrrigate ? '#BFDBFE' : '#D1FAE5'}`, cursor: 'pointer', padding: '12px 14px',
              borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              background: isIrrigate ? '#F0F7FF' : '#F6FEF9',
            }}>
            <div style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isIrrigate ? '#DBEAFE' : '#D1FAE5' }}>
              {isIrrigate ? <Waves size={18} color="#1D4ED8" /> : <CheckCircle2 size={18} color="#0A5C47" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isIrrigate ? '#1D4ED8' : '#0A5C47' }}>
                {isIrrigate ? `${t.irrigate_today} — ${minutes} ${t.min}` : isSkipRain ? t.rain_skip : t.no_irrigation}
              </p>
              {isIrrigate && estCost !== null && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>{t.est_cost}{estCost}</p>
              )}
            </div>
            {isIrrigate && (
              <div style={{ color: '#94A3B8', flexShrink: 0 }}>
                {showIrrDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            )}
          </button>

          {/* Irrigation confirm + details */}
          {isIrrigate && showIrrDetails && (
            <div style={{ padding: '10px 14px', background: '#F8FAFF', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lang === 'ta' ? 'தேவை' : 'Need'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#1D4ED8' }}>{record.crop_water_need_mm.toFixed(1)}mm</p>
                </div>
                {rain > 0 && (
                  <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.rainfall}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#0A5C47' }}>{rain.toFixed(1)}mm</p>
                  </div>
                )}
                <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.min}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#1D4ED8' }}>{minutes}</p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); confirmIrrigationForCrop(cropId, record.date, true) }}
                disabled={irrConfirmed}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: irrConfirmed ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, background: irrConfirmed ? '#DCFCE7' : '#1D4ED8', color: irrConfirmed ? '#166534' : 'white' }}>
                {irrConfirmed ? t.confirmed_irr : t.confirm_irr}
              </button>
            </div>
          )}

          {/* Fertilizer task row */}
          <button
            onClick={() => fertDue && setShowFertDetails((v) => !v)}
            style={{
              width: '100%', textAlign: 'left', cursor: fertDue ? 'pointer' : 'default', padding: '12px 14px',
              borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              background: fertDue ? '#FFFBEB' : '#FFFAF5',
              border: `1px solid ${fertDue ? '#FDE68A' : '#FEE9D1'}`,
            }}>
            <div style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fertDue ? '#FEF3C7' : '#FFEDD5' }}>
              {fertDue ? <AlertCircle size={18} color="#D97706" /> : <CheckCircle2 size={18} color="#EA580C" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: fertDue ? '#D97706' : '#C2410C' }}>
                {fertDue ? t.fertilizer_today : t.no_fertilizer}
              </p>
              {!fertDue && nf && daysUntilNext !== null && daysUntilNext > 0 && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9A3412' }}>
                  {t.next_fert_prefix} {lang === 'ta' ? nf.stage_ta : nf.stage} — {daysUntilNext} {t.days_away}
                </p>
              )}
              {fertDue && app && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#92400E' }}>
                  {lang === 'ta' ? app.stage_ta : app.stage} · ₹{app.total_cost}
                </p>
              )}
            </div>
            {fertDue && (
              <div style={{ color: '#94A3B8', flexShrink: 0 }}>
                {showFertDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            )}
          </button>

          {/* Fertilizer items + confirm */}
          {fertDue && showFertDetails && app && (
            <div style={{ padding: '10px 14px', background: '#FFFBF0', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fertItems.map((it) => (
                <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'white', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FlaskConical size={14} color="#D97706" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{it.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#D97706' }}>{it.bags} {t.bags} · ₹{it.total}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid #FEF3C7' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{t.total}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#D97706' }}>₹{app.total_cost}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); confirmFertilizerForCrop(cropId, record.date, true) }}
                disabled={fertConfirmed}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: fertConfirmed ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, background: fertConfirmed ? '#DCFCE7' : '#D97706', color: fertConfirmed ? '#166534' : 'white' }}>
                {fertConfirmed ? t.confirmed_fert : t.confirm_fert}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. 5-DAY IRRIGATION TIMELINE ─────────────────────────────────── */}
      {weeklySchedule && weeklySchedule.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px 16px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Waves size={14} color="#2563EB" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.irrigation_plan}</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', gap: 6 }}>
            {weeklySchedule.slice(0, 5).map((day, i) => {
              const irrigate = day.action === 'irrigate'
              const dayLabel = i === 0 ? t.today_label : i === 1 ? t.tomorrow_label : day.day_of_week.slice(0, 3)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: '100%', paddingTop: 8, paddingBottom: 8, borderRadius: 10, background: irrigate ? '#DBEAFE' : '#DCFCE7', border: `1.5px solid ${irrigate ? '#93C5FD' : '#86EFAC'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {irrigate
                      ? <Waves size={17} color="#1D4ED8" />
                      : <CheckCircle2 size={17} color="#0A5C47" />}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? '#1E293B' : '#64748B', textAlign: 'center' }}>{dayLabel}</span>
                  {irrigate && day.duration_min && (
                    <span style={{ fontSize: 10, color: '#1D4ED8', fontWeight: 800 }}>{day.duration_min}m</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. FERTILIZER SCHEDULE ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '10px 16px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={14} color="#EA580C" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.fertilizer_plan}</span>
        </div>
        <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Today's dose if due */}
          {fertDue && app && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={14} color="#D97706" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#D97706' }}>{t.today_task}</p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: '#92400E' }}>{lang === 'ta' ? app.stage_ta : app.stage}</p>
              </div>
              {fertConfirmed && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0A5C47', background: '#DCFCE7', padding: '2px 8px', borderRadius: 6 }}>
                  {t.done_label}
                </span>
              )}
            </div>
          )}

          {/* Next upcoming */}
          {nf && daysUntilNext !== null && daysUntilNext > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFF7ED', borderRadius: 12, border: '1px solid #FED7AA' }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: '#FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={16} color="#EA580C" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#C2410C' }}>{t.upcoming_label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9A3412' }}>
                  {lang === 'ta' ? nf.stage_ta : nf.stage} — {daysUntilNext} {t.days_away}
                  {nf.date_estimate ? ` (${nf.date_estimate})` : ''}
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'white', background: '#EA580C', padding: '3px 10px', borderRadius: 8, flexShrink: 0 }}>+{daysUntilNext}d</span>
            </div>
          )}

          {/* All done state */}
          {!fertDue && (!nf || (daysUntilNext !== null && daysUntilNext <= 0)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #A7F3D0' }}>
              <CheckCircle2 size={16} color="#0A5C47" />
              <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 700 }}>{lang === 'ta' ? 'அனைத்து உரங்களும் முடிந்தன' : 'All fertilizer applications complete'}</p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* ── 6. SCIENTIFIC DETAILS (collapsed by default) ─────────────────── */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <button onClick={() => setShowDetails((v) => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#94A3B8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{t.details}</span>
          </div>
          {showDetails ? <ChevronUp size={15} color="#CBD5E1" /> : <ChevronDown size={15} color="#CBD5E1" />}
        </button>

        {showDetails && (
          <div style={{ padding: '4px 16px 14px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>{t.et0}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#2563EB' }}>{(record.et0_mm ?? 0).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: 9, color: '#94A3B8' }}>mm</p>
              </div>
              <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>{t.kc}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#2563EB' }}>{(record.kc_used ?? 0).toFixed(2)}</p>
                <p style={{ margin: 0, fontSize: 9, color: '#94A3B8' }}>{stageName}</p>
              </div>
              <div style={{ background: isIrrigate ? '#FEF2F2' : '#F0FDF4', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>{t.deficit}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: isIrrigate ? '#DC2626' : '#16A34A' }}>
                  {Math.max(0, record.crop_water_need_mm - rain).toFixed(2)}
                </p>
                <p style={{ margin: 0, fontSize: 9, color: '#94A3B8' }}>mm</p>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 10, color: '#CBD5E1', textAlign: 'center' }}>{t.threshold}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#CBD5E1', textAlign: 'center' }}>{t.source}</p>
          </div>
        )}
      </div>

    </div>
  )
}
