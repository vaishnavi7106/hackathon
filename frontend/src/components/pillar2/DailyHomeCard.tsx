import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { useSoilStore } from '@/store/soilStore'
import type { DailyRecord, FertilizerApplication } from '@/types/dailyRecord'

// ---------------------------------------------------------------------------
// i18n labels
// ---------------------------------------------------------------------------

const L = {
  ta: {
    title: 'இன்றைய வேலை',
    soil_title: 'மண் பணி',
    water_title: 'நீர் பணி',
    loading: 'இன்றைய தரவு கணக்கிடுகிறது…',
    retry: 'மீண்டும் முயற்சி',
    no_profile: 'சுயவிவரம் அமைக்கவும்',
    soil_none: 'இன்று உரம் தேவையில்லை',
    soil_due: 'இன்று உரம் இட வேண்டும்!',
    next: 'அடுத்தது:',
    days_away: 'நாட்களில்',
    why: 'ஏன் இன்று? ▼',
    hide: 'மறை ▲',
    tnau_split: 'TNAU CPG 2020 பிரித்து இடுவதன் அட்டவணை — நடவு / துரவு / கதிர் தோற்றம் நிலைகளில்',
    bags: 'பை',
    total: 'மொத்தம்',
    confirm_fert: 'உரம் இட்டேன் ✓',
    confirmed_fert: '✅ உரம் இட்டது உறுதி',
    irrigate_heading: 'இந்த மாலை நீர் பாய்ச்சவும்',
    skip_rain: 'மழை — நீர்பாசனம் தேவையில்லை',
    skip_ok: 'ஈரம் போதுமானது — இன்று தேவையில்லை',
    min: 'நிமிடம்',
    crop_needs: 'பயிருக்கு தேவை',
    rain: 'மழை',
    est_cost: 'மதிப்பிட்ட செலவு ₹',
    how_calc: 'கணக்கீடு எப்படி? ▼',
    see_7day: '7 நாள் திட்டம் ▼',
    soil_tab_link: 'மண் தாவலில் 7 நாள் திட்டம் காண →',
    updated: 'புதுப்பிக்கப்பட்டது',
    confirm_irr: 'நீர் பாய்ச்சினேன் ✓',
    confirmed_irr: '✅ நீர்பாசனம் உறுதி',
    et0: 'ET₀',
    kc: 'Kc',
    deficit: 'குறைபாடு',
    stage: 'வளர்ச்சி நிலை',
    threshold: 'குறைபாடு 2mm-ஐ தாண்டும்போது நீர்பாசனம்',
    source: 'Hargreaves-Samani + OpenWeatherMap',
    tap_expand: 'விரிவாக காண ▼',
    tap_collapse: 'மூடு ▲',
    rainfed_skip: 'மழை நீர் பாசனம் — நீர்பாசனம் தேவையில்லை',
  },
  en: {
    title: "Today's Tasks",
    soil_title: 'Soil Task',
    water_title: 'Water Task',
    loading: "Calculating today's data…",
    retry: 'Retry',
    no_profile: 'Complete your profile first',
    soil_none: 'No fertilizer today',
    soil_due: 'Apply fertilizer today!',
    next: 'Next:',
    days_away: 'days away',
    why: 'Why today? ▼',
    hide: 'Hide ▲',
    tnau_split: 'Based on TNAU CPG 2020 split-application schedule — Transplanting / Tillering / Panicle Initiation stages',
    bags: 'bags',
    total: 'Total',
    confirm_fert: 'Done — Applied ✓',
    confirmed_fert: '✅ Application confirmed',
    irrigate_heading: 'Irrigate this evening',
    skip_rain: 'Rain received — skip irrigation',
    skip_ok: 'Moisture sufficient — skip today',
    min: 'min',
    crop_needs: 'Crop needs',
    rain: 'Rain',
    est_cost: 'Est. cost ₹',
    how_calc: 'How was this calculated? ▼',
    see_7day: '7-day plan ▼',
    soil_tab_link: 'View 7-day plan in Soil tab →',
    updated: 'Updated',
    confirm_irr: 'Done — Irrigated ✓',
    confirmed_irr: '✅ Irrigation confirmed',
    et0: 'ET₀',
    kc: 'Kc',
    deficit: 'Deficit',
    stage: 'Stage',
    threshold: 'Irrigate when deficit exceeds 2mm',
    source: 'Hargreaves-Samani + OpenWeatherMap',
    tap_expand: 'Expand ▼',
    tap_collapse: 'Collapse ▲',
    rainfed_skip: 'Rain-fed — no irrigation needed',
  },
} as const

type Lang = 'ta' | 'en'

// ---------------------------------------------------------------------------
// Soil Task Sub-card
// ---------------------------------------------------------------------------

