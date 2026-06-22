import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FarmerProfile } from '@/types/api'

interface AuthSlice {
  farmerId: string | null
  token: string | null
  expiresAt: string | null
}

interface ProfileSlice {
  profile: FarmerProfile | null
}

interface FarmerStore extends AuthSlice, ProfileSlice {
  // Auth actions
  setAuth: (farmerId: string, token: string, expiresAt: string) => void
  clearAuth: () => void

  // Profile actions
  setProfile: (profile: FarmerProfile) => void

  // Fetch profile from server and seed into profileStore
  fetchAndSeedProfile: () => Promise<void>

  // Derived
  isLoggedIn: () => boolean
}

export const useFarmerStore = create<FarmerStore>()(
  persist(
    (set, get) => ({
      // Auth
      farmerId: null,
      token: null,
      expiresAt: null,

      // Profile
      profile: null,

      setAuth: (farmerId, token, expiresAt) =>
        set({ farmerId, token, expiresAt }),

      clearAuth: () =>
        set({ farmerId: null, token: null, expiresAt: null, profile: null }),

      setProfile: (profile) => set({ profile }),

      fetchAndSeedProfile: async () => {
        const { token } = get()
        if (!token) return
        try {
          const { farmerApi } = await import('@/api/farmer')
          const { useProfileStore } = await import('@/store/profileStore')
          const serverProfile = await farmerApi.getProfile()
          set({ profile: serverProfile })
          useProfileStore.getState().seedFromServer(serverProfile)
        } catch {
          // Silently ignore — offline or auth failure handled elsewhere
        }
      },

      isLoggedIn: () => {
        const { token, expiresAt } = get()
        if (!token || !expiresAt) return false
        return new Date(expiresAt) > new Date()
      },
    }),
    {
      name: 'uzhavar-farmer',
      partialize: (state) => ({
        farmerId: state.farmerId,
        token: state.token,
        expiresAt: state.expiresAt,
        profile: state.profile,
      }),
    },
  ),
)
