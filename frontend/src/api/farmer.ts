import { api } from './client'
import type { FarmerProfile, FarmerUpdate } from '@/types/api'
import type { LocalProfile } from '@/types/profile'
import { toBackendIncomeBand } from '@/types/profile'

export const farmerApi = {
  getProfile: () => api.get<FarmerProfile>('/farmer/me'),
  updateProfile: (body: FarmerUpdate) => api.put<FarmerProfile>('/farmer/me', body),
}

/** Push local Zustand profile fields to the backend so the eligibility engine has accurate data. */
export async function syncProfileToBackend(local: LocalProfile): Promise<void> {
  const update: FarmerUpdate = {}

  if (local.landSizeAcres) {
    const n = parseFloat(local.landSizeAcres)
    if (!isNaN(n)) update.land_size_acres = n
  }
  if (local.aadhaarLinked !== null) update.aadhaar_linked = local.aadhaarLinked
  if (local.bankAccountLinked !== null) update.bank_account_linked = local.bankAccountLinked
  if (local.incomeBand) {
    const mapped = toBackendIncomeBand(local.incomeBand)
    if (mapped) update.income_band = mapped
  }
  if (local.landOwnership) update.land_ownership = local.landOwnership as FarmerUpdate['land_ownership']
  if (local.age) {
    const n = parseInt(local.age, 10)
    if (!isNaN(n)) update.age = n
  }
  if (local.district) update.district = local.district
  if (local.village) update.village = local.village

  const landAcres = parseFloat(local.landSizeAcres || '0')
  if (local.primaryCrop && landAcres > 0) {
    const crops: FarmerUpdate['crops'] = [{ crop: local.primaryCrop, acres: landAcres }]
    if (local.secondaryCrop) crops.push({ crop: local.secondaryCrop, acres: 1 })
    update.crops = crops
  }

  if (Object.keys(update).length) {
    await farmerApi.updateProfile(update)
  }
}
