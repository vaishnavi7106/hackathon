import { useState } from 'react'
import type { IrrigationDay, PrescriptionResponse } from '@/types/soil'
import { getStageName } from '@/lib/pillar2/stageNames'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
  irrigationType?: string
  stageDays?: number
}

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const LABELS = {
  ta: {
    title: 'நீர்பாசன திட்டம்',
    subtitle: 'FAO-56 Kc × ET₀ அடிப்படையில்',
    today_action: 'இன்றைய நடவடிக்கை',
    irrigate: 'நீர் பாய்ச்சவும்',
    skip_rain: 'மழை — நீர்பாசனம் தேவையில்லை',
    skip_sufficient: 'போதுமான ஈரம் — தேவையில்லை',
    advisory: 'கவனிக்கவும்',
    min: 'நிமிடம்',
    week_plan: '7 நாள் திட்டம் ▼',
    hide_week: '7 நாள் திட்டம் மறை ▲',
    how_calculated: 'கணக்கீடு விவரங்கள் ▼',
    hide_calc: 'கணக்கீடு மறை ▲',
    weather_source: 'வானிலை ஆதாரம்',
    kc_title: 'பயிர் குணகம் (Kc)',
    kc_note: 'Kc = {kc} → வளர்ச்சி நிலை: {stage}',
    et0_title: 'ET₀ (தாவர ஆவியாதல்)',
    etc_formula: 'ETc = ET₀ × Kc (பயிருக்கு தேவையான நீர்)',
    deficit_formula: 'குறைபாடு = ETc − மழை அளவு',
    irrigate_decision: 'குறைபாடு {threshold}mm-ஐ தாண்டும்போது நீர்பாசனம் தேவை',
    pump_note: 'நிமிடங்கள் = குறைபாடு ÷ பம்ப் ஓட்ட வீதம்',
    no_weather: 'வானிலை தரவு கிடைக்கவில்லை',
    no_weather_note: 'திரும்பி முயற்சிக்கவும்.',
    crop_days: 'பயிர் நட்ட நாள்',
    et0: 'ET₀',
    rain: 'மழை',
    deficit: 'குறைபாடு',
    stage_label: 'வளர்ச்சி நிலை',
    kc_chip: 'Kc',
    irr_days: 'நீர்பாசன நாட்கள்',
    skip_days: 'தவிர்க்கும் நாட்கள்',
  },
  en: {
    title: 'Irrigation Plan',
    subtitle: 'FAO-56 Kc × ET₀ Method',
    today_action: "Today's Action",
    irrigate: 'Irrigate',
    skip_rain: 'Rain forecast — skip irrigation',
    skip_sufficient: 'Soil moisture sufficient — skip',
    advisory: 'Monitor soil moisture',
    min: 'min',
    week_plan: 'See 7-day plan ▼',
    hide_week: 'Hide 7-day plan ▲',
    how_calculated: 'How was this calculated? ▼',
    hide_calc: 'Hide calculation ▲',
    weather_source: 'Weather Source',
    kc_title: 'Crop Coefficient (Kc)',
    kc_note: 'Kc = {kc} → Growth stage: {stage}',
    et0_title: 'Reference Evapotranspiration (ET₀)',
    etc_formula: 'ETc = ET₀ × Kc (crop water requirement)',
    deficit_formula: 'Net deficit = ETc − Rainfall',
    irrigate_decision: 'Irrigate when deficit exceeds {threshold}mm threshold',
    pump_note: 'Duration (min) = deficit ÷ pump flow rate',
    no_weather: 'Weather data unavailable',
    no_weather_note: 'Please retry later.',
    crop_days: 'Days after transplanting',
    et0: 'ET₀',
    rain: 'Rain',
    deficit: 'Deficit',
    stage_label: 'Stage',
    kc_chip: 'Kc',
    irr_days: 'Irrigate days',
    skip_days: 'Skip days',
  },
}

const ACTION_STYLE: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  irrigate:         { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: '💧' },
  skip_rain:        { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', icon: '🌧' },
  skip_sufficient:  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: '✅' },
  advisory:         { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: '👁' },
}

