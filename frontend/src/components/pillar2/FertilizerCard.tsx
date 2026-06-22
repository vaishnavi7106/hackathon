import { useState } from 'react'
import type { PrescriptionResponse, SplitScheduleItem } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
  stageDays?: number
}

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const L = {
  ta: {
    title: 'உர திட்டம்',
    subtitle: 'TNAU CPG 2020',
    apply_now_banner: 'இன்று உரம் இட வேண்டும்',
    upcoming_banner: 'வரும் உர பயன்பாடு',
    past_banner: 'அனைத்து பயன்பாடுகளும் முடிந்தன',
    buy_now: 'இப்போது வாங்க வேண்டியவை',
    zero_skip: 'தேவையில்லை',
    bags: 'பை',
    total: 'மொத்தம்',
    instruction: 'நீர்பாசனத்திற்கு முன் அல்லது பிறகு இடவும்',
    next_label: 'அடுத்த பயன்பாடு',
    in_days: 'நாட்களில்',
    products_needed: 'தேவையான பொருட்கள்',
    season_plan: 'முழு பருவ திட்டம் ▼',
    hide_season: 'மறை ▲',
    show_tech: 'கணக்கீட்டு விவரங்கள் ▼',
    hide_tech: 'மறை ▲',
    npk_label: 'NPK (கிலோ/ஹெக்டர்)',
    adjusted: 'சரிசெய்யப்பட்டது',
    conversion_title: 'NPK → பைகள் மாற்றம்',
    conversion_note: 'யூரியாவில் 46% N, DAP-ல் 46% P₂O₅, MOP-ல் 60% K₂O',
    rec_id: 'பரிந்துரை குறியீடு',
    source: 'ஆதாரம்',
    applied: 'இட்டாகிவிட்டது',
    day_label: 'நாள்',
  },
  en: {
    title: 'Fertilizer Plan',
    subtitle: 'TNAU CPG 2020',
    apply_now_banner: 'Apply fertilizer today',
    upcoming_banner: 'Upcoming application',
    past_banner: 'All applications complete',
    buy_now: 'What to buy now',
    zero_skip: 'Not needed',
    bags: 'bags',
    total: 'Total',
    instruction: 'Apply before or after irrigation',
    next_label: 'Next application',
    in_days: 'days away',
    products_needed: 'Products needed',
    season_plan: 'Full season plan ▼',
    hide_season: 'Hide ▲',
    show_tech: 'Show calculation details ▼',
    hide_tech: 'Hide ▲',
    npk_label: 'NPK (kg/ha)',
    adjusted: 'Adjusted for symptoms',
    conversion_title: 'NPK → bag conversion',
    conversion_note: 'Urea = 46% N, DAP = 46% P₂O₅, MOP = 60% K₂O',
    rec_id: 'Recommendation ID',
    source: 'Source',
    applied: 'Already applied',
    day_label: 'Day',
  },
} as const

type Lang = 'ta' | 'en'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPLY_WINDOW = 2 // ±2 days from trigger counts as "apply now"

function isWithinWindow(item: SplitScheduleItem, stageDays: number) {
  return !item.is_past && Math.abs(item.day - stageDays) <= APPLY_WINDOW
}

function computeCosts(
  item: SplitScheduleItem,
  prices: { urea_per_bag: number; dap_per_bag: number; mop_per_bag: number },
) {
  const urea = Math.round(item.urea_bags * prices.urea_per_bag)
  const dap = Math.round(item.dap_bags * prices.dap_per_bag)
  const mop = Math.round(item.mop_bags * prices.mop_per_bag)
  return { urea, dap, mop, total: urea + dap + mop }
}

// ---------------------------------------------------------------------------
// Buy-now product tile grid for one application
// ---------------------------------------------------------------------------

