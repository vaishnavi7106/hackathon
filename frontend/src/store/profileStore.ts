import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type LocalProfile,
  type FarmerCrop,
  EMPTY_PROFILE,
  computeCompletion,
  PILLAR_REQUIREMENTS,
  syncCropCompat,
  migrateProfileCrops,
  type Gender,
  type IrrigationType,
  type Season,
  type LandOwnership,
  type SoilType,
  type ExtendedIncomeBand,
} from '@/types/profile'
import type { FarmerProfile } from '@/types/api'

interface ProfileStore {
  profile: LocalProfile
  completionPct: number

  setField: <K extends keyof LocalProfile>(key: K, value: LocalProfile[K]) => void
  setProfile: (partial: Partial<LocalProfile>) => void
  resetProfile: () => void
  markOnboardingComplete: () => void
  markServerSynced: () => void

  // Multi-crop CRUD
  addCrop: (crop: Omit<FarmerCrop, 'id'>) => void
  updateCrop: (cropId: string, updates: Partial<Omit<FarmerCrop, 'id'>>) => void
  removeCrop: (cropId: string) => void

  // Seed from server response after login/register
  seedFromServer: (serverProfile: FarmerProfile) => void

  // Convenience computed
  getMissingRequired: () => (keyof LocalProfile)[]
  getMissingForPillar: (pillar: keyof typeof PILLAR_REQUIREMENTS) => string[]
  hasBasicInfo: () => boolean
}

function recompute(profile: LocalProfile) {
  return { profile, completionPct: computeCompletion(profile) }
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profile: EMPTY_PROFILE,
      completionPct: 0,

      setField: (key, value) =>
        set((s) => {
          const updated = syncCropCompat({
            ...s.profile,
            [key]: value,
            lastUpdated: new Date().toISOString(),
          })
          return recompute(updated)
        }),

      setProfile: (partial) =>
        set((s) => {
          const updated = syncCropCompat({
            ...s.profile,
            ...partial,
            lastUpdated: new Date().toISOString(),
          })
          return recompute(updated)
        }),

      resetProfile: () => set({ profile: EMPTY_PROFILE, completionPct: 0 }),

      markOnboardingComplete: () =>
        set((s) => ({
          profile: {
            ...s.profile,
            onboardingComplete: true,
            lastUpdated: new Date().toISOString(),
          },
        })),

      markServerSynced: () =>
        set((s) => ({
          profile: { ...s.profile, serverSyncedAt: new Date().toISOString() },
        })),

      addCrop: (cropData) =>
        set((s) => {
          if (s.profile.crops.length >= 5) return s
          const newCrop: FarmerCrop = { id: crypto.randomUUID(), ...cropData }
          const crops = [...s.profile.crops, newCrop]
          const updated = syncCropCompat({
            ...s.profile,
            crops,
            lastUpdated: new Date().toISOString(),
          })
          return recompute(updated)
        }),

      updateCrop: (cropId, updates) =>
        set((s) => {
          const crops = s.profile.crops.map((c) =>
            c.id === cropId ? { ...c, ...updates } : c,
          )
          const updated = syncCropCompat({
            ...s.profile,
            crops,
            lastUpdated: new Date().toISOString(),
          })
          return recompute(updated)
        }),

      removeCrop: (cropId) =>
        set((s) => {
          const crops = s.profile.crops.filter((c) => c.id !== cropId)
          const updated = syncCropCompat({
            ...s.profile,
            crops,
            lastUpdated: new Date().toISOString(),
          })
          return recompute(updated)
        }),

      seedFromServer: (serverProfile: FarmerProfile) => {
        set((s) => {
          const patch: Partial<LocalProfile> = {}

          if (serverProfile.name) patch.name = serverProfile.name
          if (serverProfile.phone) patch.phone = serverProfile.phone
          if (serverProfile.district) patch.district = serverProfile.district
          if ((serverProfile as any).taluk) patch.taluk = (serverProfile as any).taluk
          if (serverProfile.village) patch.village = serverProfile.village
          if ((serverProfile as any).gender) patch.gender = (serverProfile as any).gender as Gender
          if (serverProfile.language) patch.language = serverProfile.language as 'ta' | 'en'
          if (serverProfile.age) patch.age = String(serverProfile.age)
          if (serverProfile.land_size_acres) patch.landSizeAcres = String(serverProfile.land_size_acres)
          if (serverProfile.land_ownership) patch.landOwnership = serverProfile.land_ownership as LandOwnership
          if (serverProfile.aadhaar_linked !== undefined) patch.aadhaarLinked = serverProfile.aadhaar_linked
          if (serverProfile.bank_account_linked !== undefined && serverProfile.bank_account_linked !== null)
            patch.bankAccountLinked = serverProfile.bank_account_linked
          if (serverProfile.income_band) {
            const bandMap: Record<string, ExtendedIncomeBand> = {
              below_1L: 'below_1L',
              '1L_2L': '1L_3L',
              above_2L: 'above_10L',
            }
            patch.incomeBand = bandMap[serverProfile.income_band] ?? ''
          }
          if ((serverProfile as any).primary_crop) patch.primaryCrop = (serverProfile as any).primary_crop
          if ((serverProfile as any).secondary_crop) patch.secondaryCrop = (serverProfile as any).secondary_crop
          if ((serverProfile as any).season) patch.season = (serverProfile as any).season as Season
          if ((serverProfile as any).irrigation_type) patch.irrigationType = (serverProfile as any).irrigation_type as IrrigationType
          if ((serverProfile as any).soil_type) patch.soilType = (serverProfile as any).soil_type as SoilType
          if ((serverProfile as any).soil_health_card_url) patch.soilHealthCardUploaded = true

          const merged = { ...s.profile, ...patch, lastUpdated: new Date().toISOString(), serverSyncedAt: new Date().toISOString() }
          const migrated = migrateProfileCrops(merged)
          const updated = syncCropCompat(migrated)
          return recompute(updated)
        })
      },

      getMissingRequired: () => {
        const { profile } = get()
        const missing: (keyof LocalProfile)[] = []
        if (!profile.name) missing.push('name')
        if (!profile.district) missing.push('district')
        if (!profile.primaryCrop) missing.push('primaryCrop')
        if (!profile.landSizeAcres) missing.push('landSizeAcres')
        if (profile.aadhaarLinked === null) missing.push('aadhaarLinked')
        if (!profile.incomeBand) missing.push('incomeBand')
        return missing
      },

      getMissingForPillar: (pillar) => {
        const { profile } = get()
        const required = PILLAR_REQUIREMENTS[pillar] as readonly (keyof LocalProfile)[]
        return required.filter((key) => {
          const val = profile[key]
          return val === null || val === '' || val === undefined
        }) as string[]
      },

      hasBasicInfo: () => {
        const { profile } = get()
        return !!(profile.district && profile.primaryCrop && profile.landSizeAcres)
      },
    }),
    {
      name: 'uzhavar-profile',
      merge: (persistedState: unknown, currentState: ProfileStore) => {
        const persisted = persistedState as { profile?: Partial<LocalProfile>; completionPct?: number } | null
        if (persisted?.profile) {
          const raw = { ...EMPTY_PROFILE, ...persisted.profile } as LocalProfile
          const migrated = migrateProfileCrops(raw)
          const synced = syncCropCompat(migrated)
          return {
            ...currentState,
            ...persisted,
            profile: synced,
            completionPct: computeCompletion(synced),
          }
        }
        return { ...currentState, ...(persisted || {}) }
      },
    },
  ),
)
