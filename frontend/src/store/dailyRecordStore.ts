import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DailyRecord } from '@/types/dailyRecord'

const MAX_HISTORY = 90

interface DailyRecordStore {
  todayByCrop: Record<string, DailyRecord>            // cropId → today's record
  historyByCrop: Record<string, DailyRecord[]>        // cropId → last 90 days, most recent first
  syncQueue: DailyRecord[]                            // records not yet synced to backend
  lastCalculatedAt: string | null                     // ISO timestamp of last full calculation
  lastPlantingDateUsedByCrop: Record<string, string>  // cropId → plantingDate used at last calc
  isCalculating: boolean

  setTodayForCrop: (cropId: string, record: DailyRecord) => void
  addToHistoryForCrop: (cropId: string, record: DailyRecord) => void
  setHistoryForCrop: (cropId: string, records: DailyRecord[]) => void
  confirmIrrigationForCrop: (cropId: string, date: string, confirmed: boolean) => void
  confirmFertilizerForCrop: (cropId: string, date: string, confirmed: boolean) => void
  addToSyncQueue: (record: DailyRecord) => void
  clearSyncQueue: () => void
  setLastCalculatedAt: (ts: string) => void
  setLastPlantingDateUsedForCrop: (cropId: string, v: string) => void
  setCalculating: (v: boolean) => void
}

export const useDailyRecordStore = create<DailyRecordStore>()(
  persist(
    (set, get) => ({
      todayByCrop: {},
      historyByCrop: {},
      syncQueue: [],
      lastCalculatedAt: null,
      lastPlantingDateUsedByCrop: {},
      isCalculating: false,

      setTodayForCrop: (cropId, record) =>
        set((s) => ({ todayByCrop: { ...s.todayByCrop, [cropId]: record } })),

      addToHistoryForCrop: (cropId, record) => {
        const existing = (get().historyByCrop[cropId] ?? []).filter((r) => r.date !== record.date)
        const updated = [record, ...existing].slice(0, MAX_HISTORY)
        set((s) => ({ historyByCrop: { ...s.historyByCrop, [cropId]: updated } }))
      },

      setHistoryForCrop: (cropId, records) =>
        set((s) => ({ historyByCrop: { ...s.historyByCrop, [cropId]: records.slice(0, MAX_HISTORY) } })),

      confirmIrrigationForCrop: (cropId, date, confirmed) => {
        const patchRecords = (records: DailyRecord[]) =>
          records.map((r) => (r.date === date ? { ...r, irrigation_confirmed: confirmed } : r))
        const today = get().todayByCrop[cropId]
        set((s) => ({
          historyByCrop: {
            ...s.historyByCrop,
            [cropId]: patchRecords(s.historyByCrop[cropId] ?? []),
          },
          todayByCrop: {
            ...s.todayByCrop,
            ...(today?.date === date
              ? { [cropId]: { ...today, irrigation_confirmed: confirmed } }
              : {}),
          },
        }))
      },

      confirmFertilizerForCrop: (cropId, date, confirmed) => {
        const patchRecords = (records: DailyRecord[]) =>
          records.map((r) => (r.date === date ? { ...r, fertilizer_confirmed: confirmed } : r))
        const today = get().todayByCrop[cropId]
        set((s) => ({
          historyByCrop: {
            ...s.historyByCrop,
            [cropId]: patchRecords(s.historyByCrop[cropId] ?? []),
          },
          todayByCrop: {
            ...s.todayByCrop,
            ...(today?.date === date
              ? { [cropId]: { ...today, fertilizer_confirmed: confirmed } }
              : {}),
          },
        }))
      },

      addToSyncQueue: (record) => {
        const existing = get().syncQueue.filter(
          (r) => !(r.date === record.date && r.cropId === record.cropId),
        )
        set({ syncQueue: [...existing, record] })
      },

      clearSyncQueue: () => set({ syncQueue: [] }),

      setLastCalculatedAt: (ts) => set({ lastCalculatedAt: ts }),

      setLastPlantingDateUsedForCrop: (cropId, v) =>
        set((s) => ({
          lastPlantingDateUsedByCrop: { ...s.lastPlantingDateUsedByCrop, [cropId]: v },
        })),

      setCalculating: (v) => set({ isCalculating: v }),
    }),
    {
      name: 'uzhavar-daily-records',
    },
  ),
)