function BuyNowGrid({
  item,
  prices,
  lang,
}: {
  item: SplitScheduleItem
  prices: { urea_per_bag: number; dap_per_bag: number; mop_per_bag: number }
  lang: Lang
}) {
  const t = L[lang]
  const costs = computeCosts(item, prices)

  const tiles = [
    { name: lang === 'ta' ? 'யூரியா' : 'Urea', bags: item.urea_bags, cost: costs.urea, color: '#2D6A4F' },
    { name: 'DAP',                               bags: item.dap_bags,  cost: costs.dap,  color: '#0EA5E9' },
    { name: 'MOP',                               bags: item.mop_bags,  cost: costs.mop,  color: '#E8820C' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.buy_now}</p>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ name, bags, cost, color }) => (
          bags > 0 ? (
            <div key={name} className="border border-gray-100 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-gray-600">{name}</p>
              <p className="text-2xl font-bold mt-1" style={{ color }}>{bags.toFixed(1)}</p>
              <p className="text-xs text-gray-400">{t.bags}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">₹{cost}</p>
            </div>
          ) : (
            <div key={name} className="border border-dashed border-gray-100 rounded-xl p-3 text-center opacity-40">
              <p className="text-xs font-semibold text-gray-400">{name}</p>
              <p className="text-xs text-gray-400 mt-2">{t.zero_skip}</p>
            </div>
          )
        ))}
      </div>

      {/* Total cost row */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{ background: '#F0FDF4' }}
      >
        <span className="text-sm font-semibold text-gray-700">{t.total}</span>
        <span className="text-base font-extrabold text-green-800">₹{costs.total}</span>
      </div>

      {/* Instruction */}
      <p className="text-xs text-gray-500 text-center">{t.instruction}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Next application preview
// ---------------------------------------------------------------------------