function SoilSubCard({
  record,
  lang,
  onConfirm,
}: {
  record: DailyRecord
  lang: Lang
  onConfirm: () => void
}) {
  const t = L[lang]
  const [open, setOpen] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  const due = record.fertilizer_due
  const app: FertilizerApplication | null = record.fertilizer_application ?? null
  const confirmed = record.fertilizer_confirmed === true

  // Next fertilizer info
  const nf = record.next_fertilizer
  const daysUntilNext = nf ? nf.day - record.stage_days : null
  const stageName = lang === 'ta' ? record.display_stage_ta : record.display_stage

  // Items to display (filter zero-bag items)
  const items = (app?.items ?? []).filter((it) => it.bags > 0)

  return (
    <div className="rounded-xl overflow-hidden border border-amber-100">
      {/* ── Collapsed header (always visible) ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: '#FFF8F0' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{due ? '🟡' : '✅'}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">{t.soil_title}</p>
            <p className="text-sm font-semibold text-gray-800 truncate">
              {due ? t.soil_due : t.soil_none}
            </p>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0 ml-2">{open ? t.tap_collapse : t.tap_expand}</span>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="bg-white border-t border-amber-100 p-4 space-y-3">

          {/* Stage name chip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
              {stageName}
            </span>
            <span className="text-xs text-gray-500">
              {lang === 'ta' ? `நாள் ${record.stage_days}` : `Day ${record.stage_days}`}
            </span>
          </div>

          {/* Fertilizer due — what to apply */}
          {due && app && items.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: '#FFF8F0' }}>
              {items.map((it) => (
                <div key={it.name} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{it.name}</span>
                  <span className="text-sm text-amber-700 font-bold">
                    {it.bags} {t.bags} · ₹{it.total}
                  </span>
                </div>
              ))}
              <div className="border-t border-amber-100 pt-2 flex justify-between text-xs font-bold text-gray-700">
                <span>{t.total}</span>
                <span>₹{app.total_cost}</span>
              </div>
            </div>
          )}

          {/* Not due — next fertilizer */}
          {!due && nf && daysUntilNext !== null && daysUntilNext > 0 && (
            <p className="text-sm text-gray-600">
              {t.next}{' '}
              <span className="font-semibold text-amber-700">
                {lang === 'ta' ? nf.stage_ta : nf.stage}
              </span>{' '}
              — {daysUntilNext} {t.days_away}
            </p>
          )}

          {/* Why today toggle */}
          {due && (
            <>
              <button
                className="text-xs text-gray-400 flex items-center gap-1"
                onClick={() => setShowWhy((v) => !v)}
              >
                {showWhy ? t.hide : t.why}
              </button>
              {showWhy && (
                <div className="rounded-xl px-3 py-2.5 text-xs text-amber-800 space-y-1.5" style={{ background: '#FFFBEB' }}>
                  <p className="font-semibold text-amber-900">
                    {lang === 'ta'
                      ? `${stageName} நிலையில் (நாள் ${record.stage_days}) இட வேண்டும்`
                      : `Apply at ${stageName} stage (Day ${record.stage_days})`}
                  </p>
                  <p className="text-amber-700 leading-relaxed">{t.tnau_split}</p>
                </div>
              )}
            </>
          )}

          {/* Confirm button */}
          {due && (
            <button
              onClick={onConfirm}
              disabled={confirmed}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: confirmed ? '#D1FAE5' : '#D97706',
                color: confirmed ? '#065F46' : '#fff',
              }}
            >
              {confirmed ? t.confirmed_fert : t.confirm_fert}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Water Task Sub-card
// ---------------------------------------------------------------------------

