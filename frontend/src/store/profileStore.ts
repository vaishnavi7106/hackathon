import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type LocalProfile, EMPTY_PROFILE, computeCompletion } from '@/types/profile'

interface ProfileStore {
  profile: LocalProfile
  completionPct: number

  setField: <K extends keyof LocalProfile>(key: K, value: LocalProfile[K]) => void
  setProfile: (partial: Partial<LocalProfile>) => void
  resetProfile: () => void
  markOnboardingComplete: () => void

  // Convenience computed
  getMissingRequired: () => string[]
  getMissingRecommended: () => string[]
  hasBasicInfo: () => boolean
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: EMPTY_PROFILE,
      completionPct: 0,

      setField: (key, value) =>
        set((s) => {
          const updated = { ...s.profile, [key]: value, lastUpdated: new Date().toISOString() }
          return { profile: updated, completionPct: computeCompletion(updated) }
        }),

      setProfile: (partial) =>
        set((s) => {
          const updated = { ...s.profile, ...partial, lastUpdated: new Date().toISOString() }
          return { profile: updated, completionPct: computeCompletion(updated) }
        }),

      resetProfile: () =>
        set({ profile: EMPTY_PROFILE, completionPct: 0 }),

      markOnboardingComplete: () =>
        set((s) => ({
          profile: { ...s.profile, onboardingComplete: true, lastUpdated: new Date().toISOString() },
        })),

      getMissingRequired: () => {
        const { profile } = get()
        const missing: string[] = []
        if (!profile.name) missing.push('name')
        if (!profile.district) missing.push('district')
        if (!profile.primaryCrop) missing.push('primaryCrop')
        if (!profile.landSizeAcres) missing.push('landSizeAcres')
        if (profile.aadhaarLinked === null) missing.push('aadhaarLinked')
        if (!profile.incomeBand) missing.push('incomeBand')
        return missing
      },

      getMissingRecommended: () => {
        const { profile } = get()
        const missing: string[] = []
        if (!profile.age) missing.push('age')
        if (!profile.taluk) missing.push('taluk')
        if (!profile.landOwnership) missing.push('landOwnership')
        if (!profile.irrigationType) missing.push('irrigationType')
        if (profile.bankAccountLinked === null) missing.push('bankAccountLinked')
        return missing
      },

      hasBasicInfo: () => {
        const { profile } = get()
        return !!(profile.district && profile.primaryCrop && profile.landSizeAcres)
      },
    }),
    {
      name: 'uzhavar-profile',
    },
  ),
)
