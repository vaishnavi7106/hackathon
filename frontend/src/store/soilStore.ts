import { create } from 'zustand'
import type { PrescriptionResponse } from '@/types/soil'

interface SoilStore {
  // Remote data (cached)
  result: PrescriptionResponse | null
  loading: boolean
  error: string | null

  // Actions
  setResult: (result: PrescriptionResponse | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useSoilStore = create<SoilStore>((set) => ({
  result: null,
  loading: false,
  error: null,

  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ result: null, error: null, loading: false }),
}))