function WaterSubCard({
  record,
  lang,
  weeklySchedule,
  onConfirm,
}: {
  record: DailyRecord
  lang: Lang
  weeklySchedule: Array<{
    day_of_week: string
    action: string
    duration_min: number | null
    et0_mm: number
    rainfall_mm: number
    net_deficit_mm: number
    note?: string
  }> | null
  onConfirm: () => void
}) {
  const t = L[lang]
  const [open, setOpen] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [show7Day, setShow7Day] = useState(false)

  const action = record.irrigation_recommended
  const minutes = record.irrigation_minutes
  const confirmed = record.irrigation_confirmed === true
  const et0 = record.et0_mm ?? 0
  const kc = record.kc_used ?? 0
  const etc = record.crop_water_need_mm ?? 0
  const rain = record.weather?.rain_mm ?? 0
  const stage = lang === 'ta' ? record.display_stage_ta : record.display_stage

  const isIrrigate = action === 'irrigate'
  const isSkipRain = action === 'skip_rain'
  const isRainfed = action === 'skip' && record.irrigation_recommended === 'skip'

  // Rough electricity cost: ₹8/hr for TN pumps
  const estCost = minutes ? Math.round((minutes / 60) * 8) : null

  // Summary line for collapsed header
  let summaryText = t.skip_ok
  if (isIrrigate) summaryText = `${t.irrigate_heading} — ${minutes} ${t.min}`
  else if (isSkipRain) summaryText = t.skip_rain

  // Weather timestamp
  const pulledAt = record.weather?.pulled_at
  const timeStr = pulledAt
    ? new Date(pulledAt).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-xl overflow-hidden border border-blue-100">
      {/* ── Collapsed header ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: '#F0F9FF' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{isIrrigate ? '💧' : '✅'}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">{t.water_title}</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{summaryText}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0 ml-2">{open ? t.tap_collapse : t.tap_expand}</span>
      </button>

      {/* ── Always-visible weather timestamp ── */}
      {timeStr && (
        <div className="px-4 py-1.5 border-t border-blue-50 flex items-center gap-1.5" style={{ background: '#F0F9FF' }}>
          <span className="text-xs text-blue-400">🛰</span>
          <span className="text-xs text-blue-500">
            {t.updated}: {timeStr} · OpenWeatherMap
          </span>
        </div>
      )}

      {/* ── Expanded body ── */}
      {open && (
        <div className="bg-white border-t border-blue-100 p-4 space-y-3">

          {/* Stage chip — Kc moved to expandable "How calculated?" section only */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
              {stage}
            </span>
          </div>

          {/* Main action card */}
          <div
            className="rounded-xl p-4 border-2"
            style={
              isIrrigate
                ? { background: '#EFF6FF', borderColor: '#BFDBFE' }
                : { background: '#F0FDF4', borderColor: '#BBF7D0' }
            }
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{isIrrigate ? '💧' : '✅'}</span>
              <div className="flex-1">
                <p className="font-bold text-base" style={{ color: isIrrigate ? '#1D4ED8' : '#15803D' }}>
                  {isIrrigate
                    ? `${t.irrigate_heading} — ${minutes} ${t.min}`
                    : isSkipRain
                    ? t.skip_rain
                    : t.skip_ok}
                </p>

                {/* Plain-language sentence — no label:value pairs, no ET₀/Kc */}
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {isIrrigate && rain > 0
                    ? lang === 'ta'
                      ? `${rain.toFixed(1)}mm மழை பெய்தது. பயிருக்கு சுமார் ${etc.toFixed(1)}mm தேவை. இன்று மாலை ${minutes} நிமிடம் நீர் பாய்ச்சவும்.`
                      : `It rained ${rain.toFixed(1)}mm. Your crop needs about ${etc.toFixed(1)}mm. Irrigate for ${minutes} minutes this evening.`
                    : isIrrigate
                    ? lang === 'ta'
                      ? `பயிருக்கு சுமார் ${etc.toFixed(1)}mm தேவை. இன்று மாலை ${minutes} நிமிடம் நீர் பாய்ச்சவும்.`
                      : `Your crop needs about ${etc.toFixed(1)}mm. Irrigate for ${minutes} minutes this evening.`
                    : isSkipRain
                    ? lang === 'ta'
                      ? `${rain.toFixed(1)}mm மழை பெய்தது — இன்று பயிருக்கு போதுமானது.`
                      : `It rained ${rain.toFixed(1)}mm — enough for your crop today.`
                    : lang === 'ta'
                    ? 'இன்று மண்ணில் ஈரம் போதுமானது.'
                    : 'Soil moisture is sufficient today.'}
                </p>

                {/* Est cost for irrigate */}
                {isIrrigate && estCost !== null && estCost > 0 && (
                  <p className="text-xs text-blue-600 mt-1.5 font-medium">
                    {t.est_cost}{estCost}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* How calculated — expandable (ET₀, Kc, deficit ONLY here) */}
          <button
            className="text-xs text-gray-400 flex items-center gap-1"
            onClick={() => setShowCalc((v) => !v)}
          >
            {showCalc ? t.hide : t.how_calc}
          </button>
          {showCalc && (
            <div className="rounded-xl p-3 space-y-2 text-xs" style={{ background: '#F8F9FA' }}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg py-2" style={{ background: '#EFF6FF' }}>
                  <p className="text-gray-500">{t.et0}</p>
                  <p className="font-bold text-blue-700">{et0.toFixed(2)} mm</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: '#EFF6FF' }}>
                  <p className="text-gray-500">{t.kc} ({stage})</p>
                  <p className="font-bold text-blue-700">{kc.toFixed(2)}</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: isIrrigate ? '#FEF2F2' : '#F0FDF4' }}>
                  <p className="text-gray-500">{t.deficit}</p>
                  <p className={`font-bold ${isIrrigate ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.max(0, etc - rain).toFixed(2)} mm
                  </p>
                </div>
              </div>
              <p className="text-gray-500 text-center">{t.threshold}</p>
              <p className="text-gray-400 text-center">{t.source}</p>
            </div>
          )}

          {/* 7-day plan — expandable */}
          <button
            className="text-xs text-gray-400 flex items-center gap-1"
            onClick={() => setShow7Day((v) => !v)}
          >
            {show7Day ? t.hide : t.see_7day}
          </button>
          {show7Day && (
            <div className="space-y-1.5">
              {weeklySchedule && weeklySchedule.length > 0 ? (
                weeklySchedule.map((day, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs border"
                    style={
                      day.action === 'irrigate'
                        ? { background: '#EFF6FF', borderColor: '#BFDBFE' }
                        : { background: '#F0FDF4', borderColor: '#BBF7D0' }
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-500 w-8 shrink-0">
                        {day.day_of_week.slice(0, 3)}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: day.action === 'irrigate' ? '#1D4ED8' : '#15803D' }}
                      >
                        {day.action === 'irrigate'
                          ? `💧 ${day.duration_min} ${t.min}`
                          : '✅ Skip'}
                      </span>
                    </div>
                    <div className="text-gray-400 text-right">
                      ET₀: {day.et0_mm.toFixed(1)}
                      {day.rainfall_mm > 0 && ` · 🌧 ${day.rainfall_mm.toFixed(1)}`}
                    </div>
                  </div>
                ))
              ) : (
                <Link
                  to="/soil-optimizer"
                  className="block text-center text-xs text-blue-600 font-semibold py-2 rounded-xl border border-blue-200 bg-blue-50"
                >
                  {t.soil_tab_link}
                </Link>
              )}
            </div>
          )}

          {/* Confirm button */}
          {isIrrigate && (
            <button
              onClick={onConfirm}
              disabled={confirmed}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: confirmed ? '#D1FAE5' : '#1D4ED8',
                color: confirmed ? '#065F46' : '#fff',
              }}
            >
              {confirmed ? t.confirmed_irr : t.confirm_irr}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main DailyHomeCard
// ---------------------------------------------------------------------------

export function DailyHomeCard({
  lang,
  cropId,
  isCalculating,
  error,
  onRetry,
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

  if (isCalculating || (todayIsStale && !today)) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div className="px-4 py-3" style={{ background: '#1B4332' }}>
          <p className="text-xs font-bold tracking-wide text-green-300 uppercase">{t.title}</p>
        </div>
        <div className="bg-white p-4 space-y-3 animate-pulse">
          <div className="h-14 rounded-xl bg-amber-50" />
          <div className="h-14 rounded-xl bg-blue-50" />
          <p className="text-xs text-center text-gray-400">{t.loading}</p>
        </div>
      </div>
    )
  }

  if (!profile.district || profile.crops.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div className="px-4 py-3" style={{ background: '#1B4332' }}>
          <p className="text-xs font-bold tracking-wide text-green-300 uppercase">{t.title}</p>
        </div>
        <div className="bg-white p-4 text-center">
          <p className="text-sm text-gray-500">{t.no_profile}</p>
          <Link to="/profile/onboarding" className="text-xs text-primary-600 font-semibold mt-1 inline-block underline">
            {lang === 'ta' ? 'சுயவிவரம் அமை →' : 'Set up profile →'}
          </Link>
        </div>
      </div>
    )
  }

  if (error && !today) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div className="px-4 py-3" style={{ background: '#1B4332' }}>
          <p className="text-xs font-bold tracking-wide text-green-300 uppercase">{t.title}</p>
        </div>
        <div className="bg-white p-4 text-center">
          <p className="text-xs text-red-500 mb-2">{error}</p>
          {onRetry && (
            <button
              className="text-xs px-3 py-1.5 rounded-full bg-green-700 text-white font-semibold"
              onClick={onRetry}
            >
              {t.retry}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!today) return null

  const record: DailyRecord = today

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <div className="px-4 py-3" style={{ background: '#1B4332' }}>
        <p className="text-xs font-bold tracking-wide text-green-300 uppercase">{t.title}</p>
        <p className="text-xs text-green-400 mt-0.5">
          {lang === 'ta'
            ? `${record.display_stage_ta} · நாள் ${record.stage_days}`
            : `${record.display_stage} · Day ${record.stage_days}`}
        </p>
      </div>

      <div className="bg-gray-50 p-3 space-y-2">
        <SoilSubCard
          record={record}
          lang={lang}
          onConfirm={() => confirmFertilizerForCrop(cropId, record.date, true)}
        />
        <WaterSubCard
          record={record}
          lang={lang}
          weeklySchedule={weeklySchedule}
          onConfirm={() => confirmIrrigationForCrop(cropId, record.date, true)}
        />
      </div>
    </div>
  )
}
