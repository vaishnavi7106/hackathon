import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ForecastRecord {
  id: string
  date: string               // ISO "YYYY-MM-DD"
  crop: string               // English name e.g. "Tomato"
  cropTa: string             // Tamil name
  district: string
  quantity: number           // quintals user entered
  storage: 'home' | 'warehouse' | 'cold_storage'
  recommendation: 'HOLD' | 'SELL'
  priceAtForecast: number    // ₹/quintal when forecast was made
  forecastPeakPrice: number | null
  weeksToHold: number | null
  holdUntilDate: string | null  // ISO date when hold period ends
  storageCostTotal: number | null  // storage_cost_per_quintal * weeksToHold * quantity
  netGainTotal: number | null     // net_gain_per_quintal * quantity
  resolved: boolean          // hold period has ended or user marked as done
  outcome: 'correct' | 'incorrect' | null  // user-marked outcome
}

interface ForecastStore {
  records: ForecastRecord[]
  addRecord: (r: ForecastRecord) => void
  resolveRecord: (id: string, outcome: 'correct' | 'incorrect') => void
  getActive: () => ForecastRecord | null
  getHistory: () => ForecastRecord[]
  markExpiredResolved: () => void
}

export const useForecastStore = create<ForecastStore>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (r) => set((s) => ({
        // Deactivate any prior unresolved records for same crop
        records: [
          ...s.records.map((x) =>
            !x.resolved && x.crop === r.crop ? { ...x, resolved: true } : x
          ),
          r,
        ],
      })),

      resolveRecord: (id, outcome) => set((s) => ({
        records: s.records.map((r) =>
          r.id === id ? { ...r, resolved: true, outcome } : r
        ),
      })),

      getActive: () => {
        const today = new Date().toISOString().slice(0, 10)
        // Also surface SELL records from today even if auto-resolved by old code (migration fix)
        return (
          get().records.find((r) => {
            if (r.recommendation === 'HOLD') return !r.resolved && (r.holdUntilDate ?? '') >= today
            if (r.recommendation === 'SELL') return r.date === today  // show SELL card for rest of today
            return false
          }) ?? null
        )
      },

      getHistory: () =>
        [...get().records]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 20),

      markExpiredResolved: () => {
        const today = new Date().toISOString().slice(0, 10)
        set((s) => ({
          records: s.records.map((r) => {
            if (r.resolved) return r
            if (r.recommendation === 'HOLD' && r.holdUntilDate && r.holdUntilDate < today) {
              return { ...r, resolved: true }
            }
            return r
          }),
        }))
      },
    }),
    { name: 'uzhavar-forecasts' },
  ),
)