function NextApplicationBlock({
  item,
  stageDays,
  lang,
}: {
  item: SplitScheduleItem
  stageDays: number
  lang: Lang
}) {
  const t = L[lang]
  const daysUntil = Math.max(0, item.day - stageDays)
  const stageName = lang === 'ta' ? item.stage_ta : item.stage
  const productNames = item.products.length > 0 ? item.products.map((p) => p.split(' ')[0]).join(' + ') : '—'

  return (
    <div className="rounded-xl px-4 py-3 border border-gray-100" style={{ background: '#F8F9FA' }}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.next_label}</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{stageName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {daysUntil > 0 ? `${daysUntil} ${t.in_days}` : t.day_label + ' ' + item.day}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{t.products_needed}</p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">{productNames}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full season plan (all 3 splits)
// ---------------------------------------------------------------------------

function SeasonPlan({
  schedule,
  prices,
  lang,
}: {
  schedule: SplitScheduleItem[]
  prices: { urea_per_bag: number; dap_per_bag: number; mop_per_bag: number }
  lang: Lang
}) {
  const t = L[lang]
  return (
    <div className="space-y-2">
      {schedule.map((item, i) => {
        const costs = computeCosts(item, prices)
        const stageName = lang === 'ta' ? item.stage_ta : item.stage
        const productList = item.products.filter(Boolean).map((p) => p.split(' ')[0]).join(', ')
        return (
          <div
            key={i}
            className="rounded-xl px-3 py-2.5 border flex items-center justify-between"
            style={{
              background: item.is_past ? '#F9FAFB' : '#FEFCE8',
              borderColor: item.is_past ? '#E5E7EB' : '#FDE68A',
              opacity: item.is_past ? 0.6 : 1,
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-800">{stageName}</span>
                <span className="text-xs text-gray-400">{t.day_label} {item.day}</span>
                {item.is_past && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">{t.applied}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{productList || '—'}</p>
            </div>
            <p className="text-sm font-bold text-gray-700">₹{costs.total}</p>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main FertilizerCard
// ---------------------------------------------------------------------------

export function FertilizerCard({ data, lang, stageDays = 0 }: Props) {
  const [showSeason, setShowSeason] = useState(false)
  const [showTech, setShowTech] = useState(false)
  const t = L[lang]
  const rec = data.recommendation
  const prices = data.products.prices_used
  const schedule = data.split_schedule ?? []

  // Find current (within window) and upcoming items
  const currentItem = schedule.find((item) => isWithinWindow(item, stageDays)) ?? null
  const upcomingItems = schedule.filter(
    (item) => !item.is_past && (!currentItem || item.day !== currentItem.day),
  )
  const nextItem = upcomingItems[0] ?? null
  const allDone = schedule.every((item) => item.is_past)

  const hasAdjustments = rec.adjustments_applied.length > 0

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1B4332' }}>
        <div>
          <p className="text-xs font-bold tracking-widest text-green-300 uppercase">{t.title}</p>
          <p className="text-xs text-green-400 mt-0.5">{t.subtitle}</p>
        </div>
        <a
          href={rec.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-green-300 underline shrink-0"
        >
          {t.source}
        </a>
      </div>

      <div className="bg-white p-4 space-y-4">

        {/* ── ALL DONE ── */}
        {allDone && (
          <div className="rounded-xl px-4 py-6 text-center" style={{ background: '#F0FDF4' }}>
            <p className="text-2xl mb-1">✅</p>
            <p className="text-sm font-bold text-green-800">{t.past_banner}</p>
          </div>
        )}

        {/* ── APPLY NOW banner ── */}
        {currentItem && !allDone && (
          <div className="rounded-xl overflow-hidden">
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: '#FEF3C7' }}
            >
              <span className="text-base">🟡</span>
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  {t.apply_now_banner}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {lang === 'ta' ? currentItem.stage_ta : currentItem.stage}
                </p>
              </div>
            </div>
            <div className="border border-amber-100 border-t-0 rounded-b-xl p-4">
              <BuyNowGrid item={currentItem} prices={prices} lang={lang} />
            </div>
          </div>
        )}

        {/* ── UPCOMING (no current window) ── */}
        {!currentItem && !allDone && nextItem && (
          <div className="rounded-xl overflow-hidden">
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: '#EFF6FF' }}
            >
              <span className="text-base">📅</span>
              <div>
                <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  {t.upcoming_banner}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {lang === 'ta' ? nextItem.stage_ta : nextItem.stage}
                </p>
              </div>
            </div>
            <div className="border border-blue-100 border-t-0 rounded-b-xl p-4">
              <BuyNowGrid item={nextItem} prices={prices} lang={lang} />
            </div>
          </div>
        )}

        {/* ── NEXT APPLICATION preview ── */}
        {!allDone && (currentItem ? nextItem : upcomingItems[1] ?? null) && (
          <NextApplicationBlock
            item={(currentItem ? nextItem : upcomingItems[1])!}
            stageDays={stageDays}
            lang={lang}
          />
        )}

        {/* ── FULL SEASON PLAN toggle ── */}
        {schedule.length > 0 && (
          <>
            <button
              onClick={() => setShowSeason(!showSeason)}
              className="w-full text-xs text-gray-400 py-1 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-2"
            >
              {showSeason ? t.hide_season : t.season_plan}
            </button>
            {showSeason && (
              <SeasonPlan schedule={schedule} prices={prices} lang={lang} />
            )}
          </>
        )}

        {/* ── TECHNICAL TOGGLE ── */}
        <button
          onClick={() => setShowTech(!showTech)}
          className="w-full text-xs text-gray-400 py-1 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-2"
        >
          {showTech ? t.hide_tech : t.show_tech}
        </button>

        {showTech && (
          <div className="space-y-3 pt-1">
            {/* NPK kg/ha values */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">{t.npk_label}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'N', base: rec.n_kg_ha, adj: rec.n_adjusted },
                  { label: 'P', base: rec.p_kg_ha, adj: rec.p_adjusted },
                  { label: 'K', base: rec.k_kg_ha, adj: rec.k_adjusted },
                ].map(({ label, base, adj }) => (
                  <div key={label} className="rounded-xl text-center py-3" style={{ background: '#F8F4ED' }}>
                    <span className="text-xs font-bold text-gray-500">{label}</span>
                    <p className="text-lg font-bold" style={{ color: '#1B4332' }}>
                      {hasAdjustments ? adj : base}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lang === 'ta' ? 'கி.கி/ஹெக்.' : 'kg/ha'}
                    </p>
                    {hasAdjustments && adj !== base && (
                      <p className="text-xs line-through text-gray-400">{base}</p>
                    )}
                  </div>
                ))}
              </div>
              {hasAdjustments && (
                <p className="text-xs text-orange-600 mt-1 text-center">
                  {t.adjusted}: {rec.adjustments_applied.join(', ')}
                </p>
              )}
            </div>

            {/* Conversion math */}
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: '#F8F4ED' }}>
              <p className="text-xs font-semibold text-gray-600">{t.conversion_title}</p>
              <p className="text-xs text-gray-500 mb-1">{t.conversion_note}</p>
              {[
                { name: lang === 'ta' ? 'யூரியா' : 'Urea', bags: data.products.urea_bags, kg: data.products.urea_kg, pct: '46% N' },
                { name: 'DAP',                               bags: data.products.dap_bags,  kg: data.products.dap_kg,  pct: '46% P₂O₅' },
                { name: 'MOP',                               bags: data.products.mop_bags,  kg: data.products.mop_kg,  pct: '60% K₂O' },
              ].map(({ name, bags, kg, pct }) => (
                <div key={name} className="text-xs text-gray-600 font-mono">
                  {name}: {kg.toFixed(1)} kg ÷ {pct} ÷ bag wt → <strong>{bags.toFixed(1)} {t.bags}</strong>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400">
              {t.rec_id}: <span className="font-mono">{rec.source_ref}</span>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
