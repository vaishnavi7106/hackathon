import { api } from './client'
import type { FarmerProfile, FarmerUpdate } from '@/types/api'
import type { LocalProfile } from '@/types/profile'
import { toBackendIncomeBand } from '@/types/profile'

export const farmerApi = {
  getProfile: () => api.get<FarmerProfile>('/farmer/me'),
  updateProfile: (body: FarmerUpdate) => api.put<FarmerProfile>('/farmer/me', body),
  uploadSoilHealthCard: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm<{ status: string; filename: string; soil_health_card_url: string }>(
      '/farmer/documents/soil-health-card',
      form,
    )
  },
}

/** Push local Zustand profile fields to the backend. */
export async function syncProfileToBackend(local: LocalProfile): Promise<FarmerProfile> {
  const update: FarmerUpdate & Record<string, unknown> = {}

  if (local.name) update.name = local.name
  if (local.district) update.district = local.district
  if (local.taluk) (update as any).taluk = local.taluk
  if (local.village) update.village = local.village
  if (local.gender) (update as any).gender = local.gender
  if (local.language) update.language = local.language as 'ta' | 'hi' | 'en'

  if (local.age) {
    const n = parseInt(local.age, 10)
    if (!isNaN(n) && n >= 1) update.age = n
  }
  if (local.landSizeAcres) {
    const n = parseFloat(local.landSizeAcres)
    if (!isNaN(n) && n > 0) update.land_size_acres = n
  }
  if (local.landOwnership) update.land_ownership = local.landOwnership
  if (local.aadhaarLinked !== null) update.aadhaar_linked = local.aadhaarLinked ?? undefined
  if (local.bankAccountLinked !== null) update.bank_account_linked = local.bankAccountLinked ?? undefined
  if (local.incomeBand) {
    const mapped = toBackendIncomeBand(local.incomeBand)
    if (mapped) update.income_band = mapped
  }

  // Profile v2 fields
  if (local.primaryCrop) (update as any).primary_crop = local.primaryCrop
  if (local.secondaryCrop) (update as any).secondary_crop = local.secondaryCrop
  if (local.season) (update as any).season = local.season
  if (local.irrigationType) (update as any).irrigation_type = local.irrigationType
  if (local.soilType) (update as any).soil_type = local.soilType

  // Also sync crops child table (for backward compat with existing navigator)
  const landAcres = parseFloat(local.landSizeAcres || '0')
  if (local.primaryCrop && landAcres > 0) {
    const crops: FarmerUpdate['crops'] = [{ crop: local.primaryCrop, acres: landAcres }]
    if (local.secondaryCrop) crops.push({ crop: local.secondaryCrop, acres: 1 })
    update.crops = crops
  }

  return farmerApi.updateProfile(update as FarmerUpdate)
}
