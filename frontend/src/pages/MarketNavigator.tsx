import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceDot,
} from 'recharts'
import { api } from '@/api/client'
import { useFarmerStore } from '@/store/farmerStore'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastPoint {
  date: string
  yhat: number
  yhat_lower: number | null
  yhat_upper: number | null
}

interface MandiInfo {
  mandi_id: string
  name: string
  distance_km: number | null
  today_price: number | null
  transport_cost_per_quintal: number | null
  net_price: number | null
}

interface HoldSellOut {
  recommendation: 'HOLD' | 'SELL'
  today_price: number | null
  forecast_peak_price: number | null
  weeks_to_hold: number | null
  storage_cost_per_quintal: number | null
  net_gain_per_quintal: number | null
  calculation_ta: string | null
  historical_note_ta: string | null
}

interface PriceForecastOut {
  mandi_id: string
  series: ForecastPoint[]
  peak_price: number | null
  peak_date: string | null
}

interface ForecastResponse {
  forecast_id: string
  crop: string
  generated_at: string
  mandis: MandiInfo[]
  best_mandi: MandiInfo | null
  price_forecast: PriceForecastOut | null
  hold_sell: HoldSellOut | null
  model_unavailable: boolean
  model_unavailable_note: string | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CROPS = [
  { name: 'Tomato',                 tamil: 'தக்காளி',        emoji: '🍅' },
  { name: 'Onion',                  tamil: 'வெங்காயம்',      emoji: '🧅' },
  { name: 'Banana - Green',         tamil: 'வாழைப்பழம்',    emoji: '🍌' },
  { name: 'Bhindi(Ladies Finger)',  tamil: 'வெண்டைக்காய்',   emoji: '🫑' },
  { name: 'Bitter Gourd',           tamil: 'பாகற்காய்',      emoji: '🟢' },
  { name: 'Cabbage',                tamil: 'முட்டைக்கோஸ்',  emoji: '🥬' },
  { name: 'Coconut',                tamil: 'தேங்காய்',       emoji: '🥥' },
  { name: 'Green Chilli',           tamil: 'பச்சை மிளகாய்', emoji: '🌶️' },
  { name: 'Mint(Pudina)',           tamil: 'புதினா',          emoji: '🌿' },
  { name: 'Pumpkin',                tamil: 'பூசணிக்காய்',   emoji: '🎃' },
] as const

const STORAGE_OPTIONS = [
  { value: 'home' as const,         label: 'Home',       tamil: 'வீட்டு',    emoji: '🏠', rate: '₹30/wk' },
  { value: 'warehouse' as const,    label: 'Warehouse',  tamil: 'கிடங்கு',   emoji: '🏭', rate: '₹55/wk' },
  { value: 'cold_storage' as const, label: 'Cold',       tamil: 'குளிர்',    emoji: '❄️', rate: '₹120/wk' },
] as const

const CACHE_TTL = 12 * 60 * 60 * 1000

// ─── Cache helpers ─────────────────────────────────────────────────────────────

function getCached(crop: string): { data: ForecastResponse; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(`marketForecast_${crop}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: ForecastResponse; timestamp: number }
    if (Date.now() - parsed.timestamp > CACHE_TTL) return null
    return parsed
  } catch { return null }
}

function setCached(crop: string, data: ForecastResponse) {
  localStorage.setItem(`marketForecast_${crop}`, JSON.stringify({ data, timestamp: Date.now() }))
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  const main = payload.find(p => p.dataKey === 'yhat')
  if (!main) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-semibold text-primary-700">₹{main.value?.toFixed(0)}</p>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type Screen = 'home' | 'result'
type Storage = 'home' | 'warehouse' | 'cold_storage'

export default function MarketNavigator() {
  const profile = useFarmerStore(s => s.profile)
  const isTamil = (profile?.language ?? 'ta') === 'ta'
  const t = (ta: string, en: string) => isTamil ? ta : en

  const [screen, setScreen] = useState<Screen>('home')
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
  const [storage, setStorage] = useState<Storage>('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ForecastResponse | null>(null)
  const [cachedInfo, setCachedInfo] = useState<{ timestamp: number; recommendation: string } | null>(null)

  // Pre-select crop from profile
  useEffect(() => {
    const primary = profile?.primary_crop
    if (!primary || selectedCrop) return
    const match = CROPS.find(c => c.name.toLowerCase() === primary.toLowerCase())
    if (match) setSelectedCrop(match.name)
  }, [profile?.primary_crop])

  // Pre-select storage from profile
  useEffect(() => {
    if (profile?.storage_facility) setStorage(profile.storage_facility)
  }, [profile?.storage_facility])

  // Update cache note when crop changes
  useEffect(() => {
    if (!selectedCrop) { setCachedInfo(null); return }
    const cached = getCached(selectedCrop)
    const rec = cached?.data.hold_sell?.recommendation
    setCachedInfo(rec ? { timestamp: cached!.timestamp, recommendation: rec } : null)
  }, [selectedCrop])

  async function handleFetch() {
    if (!selectedCrop) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.post<ForecastResponse>('/forecast', {
        crop: selectedCrop,
        storage_facility: storage,
      })
      setCached(selectedCrop, data)
      setResult(data)
      setScreen('result')
    } catch {
      setError(t(
        'சந்தை தகவல் கிடைக்கவில்லை. இணைப்பை சரிபார்க்கவும்.',
        'Could not fetch market data. Check your connection.',
      ))
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    setScreen('home')
    setResult(null)
    setError(null)
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (screen === 'result' && result) {
    return <ResultScreen result={result} isTamil={isTamil} t={t} onBack={goBack} />
  }

  // ── Home screen ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">
          {t('சந்தை வழிகாட்டி', 'Market Navigator')}
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {t('உங்கள் பயிரை எப்போது விற்க வேண்டும்?', 'Find the best time to sell your crop')}
        </p>
      </header>

      <div className="px-4 py-4 space-y-5 pb-32">

        {/* Crop grid */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t('பயிர் தேர்வு', 'Select Crop')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CROPS.map(crop => {
              const isSelected = selectedCrop === crop.name
              return (
                <button
                  key={crop.name}
                  onClick={() => setSelectedCrop(crop.name)}
                  className={cn(
                    'card p-3 flex items-center gap-3 text-left transition-all active:scale-[0.98]',
                    isSelected
                      ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-300'
                      : 'hover:border-gray-200',
                  )}
                >
                  <span className="text-2xl flex-shrink-0 leading-none">{crop.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {isTamil ? crop.tamil : crop.name}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {isTamil ? crop.name : crop.tamil}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Storage selector */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t('சேமிப்பு வகை', 'Storage Type')}
          </p>
          <div className="flex gap-2">
            {STORAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStorage(opt.value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 rounded-xl py-3 px-1 border text-center transition-all',
                  storage === opt.value
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                )}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span className="text-[11px] font-medium leading-tight">
                  {isTamil ? opt.tamil : opt.label}
                </span>
                <span className="text-[10px] text-gray-400">{opt.rate}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cache note */}
        {cachedInfo && (
          <p className="text-xs text-gray-400 text-center">
            {t('கடைசியாக சரிபார்த்தது', 'Last checked')}: {timeAgo(cachedInfo.timestamp)} ·{' '}
            <span className={cn(
              'font-semibold',
              cachedInfo.recommendation === 'SELL' ? 'text-red-500' : 'text-green-600',
            )}>
              {cachedInfo.recommendation === 'SELL'
                ? t('விற்கவும்', 'SELL')
                : t('காத்திருக்கவும்', 'HOLD')}
            </span>
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={handleFetch} className="mt-2 text-xs font-semibold text-red-600 underline">
              {t('மீண்டும் முயற்சி', 'Try again')}
            </button>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleFetch}
          disabled={!selectedCrop || loading}
          className="w-full btn-primary py-3.5 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('ஏற்றுகிறது...', 'Loading...')}
            </span>
          ) : (
            t('சந்தை விலை பார்க்க', 'Check Market Price')
          )}
        </button>

      </div>
    </div>
  )
}

// ─── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  result,
  isTamil,
  t,
  onBack,
}: {
  result: ForecastResponse
  isTamil: boolean
  t: (ta: string, en: string) => string
  onBack: () => void
}) {
  const hs = result.hold_sell
  const pf = result.price_forecast
  const isSell = hs?.recommendation === 'SELL'
  const cropInfo = CROPS.find(c => c.name.toLowerCase() === result.crop.toLowerCase())

  // Filter out zero-value day-0 when today_price is null
  const chartData = (pf?.series ?? []).filter(p => p.yhat > 0)
  const todayStr = new Date().toISOString().split('T')[0]

  const SELL_LABEL = isTamil ? 'இப்போதே விற்கவும்' : 'SELL NOW'
  const HOLD_LABEL = isTamil ? 'காத்திருக்கவும்' : 'HOLD'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-700 p-1 -ml-1 transition-colors"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-gray-900 text-base">
            {cropInfo?.emoji} {isTamil ? cropInfo?.tamil : result.crop}
          </h1>
          <p className="text-xs text-gray-400">
            {t('14 நாள் முன்னறிவிப்பு', '14-day forecast')}
          </p>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 pb-32">

        {/* Model unavailable warning */}
        {result.model_unavailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800">
              ⚠️ {t('விலை முன்னறிவிப்பு கிடைக்கவில்லை', 'Price forecast temporarily unavailable')}
            </p>
            {result.model_unavailable_note && (
              <p className="text-xs text-amber-700 mt-1">{result.model_unavailable_note}</p>
            )}
          </div>
        )}

        {/* Hold / Sell card */}
        {hs && (
          <div className={cn(
            'card p-4 border-l-4',
            isSell ? 'border-l-red-400' : 'border-l-green-500',
          )}>
            <p className={cn(
              'text-xl font-bold mb-3',
              isSell ? 'text-red-600' : 'text-green-600',
            )}>
              {isSell
                ? SELL_LABEL
                : `${HOLD_LABEL}${hs.weeks_to_hold ? ` — ${hs.weeks_to_hold} ${t('வாரம்', 'week(s)')}` : ''}`}
            </p>

            {hs.today_price == null ? (
              <p className="text-sm text-gray-500">
                {t(
                  `${result.crop} க்கு உங்கள் மாவட்டத்தில் இன்று விலை தகவல் இல்லை. பிராந்திய சராசரி அடிப்படையில் முன்னறிவிப்பு காட்டப்படுகிறது.`,
                  `No price data for ${result.crop} in your district today. Forecast shown based on regional average.`,
                )}
              </p>
            ) : (
              <div className="space-y-2.5">
                <Row
                  label={t('இன்றைய விலை', "Today's price")}
                  value={`${fmt(hs.today_price)}/quintal`}
                />
                {isSell ? (
                  <Row
                    label={t('இப்போது விற்பதால் கூடுதல் லாபம்', 'Extra by selling today')}
                    valueClass="text-red-600 font-semibold"
                    value={`${fmt(Math.abs(hs.net_gain_per_quintal ?? 0))}/quintal`}
                  />
                ) : (
                  <>
                    <Row
                      label={t('எதிர்பார்க்கப்படும் உச்ச விலை', 'Expected peak')}
                      value={`${fmt(hs.forecast_peak_price)} on ${fmtDate(pf?.peak_date)}`}
                    />
                    <Row
                      label={t('சேமிப்பு செலவு', 'Storage cost')}
                      value={`${fmt(hs.storage_cost_per_quintal)}/quintal`}
                    />
                    <Row
                      label={t('தூய லாபம்', 'Net gain from waiting')}
                      valueClass="text-green-600 font-semibold"
                      value={`${fmt(hs.net_gain_per_quintal)}/quintal`}
                    />
                  </>
                )}
              </div>
            )}

            {hs.calculation_ta && (
              <p className="text-xs text-gray-400 italic mt-3 pt-3 border-t border-gray-100">
                {hs.calculation_ta}
              </p>
            )}
          </div>
        )}

        {/* Price chart */}
        {!result.model_unavailable && chartData.length > 1 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">
              {t('14 நாள் விலை முன்னறிவிப்பு', '14-Day Price Forecast')}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => {
                    const dt = new Date(d)
                    return `${dt.getDate()}/${dt.getMonth() + 1}`
                  }}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`}
                  width={38}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ChartTooltip />} />

