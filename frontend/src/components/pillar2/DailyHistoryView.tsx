import { useEffect, useRef } from 'react'
import { useDailyRecordStore } from '@/store/dailyRecordStore'
import { saveDailyRecord } from '@/api/daily'
import { getStageName } from '@/lib/pillar2/stageNames'
import type { DailyRecord } from '@/types/dailyRecord'
import { useFarmerStore } from '@/store/farmerStore'

type Lang = 'ta' | 'en'

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const L = {
  ta: {
    title: 'பண்ணை நாட்குறிப்பு',
    subtitle: 'கடந்த 30 நாட்கள்',
    empty_title: 'இன்னும் பதிவுகள் இல்லை',
    empty_sub: 'தினசரி கணக்கீடு தொடங்கியதும் இங்கே காட்டப்படும்.',
    today: 'இன்று',
    yesterday: 'நேற்று',
    irrigated: 'நீர் பாய்ச்சினோம்',
    skipped_rain: 'மழை — தவிர்த்தோம்',
    skipped: 'தவிர்த்தோம்',
    min: 'நிமிடம்',
    fert_applied: 'உரம் இட்டோம்',
    fert_none: 'உரம் தேவையில்லை',
    fert_due: 'உரம் இட வேண்டும்',
    confirm_irr: 'நீர் பாய்ச்சினேன் ✓',
    confirm_fert: 'உரம் இட்டேன் ✓',
    confirmed: '✅ உறுதிப்படுத்தப்பட்டது',
    stage: 'நிலை',
    syncing: 'ஒத்திசைக்கிறது…',
    locked: 'பழைய பதிவு',
  },
  en: {
    title: 'Farm Diary',
    subtitle: 'Last 30 days',
    empty_title: 'No records yet',
    empty_sub: 'Records will appear here once you start daily calculations.',
    today: 'Today',
    yesterday: 'Yesterday',
    irrigated: 'Irrigated',
    skipped_rain: 'Rain — skipped',
    skipped: 'Skipped',
    min: 'min',
    fert_applied: 'Fertilizer applied',
    fert_none: 'No fertilizer',
    fert_due: 'Fertilizer was due',
    confirm_irr: 'Done — Irrigated ✓',
    confirm_fert: 'Done — Applied ✓',
    confirmed: '✅ Confirmed',
    stage: 'Stage',
    syncing: 'Syncing…',
    locked: 'Old record',
  },
} as const

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, lang: Lang): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return L[lang].today
  if (dateStr === yesterday) return L[lang].yesterday
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

/** Returns true if the date is within N days from today (inclusive). */
function isWithinDays(dateStr: string, days: number): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(dateStr) >= cutoff
}

// ---------------------------------------------------------------------------
// Single day record card
// ---------------------------------------------------------------------------

