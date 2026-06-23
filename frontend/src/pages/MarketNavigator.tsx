import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceDot,
} from 'recharts'
import {
  ArrowLeft, History, TrendingUp, TrendingDown, CheckCircle2, Clock,
  ChevronDown, ChevronUp, MapPin, IndianRupee, CalendarDays,
  Truck, Star, Warehouse, Home, Thermometer, Plus, Sprout,
  ShoppingBag, PackageCheck, RefreshCw, Trash2, BarChart2,
} from 'lucide-react'
import { api } from '@/api/client'
import { useFarmerStore } from '@/store/farmerStore'
import { useForecastStore, type ForecastRecord } from '@/store/forecastStore'
import { useHarvestStore, type Harvest } from '@/store/harvestStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastPoint { date: string; yhat: number; yhat_lower: number | null; yhat_upper: number | null }
interface MandiInfo { mandi_id: string; name: string; distance_km: number | null; today_price: number | null; transport_cost_per_quintal: number | null; net_price: number | null }
interface HoldSellOut { recommendation: 'HOLD' | 'SELL'; today_price: number | null; forecast_peak_price: number | null; weeks_to_hold: number | null; storage_cost_per_quintal: number | null; net_gain_per_quintal: number | null; calculation_ta: string | null; historical_note_ta: string | null }
interface PriceForecastOut { mandi_id: string; series: ForecastPoint[]; peak_price: number | null; peak_date: string | null }
interface ForecastResponse { forecast_id: string; crop: string; generated_at: string; mandis: MandiInfo[]; best_mandi: MandiInfo | null; price_forecast: PriceForecastOut | null; hold_sell: HoldSellOut | null; model_unavailable: boolean; model_unavailable_note: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const CROPS = [
  { name: 'Tomato',                tamil: 'தக்காளி' },
  { name: 'Onion',                 tamil: 'வெங்காயம்' },
  { name: 'Banana - Green',        tamil: 'வாழைப்பழம்' },
  { name: 'Bhindi(Ladies Finger)', tamil: 'வெண்டைக்காய்' },
  { name: 'Bitter Gourd',          tamil: 'பாகற்காய்' },
  { name: 'Cabbage',               tamil: 'முட்டைக்கோஸ்' },
  { name: 'Coconut',               tamil: 'தேங்காய்' },
  { name: 'Green Chilli',          tamil: 'பச்சை மிளகாய்' },
  { name: 'Mint(Pudina)',          tamil: 'புதினா' },
  { name: 'Pumpkin',               tamil: 'பூசணிக்காய்' },
] as const

const STORAGE_OPTIONS = [
  { value: 'home'         as const, tamil: 'வீட்டு',  en: 'Home',      Icon: Home,        ratePerWeek: 30  },
  { value: 'warehouse'    as const, tamil: 'கிடங்கு', en: 'Warehouse', Icon: Warehouse,   ratePerWeek: 55  },
  { value: 'cold_storage' as const, tamil: 'குளிர்',  en: 'Cold',      Icon: Thermometer, ratePerWeek: 120 },
] as const

type Storage = 'home' | 'warehouse' | 'cold_storage'
type Screen  = 'harvests' | 'add' | 'result' | 'history'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addWeeks(weeks: number) {
  const d = new Date(); d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'இப்போது'
  if (m < 60) return `${m}நி முன்பு`
  return `${Math.floor(m / 60)}ம. முன்பு`
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</p>
}

function GradientHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '14px 16px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {onBack && (
        <button onClick={onBack} style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <ArrowLeft size={18} color="white" />
        </button>
      )}
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.2px' }}>{title}</h1>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

function LoadingSpinner() {
  return (
    <svg style={{ animation: 'spin 1s linear infinite', width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  const main = payload.find(p => p.dataKey === 'yhat')
  if (!main) return null
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ margin: 0, color: '#94A3B8' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontWeight: 700, color: '#0A5C47' }}>₹{main.value?.toFixed(0)}</p>
    </div>
  )
}

