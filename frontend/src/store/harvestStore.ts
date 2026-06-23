import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Harvest {
  id: string
  crop: string                      // English name
  cropTa: string                    // Tamil name
  quantity: number                  // quintals
  storage: 'home' | 'warehouse' | 'cold_storage'
  addedDate: string                 // YYYY-MM-DD
  recommendation: 'HOLD' | 'SELL' | null
  priceAtForecast: number | null
  forecastPeakPrice: number | null
  weeksToHold: number | null
  holdUntilDate: string | null
  netGainTotal: number | null       // net_gain_per_quintal × quantity
  lastChecked: string | null        // ISO datetime
  sold: boolean
}

interface HarvestStore {
  harvests: Harvest[]
  addHarvest: (h: Harvest) => void
  updateForecast: (id: string, patch: Partial<Harvest>) => void
  markSold: (id: string) => void
  removeHarvest: (id: string) => void
  activeHarvests: () => Harvest[]
}

export const useHarvestStore = create<HarvestStore>()(
  persist(
    (set, get) => ({
      harvests: [],

      addHarvest: (h) => set((s) => ({ harvests: [h, ...s.harvests] })),

      updateForecast: (id, patch) => set((s) => ({
        harvests: s.harvests.map((h) => h.id === id ? { ...h, ...patch } : h),
      })),

      markSold: (id) => set((s) => ({
        harvests: s.harvests.map((h) => h.id === id ? { ...h, sold: true } : h),
      })),

      removeHarvest: (id) => set((s) => ({
        harvests: s.harvests.filter((h) => h.id !== id),
      })),

      activeHarvests: () => get().harvests.filter((h) => !h.sold),
    }),
    { name: 'uzhavar-harvests' }
  )
)