function DayCard({
  record,
  lang,
  crop,
  onConfirmIrr,
  onConfirmFert,
}: {
  record: DailyRecord
  lang: Lang
  crop: string
  onConfirmIrr: () => void
  onConfirmFert: () => void
}) {
  const t = L[lang]
  const stageInfo = getStageName(record.stage_days, crop)
  const stageName = lang === 'ta' ? stageInfo.name_ta : stageInfo.name
  const dateLabel = formatDate(record.date, lang)
  const canConfirm = isWithinDays(record.date, 3)

  const isIrrigate = record.irrigation_recommended === 'irrigate'
  const isSkipRain = record.irrigation_recommended === 'skip_rain'
  const irrConfirmed = record.irrigation_confirmed === true
  const fertConfirmed = record.fertilizer_confirmed === true

  // Irrigation status label
  let irrLabel = t.skipped
  let irrIcon = '⏭'
  if (isIrrigate) {
    irrLabel = `${t.irrigated}${record.irrigation_minutes ? ` · ${record.irrigation_minutes} ${t.min}` : ''}`
    irrIcon = '💧'
  } else if (isSkipRain) {
    irrLabel = t.skipped_rain
    irrIcon = '🌧'
  }

  // Fertilizer status label
  let fertLabel = t.fert_none
  let fertIcon = '—'
  if (record.fertilizer_due) {
    const stageFert = lang === 'ta'
      ? record.fertilizer_application?.stage_ta
      : record.fertilizer_application?.stage
    fertLabel = stageFert ? `${t.fert_due} · ${stageFert}` : t.fert_due
    fertIcon = '🟡'
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Day header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50"
        style={{ background: '#F8F9FA' }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800">{dateLabel}</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            {stageName}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {lang === 'ta' ? `நாள் ${record.stage_days}` : `Day ${record.stage_days}`}
        </p>
      </div>

      <div className="px-4 py-3 space-y-2.5">

        {/* Irrigation row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">{irrIcon}</span>
            <p className="text-sm text-gray-700 truncate">{irrLabel}</p>
          </div>
          <div className="shrink-0">
            {isIrrigate && (
              irrConfirmed ? (
                <span className="text-xs text-green-600 font-semibold">{t.confirmed}</span>
              ) : canConfirm ? (
                <button
                  onClick={onConfirmIrr}
                  className="text-xs px-2.5 py-1 rounded-full bg-blue-600 text-white font-semibold"
                >
                  {t.confirm_irr}
                </button>
              ) : (
                <span className="text-xs text-gray-300">{t.locked}</span>
              )
            )}
          </div>
        </div>

        {/* Fertilizer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">{fertIcon}</span>
            <p className="text-sm text-gray-700 truncate">{fertLabel}</p>
            {record.fertilizer_due && record.fertilizer_application && (
              <span className="text-xs text-amber-700 font-semibold shrink-0">
                ₹{record.fertilizer_application.total_cost}
              </span>
            )}
          </div>
          <div className="shrink-0">
            {record.fertilizer_due && (
              fertConfirmed ? (
                <span className="text-xs text-green-600 font-semibold">{t.confirmed}</span>
              ) : canConfirm ? (
                <button
                  onClick={onConfirmFert}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-600 text-white font-semibold"
                >
                  {t.confirm_fert}
                </button>
              ) : (
                <span className="text-xs text-gray-300">{t.locked}</span>
              )
            )}
          </div>
        </div>

        {/* Weather summary — ET₀ removed (technical, belongs in expandable only) */}
        {record.weather && (record.weather.temp_c > 0 || record.weather.rain_mm > 0) && (
          <div className="flex gap-3 pt-1 text-xs text-gray-400 border-t border-gray-50">
            {record.weather.temp_c > 0 && <span>🌡 {record.weather.temp_c.toFixed(0)}°C</span>}
            {record.weather.rain_mm > 0 && <span>🌧 {record.weather.rain_mm} mm</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main DailyHistoryView
// ---------------------------------------------------------------------------

export function DailyHistoryView({
  lang,
  crop,
  cropId,
}: {
  lang: Lang
  crop: string
  cropId: string
}) {
  const t = L[lang]
  const {
    historyByCrop,
    syncQueue,
    confirmIrrigationForCrop,
    confirmFertilizerForCrop,
    clearSyncQueue,
  } = useDailyRecordStore()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn)
  const syncedRef = useRef(false)

  const records = (historyByCrop[cropId] ?? []).slice(0, 30)

  useEffect(() => {
    if (syncedRef.current) return
    if (!isLoggedIn()) return
    if (syncQueue.length === 0) return
    syncedRef.current = true

    const flush = async () => {
      const queue = [...syncQueue]
      let anyFailed = false
      for (const record of queue) {
        try {
          await saveDailyRecord(record)
        } catch {
          anyFailed = true
        }
      }
      if (!anyFailed) clearSyncQueue()
    }

    flush()
  }, [])

  async function handleConfirmIrr(record: DailyRecord) {
    confirmIrrigationForCrop(cropId, record.date, true)
    if (isLoggedIn()) {
      try {
        await saveDailyRecord({ ...record, irrigation_confirmed: true })
      } catch {
        // silent
      }
    }
  }

  async function handleConfirmFert(record: DailyRecord) {
    confirmFertilizerForCrop(cropId, record.date, true)
    if (isLoggedIn()) {
      try {
        await saveDailyRecord({ ...record, fertilizer_confirmed: true })
      } catch {
        // silent
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">{t.title}</p>
          <p className="text-xs text-gray-400">{t.subtitle}</p>
        </div>
        {syncQueue.length > 0 && (
          <span className="text-xs text-gray-400 italic">{t.syncing}</span>
        )}
      </div>

      {records.length === 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-semibold text-gray-600">{t.empty_title}</p>
          <p className="text-xs text-gray-400 mt-1">{t.empty_sub}</p>
        </div>
      )}

      {records.map((record) => (
        <DayCard
          key={record.date}
          record={record}
          lang={lang}
          crop={crop}
          onConfirmIrr={() => handleConfirmIrr(record)}
          onConfirmFert={() => handleConfirmFert(record)}
        />
      ))}
    </div>
  )
}