// ─── Harvest Card ─────────────────────────────────────────────────────────────

function HarvestCard({ harvest, isTamil, onRecheck, onMarkSold, onRemove, loading }: {
  harvest: Harvest; isTamil: boolean
  onRecheck: () => void; onMarkSold: () => void; onRemove: () => void; loading: boolean
}) {
  const isSell    = harvest.recommendation === 'SELL'
  const isHold    = harvest.recommendation === 'HOLD'
  const noRec     = harvest.recommendation === null
  const today     = new Date().toISOString().slice(0, 10)
  const isExpired = isHold && harvest.holdUntilDate != null && harvest.holdUntilDate <= today

  const leftColor   = isSell ? '#DC2626' : isHold ? '#0A5C47' : '#CBD5E1'
  const storageLabel = STORAGE_OPTIONS.find(o => o.value === harvest.storage)?.tamil ?? harvest.storage
  const cropName    = isTamil ? harvest.cropTa : harvest.crop

  return (
    <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderLeft: `3px solid ${leftColor}` }}>
      <div style={{ padding: '14px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 19, background: noRec ? '#F1F5F9' : isSell ? '#FEE2E2' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sprout size={18} color={noRec ? '#94A3B8' : isSell ? '#DC2626' : '#0A5C47'} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1E293B' }}>{cropName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                {harvest.quantity} குவி. · {storageLabel}
              </p>
            </div>
          </div>
          {!noRec && (
            <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20, flexShrink: 0, background: isSell ? '#FEE2E2' : isExpired ? '#FEF3C7' : '#DCFCE7', color: isSell ? '#DC2626' : isExpired ? '#D97706' : '#065F46' }}>
              {isSell ? 'இப்போதே விற்கவும்' : isExpired ? 'இப்போதே விற்கவும்' : `காத்திரு${harvest.weeksToHold ? ' · ' + harvest.weeksToHold * 7 + ' நாள்' : ''}`}
            </span>
          )}
        </div>

        {/* Forecast data */}
        {!noRec && (
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {harvest.priceAtForecast != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                <IndianRupee size={12} color="#64748B" />{fmt(harvest.priceAtForecast)}/குவி.
              </span>
            )}
            {harvest.holdUntilDate && isHold && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748B' }}>
                <CalendarDays size={12} color="#64748B" />வரை: {fmtDate(harvest.holdUntilDate)}
              </span>
            )}
            {harvest.netGainTotal != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: harvest.netGainTotal >= 0 ? '#059669' : '#DC2626' }}>
                {harvest.netGainTotal >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {harvest.netGainTotal >= 0 ? '+' : '−'}₹{Math.abs(harvest.netGainTotal).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        )}

        {isExpired && (
          <div style={{ marginTop: 10, background: '#FFFBEB', borderRadius: 8, padding: '7px 10px', border: '1px solid #FDE68A' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#D97706' }}>காத்திருக்கும் காலம் முடிந்தது — இப்போது விற்கவும்</p>
          </div>
        )}

        {harvest.lastChecked && (
          <p style={{ margin: '7px 0 0', fontSize: 10, color: '#CBD5E1' }}>கடைசியாக சரிபார்த்தது: {timeAgo(harvest.lastChecked)}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {noRec ? (
            <button onClick={onRecheck} disabled={loading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0A5C47', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <LoadingSpinner /> : <BarChart2 size={13} color="white" />}
              விலை பார்க்க
            </button>
          ) : (
            <button onClick={onRecheck} disabled={loading}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'white', color: '#0A5C47', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? <LoadingSpinner /> : <RefreshCw size={13} color="#0A5C47" />}
              மீண்டும் சரிபார்
            </button>
          )}
          {(isSell || isExpired) && (
            <button onClick={onMarkSold}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#DCFCE7', color: '#065F46', border: '1.5px solid #A7F3D0', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <PackageCheck size={13} color="#065F46" />
              விற்றதாக குறி
            </button>
          )}
          {noRec && (
            <button onClick={onRemove}
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEE2E2', border: 'none', borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
              <Trash2 size={14} color="#DC2626" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MarketNavigator() {
  const profile       = useFarmerStore(s => s.profile)
  const isTamil       = true
  const t             = (ta: string, _en: string) => ta
  const { addRecord } = useForecastStore()
  const { addHarvest, updateForecast, markSold, removeHarvest, activeHarvests, harvests } = useHarvestStore()

  const [screen,       setScreen]       = useState<Screen>('harvests')
  const [recheckId,    setRecheckId]    = useState<string | null>(null)
  const [recheckingId, setRecheckingId] = useState<string | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
  const [storage,      setStorage]      = useState<Storage>('home')
  const [quantity,     setQuantity]     = useState(10)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [result,       setResult]       = useState<ForecastResponse | null>(null)
  const [resultQty,    setResultQty]    = useState(10)

  useEffect(() => {
    if (profile?.storage_facility) setStorage(profile.storage_facility as Storage)
  }, [profile?.storage_facility])

  const qty = Math.max(1, Number(quantity) || 1)

  async function handleFetch(cropOverride?: string, qtyOverride?: number, storageOverride?: Storage, harvestIdOverride?: string) {
    const crop = cropOverride ?? selectedCrop
    const q    = qtyOverride  ?? qty
    const st   = storageOverride ?? storage
    if (!crop) return

    setLoading(true); setError(null)
    try {
      const data = await api.post<ForecastResponse>('/forecast', { crop, storage_facility: st })
      const hs   = data.hold_sell
      const cropInfo    = CROPS.find(c => c.name === crop)
      const weeksToHold = hs?.weeks_to_hold ?? 0
      const now         = new Date().toISOString()
      const today       = now.slice(0, 10)

      const forecastPatch = {
        recommendation:    hs?.recommendation ?? null,
        priceAtForecast:   hs?.today_price ?? null,
        forecastPeakPrice: hs?.forecast_peak_price ?? null,
        weeksToHold,
        holdUntilDate:     hs?.recommendation === 'HOLD' && weeksToHold > 0 ? addWeeks(weeksToHold) : null,
        netGainTotal:      hs?.net_gain_per_quintal != null ? hs.net_gain_per_quintal * q : null,
        lastChecked:       now,
      }

      if (harvestIdOverride) {
        updateForecast(harvestIdOverride, forecastPatch)
      } else {
        const newHarvest: Harvest = {
          id: crypto.randomUUID(), crop, cropTa: cropInfo?.tamil ?? crop,
          quantity: q, storage: st, addedDate: today, sold: false, ...forecastPatch,
        }
        addHarvest(newHarvest)
        setRecheckId(newHarvest.id)
      }

      // Keep forecastStore updated for home-page alert
      if (hs) {
        const record: ForecastRecord = {
          id: crypto.randomUUID(), date: today, crop, cropTa: cropInfo?.tamil ?? crop,
          district: profile?.district ?? '', quantity: q, storage: st,
          recommendation: hs.recommendation, priceAtForecast: hs.today_price ?? 0,
          forecastPeakPrice: hs.forecast_peak_price, weeksToHold,
          holdUntilDate: hs.recommendation === 'HOLD' && weeksToHold > 0 ? addWeeks(weeksToHold) : null,
          storageCostTotal: hs.storage_cost_per_quintal != null ? hs.storage_cost_per_quintal * q : null,
          netGainTotal: hs.net_gain_per_quintal != null ? hs.net_gain_per_quintal * q : null,
          resolved: false, outcome: null,
        }
        addRecord(record)
      }

      setResult(data); setResultQty(q)
      setScreen('result')
    } catch {
      setError(t('சந்தை தகவல் கிடைக்கவில்லை.', 'Could not fetch market data.'))
    } finally {
      setLoading(false); setRecheckingId(null)
    }
  }

  function startRecheck(harvest: Harvest) {
    setRecheckingId(harvest.id); setRecheckId(harvest.id)
    handleFetch(harvest.crop, harvest.quantity, harvest.storage, harvest.id)
  }

  function goToAdd() { setSelectedCrop(null); setQuantity(10); setError(null); setScreen('add') }
  function backToHarvests() { setScreen('harvests'); setResult(null); setError(null); setRecheckId(null) }

  // ── Screen routing ─────────────────────────────────────────────────────────

  if (screen === 'result' && result) {
    return <ResultScreen result={result} isTamil={isTamil} t={t} onBack={backToHarvests} quantity={resultQty} storage={storage} />
  }
  if (screen === 'history') {
    return <HistoryScreen isTamil={isTamil} t={t} onBack={() => setScreen('harvests')} />
  }
  if (screen === 'add') {
    return (
      <AddHarvestScreen
        isTamil={isTamil} t={t} onBack={() => setScreen('harvests')}
        selectedCrop={selectedCrop} setSelectedCrop={setSelectedCrop}
        quantity={qty} setQuantity={setQuantity}
        storage={storage} setStorage={setStorage}
        loading={loading} error={error}
        onFetch={() => handleFetch()}
      />
    )
  }

  // ── My Harvests screen ─────────────────────────────────────────────────────

  const active = activeHarvests()
  const sold   = harvests.filter(h => h.sold)

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>
      <GradientHeader
        title={t('என் அறுவடைகள்', 'My Harvests')}
        subtitle={t('விற்கணுமா? காக்கணுமா? இங்கே தீர்மானிக்கவும்.', 'Track and decide when to sell')}
        right={
          <button onClick={() => setScreen('history')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', flexShrink: 0 }}>
            <History size={13} color="white" />
            {t('வரலாறு', 'History')}
          </button>
        }
      />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Empty state */}
        {active.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={26} color="#0A5C47" />
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
              {t('அறுவடை இல்லை', 'No harvests yet')}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8', maxWidth: 220, lineHeight: 1.5 }}>
              {t('உங்கள் பயிரை சேர்த்து சந்தை விலை பாருங்கள்.', 'Add a harvest to check market prices and get sell recommendations.')}
            </p>
          </div>
        )}

        {/* Active harvest cards */}
        {active.map(harvest => (
          <HarvestCard
            key={harvest.id} harvest={harvest} isTamil={isTamil}
            loading={recheckingId === harvest.id}
            onRecheck={() => startRecheck(harvest)}
            onMarkSold={() => markSold(harvest.id)}
            onRemove={() => removeHarvest(harvest.id)}
          />
        ))}

        {/* Add new harvest button */}
        <button onClick={goToAdd}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'white', color: '#0A5C47', border: '1.5px dashed #A7F3D0', borderRadius: 14, padding: '14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <Plus size={16} color="#0A5C47" />
          {t('புதிய அறுவடை சேர்', 'Add New Harvest')}
        </button>

        {/* Sold harvests */}
        {sold.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginTop: 4 }}>
            <div style={{ padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={13} color="#94A3B8" />
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('விற்கப்பட்டவை', 'Sold')} ({sold.length})
              </p>
            </div>
            {sold.map((h, i) => (
              <div key={h.id} style={{ padding: '11px 16px', borderBottom: i < sold.length - 1 ? '1px solid #F8FAFC' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PackageCheck size={14} color="#94A3B8" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{isTamil ? h.cropTa : h.crop}</span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{h.quantity} குவி.</span>
                </div>
                <button onClick={() => removeHarvest(h.id)}
                  style={{ width: 28, height: 28, borderRadius: 14, background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={12} color="#94A3B8" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Harvest Screen ────────────────────────────────────────────────────────

function AddHarvestScreen({ isTamil, t, onBack, selectedCrop, setSelectedCrop, quantity, setQuantity, storage, setStorage, loading, error, onFetch }: {
  isTamil: boolean; t: (ta: string, en: string) => string; onBack: () => void
  selectedCrop: string | null; setSelectedCrop: (c: string) => void
  quantity: number; setQuantity: (n: number) => void
  storage: Storage; setStorage: (s: Storage) => void
  loading: boolean; error: string | null; onFetch: () => void
}) {
  const storageRate = STORAGE_OPTIONS.find(o => o.value === storage)?.ratePerWeek ?? 30

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>
      <GradientHeader
        title={t('புதிய அறுவடை', 'New Harvest')}
        subtitle={t('பயிர், அளவு, சேமிப்பு தேர்வு செய்யுங்கள்', 'Select crop, quantity and storage')}
        onBack={onBack}
      />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Crop picker */}
        <section>
          <SLabel>{t('பயிர் தேர்வு', 'Select Crop')}</SLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CROPS.map(crop => {
              const isSel = selectedCrop === crop.name
              return (
                <button key={crop.name} onClick={() => setSelectedCrop(crop.name)}
                  style={{ background: isSel ? '#F0FDF4' : 'white', borderRadius: 14, padding: '13px 12px', textAlign: 'left', cursor: 'pointer', border: `1.5px solid ${isSel ? '#0A5C47' : '#E2E8F0'}`, boxShadow: isSel ? '0 0 0 1px #0A5C47' : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.12s' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isSel ? '#0A5C47' : '#1E293B' }}>{crop.tamil}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Quantity */}
        <section>
          <SLabel>{t('அளவு (குவிண்டால்)', 'Quantity (Quintals)')}</SLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', borderRadius: 14, padding: '10px 14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{ width: 34, height: 34, borderRadius: 17, background: '#F1F5F9', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#374151' }}>−</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#1E293B' }}>{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)}
              style={{ width: 34, height: 34, borderRadius: 17, background: '#DCFCE7', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A5C47', flexShrink: 0 }}>+</button>
            <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>குவிண்டால்</span>
          </div>
        </section>

        {/* Storage decision cards */}
        <section>
          <SLabel>{t('சேமிப்பு வகை', 'Storage Type')}</SLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {STORAGE_OPTIONS.map(({ value, tamil, Icon, ratePerWeek }) => {
              const isActive = storage === value
              return (
                <button key={value} onClick={() => setStorage(value)}
                  style={{ flex: 1, padding: '12px 8px', borderRadius: 14, border: `1.5px solid ${isActive ? '#0A5C47' : '#E2E8F0'}`, background: isActive ? '#F0FDF4' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: isActive ? '#DCFCE7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={isActive ? '#0A5C47' : '#94A3B8'} />
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isActive ? '#0A5C47' : '#374151' }}>{tamil}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>₹{ratePerWeek}/வாரம்</p>
                </button>
              )
            })}
          </div>
          <p style={{ marginTop: 6, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
            {quantity} குவி. × ₹{storageRate} = ₹{(storageRate * quantity).toLocaleString('en-IN')}/{t('வாரம்', 'week')}
          </p>
        </section>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '12px 14px', border: '1px solid #FECACA', borderLeft: '3px solid #EF4444' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>{error}</p>
          </div>
        )}

        {/* CTA */}
        <button onClick={onFetch} disabled={!selectedCrop || loading}
          style={{ width: '100%', background: selectedCrop ? '#0A5C47' : '#CBD5E1', color: 'white', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 800, cursor: selectedCrop ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading
            ? <><LoadingSpinner />ஏற்றுகிறது...</>
            : <><BarChart2 size={16} color="white" />சந்தை விலை பார்க்க</>}
        </button>
      </div>
    </div>
  )
}

// ─── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({ result, isTamil, t, onBack, quantity, storage }: {
  result: ForecastResponse; isTamil: boolean; t: (ta: string, en: string) => string
  onBack: () => void; quantity: number; storage: Storage
}) {
  const hs       = result.hold_sell
  const pf       = result.price_forecast
  const isSell   = hs?.recommendation === 'SELL'
  const cropInfo = CROPS.find(c => c.name.toLowerCase() === result.crop.toLowerCase())
  const chartData = (pf?.series ?? []).filter(p => p.yhat > 0)
  const todayStr  = new Date().toISOString().split('T')[0]
  const [showWhy, setShowWhy] = useState(false)

  const storageRate  = STORAGE_OPTIONS.find(o => o.value === storage)?.ratePerWeek ?? 30
  const weeksToHold  = hs?.weeks_to_hold ?? 0
  const totalStorage = storageRate * quantity * weeksToHold
  const totalNetGain = hs?.net_gain_per_quintal != null ? hs.net_gain_per_quintal * quantity : null

  const accent       = isSell ? '#DC2626' : '#0A5C47'
  const accentLight  = isSell ? '#FEE2E2' : '#DCFCE7'
  const accentBg     = isSell ? '#FFF1F2' : '#F0FDF4'
  const accentBorder = isSell ? '#FCA5A5' : '#86EFAC'
  const cropName     = isTamil ? cropInfo?.tamil ?? result.crop : result.crop

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>
      <GradientHeader
        title={cropName}
        subtitle={`${quantity} ${t('குவிண்டால்', 'quintals')} · 14 ${t('நாள் முன்னறிவிப்பு', 'day forecast')}`}
        onBack={onBack}
      />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Model unavailable */}
        {result.model_unavailable && (
          <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 14px', border: '1px solid #FDE68A', borderLeft: '3px solid #D97706', display: 'flex', gap: 10 }}>
            <TrendingDown size={16} color="#D97706" />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400E' }}>{t('விலை முன்னறிவிப்பு கிடைக்கவில்லை', 'Price forecast unavailable')}</p>
              {result.model_unavailable_note && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#B45309' }}>{result.model_unavailable_note}</p>}
            </div>
          </div>
        )}

        {/* ── HERO RECOMMENDATION ───────────────────────────────────── */}
        {hs && (
          <div style={{ background: accentBg, borderRadius: 18, padding: '20px 18px', border: `1px solid ${accentBorder}`, borderLeft: `4px solid ${accent}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: accent, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                  {isSell
                    ? t('இப்போதே விற்கவும்', 'SELL NOW')
                    : weeksToHold
                    ? t(`${weeksToHold} வாரம் காத்திருக்கவும்`, `HOLD ${weeksToHold} WEEK${weeksToHold > 1 ? 'S' : ''}`)
                    : t('காத்திருக்கவும்', 'HOLD')}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: isSell ? '#991B1B' : '#065F46' }}>
                  {isSell
                    ? t('விலை குறையும் என்று எதிர்பார்க்கப்படுகிறது', 'Price expected to decline')
                    : pf?.peak_date
                    ? t(`உச்ச விலை ${fmtDate(pf.peak_date)} அன்று`, `Peak price expected ${fmtDate(pf.peak_date)}`)
                    : t('விலை உயரும் என்று எதிர்பார்க்கப்படுகிறது', 'Price expected to rise')}
                </p>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 25, background: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSell ? <TrendingDown size={24} color={accent} /> : <TrendingUp size={24} color={accent} />}
              </div>
            </div>

            {hs.today_price != null && (
              <>
                <div style={{ height: 1, background: isSell ? '#FCA5A5' : '#86EFAC', margin: '14px 0' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <MetricTile label={t('இன்றைய விலை', "Today's price")} value={`${fmt(hs.today_price)}/குவி.`} accent={accent} bg={accentLight} icon={<IndianRupee size={13} color={accent} />} />
                  {isSell
                    ? <MetricTile label={t('மொத்த வருமானம்', 'Revenue if sold')} value={`₹${(hs.today_price * quantity).toLocaleString('en-IN')}`} accent={accent} bg={accentLight} icon={<ShoppingBag size={13} color={accent} />} bold />
                    : <MetricTile label={t('உச்ச விலை', 'Peak price')} value={fmt(hs.forecast_peak_price)} accent={accent} bg={accentLight} icon={<TrendingUp size={13} color={accent} />} />}
                </div>

                {!isSell && totalNetGain != null && (
                  <div style={{ marginTop: 8, background: accentLight, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{t('தூய லாபம் (மொத்தம்)', 'Net gain (total)')}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: totalNetGain >= 0 ? accent : '#DC2626' }}>
                      {totalNetGain >= 0 ? '+' : '−'}₹{Math.abs(totalNetGain).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {!isSell && weeksToHold > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}>
                      <Warehouse size={12} color="#64748B" />
                      {t('சேமிப்பு செலவு', 'Storage cost')} ({weeksToHold}வார × {quantity}குவி.)
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>₹{totalStorage.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── WHY? COLLAPSIBLE ─────────────────────────────────────── */}
        {(hs?.calculation_ta || hs?.historical_note_ta) && (
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <button onClick={() => setShowWhy(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{t('ஏன் இந்த முடிவு?', 'Why this recommendation?')}</span>
              {showWhy ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
            </button>
            {showWhy && (
              <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1F5F9' }}>
                {hs?.calculation_ta && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{hs.calculation_ta}</p>}
                {hs?.historical_note_ta && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B', fontStyle: 'italic', lineHeight: 1.5 }}>{hs.historical_note_ta}</p>}
              </div>
            )}
          </div>
        )}

        {/* ── BEST MARKET ──────────────────────────────────────────── */}
        {result.best_mandi?.net_price != null && (
          <div style={{ background: '#F0FDF4', borderRadius: 14, padding: '14px 16px', border: '1px solid #A7F3D0', borderLeft: '3px solid #0A5C47', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Star size={13} color="#0A5C47" />
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0A5C47', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('சிறந்த சந்தை', 'Best Market')}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{result.best_mandi.name}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><MapPin size={11} color="#64748B" />{result.best_mandi.distance_km ?? 0}km</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Truck size={11} color="#64748B" />₹{result.best_mandi.transport_cost_per_quintal} {t('போக்குவரத்து', 'transport')}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0A5C47' }}>{fmt(result.best_mandi.net_price)}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10, color: '#64748B' }}>{t('தூய விலை/குவி.', 'net / quintal')}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── OTHER MARKETS ─────────────────────────────────────────── */}
        {result.mandis.filter(m => m.mandi_id !== result.best_mandi?.mandi_id && m.net_price != null).length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('மற்ற சந்தைகள்', 'Other Markets')}</p>
            </div>
            {result.mandis.filter(m => m.mandi_id !== result.best_mandi?.mandi_id && m.net_price != null).map((m, i, arr) => (
              <div key={m.mandi_id} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F8FAFC' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>{m.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>{m.distance_km}km · ₹{m.transport_cost_per_quintal} {t('போக்குவரத்து', 'transport')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{fmt(m.net_price)}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 10, color: '#94A3B8' }}>{t('தூய விலை', 'net')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CHART (secondary) ─────────────────────────────────────── */}
        {!result.model_unavailable && chartData.length > 1 && (
          <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('14 நாள் விலை போக்கு', '14-Day Price Trend')}</p>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tickFormatter={d => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}` }} tick={{ fontSize: 9, fill: '#9ca3af' }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `₹${(v / 1000).toFixed(1)}k`} width={38} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <Line dataKey="yhat_upper" stroke="#8FD1BE" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                <Line dataKey="yhat_lower" stroke="#8FD1BE" strokeDasharray="4 3" strokeWidth={1} dot={false} legendType="none" />
                <Line dataKey="yhat" stroke="#0A5C47" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#0A5C47', strokeWidth: 0 }} />
                <ReferenceLine x={todayStr} stroke="#d1d5db" strokeDasharray="3 3" />
                {pf?.peak_date && pf.peak_price && (
                  <ReferenceDot x={pf.peak_date} y={pf.peak_price} r={5} fill="#0A5C47" stroke="white" strokeWidth={2}
                    label={{ value: `₹${pf.peak_price.toFixed(0)}`, position: 'top', fontSize: 10, fill: '#0A5C47', fontWeight: 600 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Back */}
        <button onClick={onBack}
          style={{ width: '100%', background: 'white', color: '#0A5C47', border: '1.5px solid #A7F3D0', borderRadius: 14, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ArrowLeft size={15} color="#0A5C47" />
          {t('என் அறுவடைகளுக்கு திரும்பு', 'Back to My Harvests')}
        </button>
      </div>
    </div>
  )
}

// ─── Metric Tile ──────────────────────────────────────────────────────────────

function MetricTile({ icon, label, value, accent, bg, bold }: { icon: React.ReactNode; label: string; value: string; accent: string; bg: string; bold?: boolean }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '9px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, color: accent, opacity: 0.8, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 700, color: accent, lineHeight: 1.2 }}>{value}</p>
    </div>
  )
}

// ─── History Screen ────────────────────────────────────────────────────────────

function HistoryScreen({ isTamil, t, onBack }: { isTamil: boolean; t: (ta: string, en: string) => string; onBack: () => void }) {
  const { getHistory, resolveRecord } = useForecastStore()
  const history = getHistory()

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>
      <GradientHeader
        title={t('முன்னறிவிப்பு வரலாறு', 'Forecast History')}
        subtitle={`${history.length} ${t('பதிவுகள்', 'records')}`}
        onBack={onBack}
      />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 13, color: '#94A3B8' }}>{t('இதுவரை முன்னறிவிப்பு இல்லை', 'No forecasts yet')}</p>
          </div>
        )}
        {history.map((r) => {
          const isSell   = r.recommendation === 'SELL'
          const expired  = r.holdUntilDate && r.holdUntilDate < new Date().toISOString().slice(0, 10)
          return (
            <div key={r.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', borderLeft: `3px solid ${r.resolved ? '#CBD5E1' : isSell ? '#EF4444' : '#0A5C47'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{fmtDateShort(r.date)}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{isTamil ? r.cropTa : r.crop}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'white', padding: '2px 8px', borderRadius: 5, background: isSell ? '#EF4444' : '#0A5C47' }}>
                      {isSell ? 'விற்க' : 'காத்திரு'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{r.quantity} குவி. · ₹{r.priceAtForecast.toLocaleString('en-IN')}/குவி.</span>
                    {r.recommendation === 'HOLD' && r.holdUntilDate && (
                      <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />{fmtDate(r.holdUntilDate)} வரை
                      </span>
                    )}
                  </div>
                  {r.netGainTotal != null && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: r.netGainTotal >= 0 ? '#059669' : '#DC2626' }}>
                      {r.netGainTotal >= 0 ? '▲' : '▼'} ₹{Math.abs(r.netGainTotal).toLocaleString('en-IN')} {t('மொத்த லாபம்', 'total gain')}
                    </p>
                  )}
                  {r.outcome && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 600, color: r.outcome === 'correct' ? '#059669' : '#DC2626', background: r.outcome === 'correct' ? '#DCFCE7' : '#FEE2E2', padding: '2px 8px', borderRadius: 5 }}>
                      {r.outcome === 'correct' ? <CheckCircle2 size={11} /> : <TrendingDown size={11} />}
                      {r.outcome === 'correct' ? t('சரியான முடிவு', 'Correct') : t('தவறான முடிவு', 'Incorrect')}
                    </span>
                  )}
                  {!r.outcome && r.resolved && r.recommendation === 'HOLD' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{t('விலை உயர்ந்ததா?', 'Did price rise?')}</span>
                      <button onClick={() => resolveRecord(r.id, 'correct')} style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#DCFCE7', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>✓ {t('ஆம்', 'Yes')}</button>
                      <button onClick={() => resolveRecord(r.id, 'incorrect')} style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>✗ {t('இல்லை', 'No')}</button>
                    </div>
                  )}
                  {!r.resolved && expired && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#D97706', fontWeight: 700 }}>{t('காத்திருக்கும் காலம் முடிந்தது', 'Hold period ended')}</p>
                  )}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, background: isSell ? '#FEE2E2' : '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSell ? <TrendingDown size={16} color="#DC2626" /> : <TrendingUp size={16} color="#059669" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