// ---------------------------------------------------------------------------
// Today's decision card (always visible)
// ---------------------------------------------------------------------------

function TodayDecision({ day, t }: { day: IrrigationDay; t: typeof LABELS['en'] }) {
  const style = ACTION_STYLE[day.action] ?? ACTION_STYLE.advisory
  const actionText = (t as Record<string, string>)[day.action] ?? day.action

  return (
    <div
      className="rounded-2xl p-4 border-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{style.icon}</span>
        <div className="flex-1">
          <p className="text-lg font-extrabold" style={{ color: style.text }}>
            {actionText}
            {day.duration_min != null && (
              <span className="ml-2 text-base font-bold">— {day.duration_min} {t.min}</span>
            )}
          </p>
          {day.note && <p className="text-xs mt-0.5" style={{ color: style.text }}>{day.note}</p>}
        </div>
      </div>

      {/* ET₀ / Rain / Deficit mini-stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg p-1.5" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <p className="text-xs text-gray-500">{t.et0}</p>
          <p className="text-sm font-bold text-gray-700">{day.et0_mm.toFixed(1)} mm</p>
        </div>
        <div className="rounded-lg p-1.5" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <p className="text-xs text-gray-500">{t.rain}</p>
          <p className="text-sm font-bold text-blue-600">{day.rainfall_mm.toFixed(1)} mm</p>
        </div>
        <div className="rounded-lg p-1.5" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <p className="text-xs text-gray-500">{t.deficit}</p>
          <p className="text-sm font-bold text-gray-700">{day.net_deficit_mm.toFixed(1)} mm</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7-day DayRow
// ---------------------------------------------------------------------------

function DayRow({ day, t }: { day: IrrigationDay; t: typeof LABELS['en'] }) {
  const style = ACTION_STYLE[day.action] ?? ACTION_STYLE.advisory
  const actionLabel = (t as Record<string, string>)[day.action] ?? day.action

  return (
    <div
      className="flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 border"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 w-8 shrink-0">{day.day_of_week}</span>
          <span className="text-xs font-semibold" style={{ color: style.text }}>{actionLabel}</span>
          {day.duration_min != null && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
              {day.duration_min} {t.min}
            </span>
          )}
        </div>
        {day.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{day.note}</p>}
      </div>
      <div className="text-right shrink-0 text-xs text-gray-400 space-y-0.5">
        <p>{t.et0}: {day.et0_mm.toFixed(1)} mm</p>
        {day.rainfall_mm > 0 && <p className="text-blue-500">🌧 {day.rainfall_mm.toFixed(1)} mm</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Technical calculations (expandable)
// ---------------------------------------------------------------------------

function TechExplainer({
  data,
  t,
  irrigationType,
  stageDays,
}: {
  data: PrescriptionResponse
  t: typeof LABELS['en']
  irrigationType: string
  stageDays: number
}) {
  const irr = data.irrigation!
  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">

      {/* Weather source */}
      <div className="rounded-xl p-3" style={{ background: '#F0F9FF' }}>
        <p className="text-xs font-bold text-blue-700 mb-1">{t.weather_source}</p>
        <p className="text-xs text-blue-600">{irr.weather_source}</p>
        <p className="text-xs text-gray-500 mt-1">Open-Meteo (FAO-56 Penman-Monteith ET₀)</p>
      </div>

      {/* Kc explanation */}
      <div className="rounded-xl p-3" style={{ background: '#F8F4ED' }}>
        <p className="text-xs font-bold text-gray-600 mb-1">{t.kc_title}</p>
        <p className="text-xs font-mono font-bold" style={{ color: '#1B4332' }}>
          Kc = {irr.kc_used.toFixed(2)}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {t.kc_note
            .replace('{kc}', String(irr.kc_used.toFixed(2)))
            .replace('{stage}', irr.growth_stage)}
        </p>
        {stageDays > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">{t.crop_days}: {stageDays}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{t.etc_formula}</p>
      </div>

      {/* Formula block */}
      <div className="rounded-xl p-3 space-y-1.5" style={{ background: '#F8F4ED' }}>
        <p className="text-xs font-bold text-gray-600">{t.et0_title}</p>
        <p className="text-xs text-gray-600">{t.deficit_formula}</p>
        <p className="text-xs text-gray-600">
          {t.irrigate_decision.replace('{threshold}', '2')}
        </p>
        {irrigationType && (
          <p className="text-xs text-gray-500">{t.pump_note}</p>
        )}
      </div>

      {/* Per-day breakdown table */}
      <div className="rounded-xl overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-3 py-2 grid grid-cols-5 gap-1 text-xs font-bold text-gray-500">
          <span>Day</span>
          <span>ET₀</span>
          <span>Kc</span>
          <span>ETc</span>
          <span>{t.deficit}</span>
        </div>
        {irr.weekly_schedule.map((day, i) => (
          <div
            key={i}
            className="px-3 py-2 grid grid-cols-5 gap-1 text-xs text-gray-600 border-t border-gray-50"
          >
            <span className="font-medium">{day.day_of_week.slice(0, 3)}</span>
            <span>{day.et0_mm.toFixed(1)}</span>
            <span>{irr.kc_used.toFixed(2)}</span>
            <span>{day.etc_mm.toFixed(1)}</span>
            <span className={day.net_deficit_mm > 2 ? 'font-bold text-blue-600' : ''}>
              {day.net_deficit_mm.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main IrrigationCard
// ---------------------------------------------------------------------------

export function IrrigationCard({ data, lang, irrigationType = '', stageDays = 0 }: Props) {
  const [show7Day, setShow7Day] = useState(false)  // ← collapsed by default
  const [showTech, setShowTech] = useState(false)
  const t = LABELS[lang]
  const irr = data.irrigation

  // Spec-defined stage name (replaces Kc FAO stage label)
  const stageInfo = getStageName(stageDays, data.crop)
  const stageName = lang === 'ta' ? stageInfo.name_ta : stageInfo.name

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      <div className="px-4 py-3" style={{ background: '#0369A1' }}>
        <p className="text-xs font-bold tracking-widest text-sky-200 uppercase">{t.title}</p>
        <p className="text-xs text-sky-300 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4 space-y-3">
        {!irr ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🌡️</p>
            <p className="text-sm font-semibold text-gray-600">{t.no_weather}</p>
            <p className="text-xs text-gray-400 mt-1">{t.no_weather_note}</p>
            {data.weather_note && (
              <p className="text-xs text-gray-400 mt-1">{data.weather_note}</p>
            )}
          </div>
        ) : (
          <>
            {/* ── TODAY'S ACTION (always visible) ── */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                {t.today_action}
              </p>
              <TodayDecision day={irr.weekly_schedule[0]} t={t} />
            </div>

            {/* ── Stage + Kc summary chips ── */}
            <div className="flex gap-2 flex-wrap pt-1">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-50 text-green-700">
                {stageName}
              </span>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                {t.kc_chip}: {irr.kc_used.toFixed(2)}
              </span>
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700">
                💧 {irr.total_irrigation_days}{lang === 'ta' ? 'd நீர்' : 'd irrigate'}
                {' · '}⏭ {irr.total_skip_days}{lang === 'ta' ? 'd தவிர்' : 'd skip'}
              </span>
            </div>

            {/* ── 7-DAY PLAN toggle ── */}
            <button
              onClick={() => setShow7Day(!show7Day)}
              className="w-full text-xs text-blue-500 font-semibold py-2 flex items-center justify-center gap-1.5 border border-blue-100 rounded-xl bg-blue-50"
            >
              {show7Day ? t.hide_week : t.week_plan}
            </button>

            {show7Day && (
              <div className="space-y-2">
                {irr.weekly_schedule.map((day, i) => (
                  <DayRow key={i} day={day} t={t} />
                ))}
              </div>
            )}

            {/* ── TECHNICAL CALCULATIONS toggle ── */}
            <button
              onClick={() => setShowTech(!showTech)}
              className="w-full text-xs text-gray-400 py-1 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-3"
            >
              {showTech ? t.hide_calc : t.how_calculated}
            </button>

            {showTech && (
              <TechExplainer
                data={data}
                t={t}
                irrigationType={irrigationType}
                stageDays={stageDays}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