                {/* Confidence bands */}
                <Line dataKey="yhat_upper" stroke="#99f6e4" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                <Line dataKey="yhat_lower" stroke="#99f6e4" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />

                {/* Main forecast */}
                <Line
                  dataKey="yhat"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#0d9488', strokeWidth: 0 }}
                />

                {/* Today marker */}
                <ReferenceLine x={todayStr} stroke="#d1d5db" strokeDasharray="3 3" />

                {/* Peak dot */}
                {pf?.peak_date && pf.peak_price && (
                  <ReferenceDot
                    x={pf.peak_date}
                    y={pf.peak_price}
                    r={5}
                    fill="#0d9488"
                    stroke="white"
                    strokeWidth={2}
                    label={{
                      value: `₹${pf.peak_price.toFixed(0)}`,
                      position: 'top',
                      fontSize: 10,
                      fill: '#0d9488',
                      fontWeight: 600,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-center gap-5 mt-2">
              <LegendItem color="#0d9488" label={t('முன்னறிவிப்பு', 'Forecast')} />
              <LegendItem color="#99f6e4" label={t('வரம்பு', 'Range')} dashed />
            </div>
          </div>
        )}

        {/* Mandi comparison */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">
            {t('அருகில் உள்ள சந்தைகள்', 'Best Markets Near You')}
          </p>
          {result.mandis.length === 0 || result.mandis.every(m => m.net_price == null) ? (
            <p className="text-sm text-gray-400">
              {t('இன்று சந்தை விலை கிடைக்கவில்லை.', 'Market prices not available today.')}
            </p>
          ) : (
            <div className="space-y-2">
              {result.mandis.map(mandi => {
                const isBest = result.best_mandi?.mandi_id === mandi.mandi_id
                return (
                  <div
                    key={mandi.mandi_id}
                    className={cn(
                      'rounded-xl p-3 border',
                      isBest
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 bg-gray-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                          {mandi.name}
                          {isBest && (
                            <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-semibold">
                              {t('சிறந்தது', 'Best')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {mandi.distance_km}km · ₹{mandi.transport_cost_per_quintal} {t('போக்குவரத்து', 'transport')}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {mandi.net_price != null ? (
                          <>
                            <p className="text-sm font-bold text-gray-900">{fmt(mandi.net_price)}</p>
                            <p className="text-[10px] text-gray-400">{t('தூய விலை', 'net')}</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">{t('விலை இல்லை', 'Price not available')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historical note */}
        {hs?.historical_note_ta && (
          <p className="text-xs text-gray-400 italic px-1">{hs.historical_note_ta}</p>
        )}

        {/* Back button */}
        <button onClick={onBack} className="w-full btn-secondary">
          {t('மற்றொரு பயிர் பார்க்க →', 'Check another crop →')}
        </button>

      </div>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={cn('font-medium text-gray-900', valueClass)}>{value}</span>
    </div>
  )
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
      <span
        className="inline-block w-5 rounded-full"
        style={{
          height: 2,
          backgroundColor: color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
          opacity: dashed ? 0.8 : 1,
        }}
      />
      {label}
    </span>
  )
}
