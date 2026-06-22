import type { FarmerProfile } from '@/types/api'
import type { LocalProfile } from '@/types/profile'

/** Map backend 3-band to the closest 5-band local value. */
function toLocalIncomeBand(band: string | null): LocalProfile['incomeBand'] {
  if (!band) return ''
  if (band === 'below_1L') return 'below_1L'
  if (band === '1L_2L') return '1L_3L'
  return '3L_5L'
}

/**
 * Build a partial LocalProfile from a backend FarmerProfile so the local
 * store reflects what the server already knows about this account.
 * Called during login and after profile save.
 */
export function seedProfileFromBackend(p: FarmerProfile): Partial<LocalProfile> {
  const partial: Partial<LocalProfile> = {}

  if (p.name) partial.name = p.name
  if (p.phone) partial.phone = p.phone
  if (p.district) partial.district = p.district
  if (p.taluk) partial.taluk = p.taluk
  if (p.village) partial.village = p.village
  if (p.gender) partial.gender = p.gender as LocalProfile['gender']
  if (p.language) partial.language = p.language as 'ta' | 'en'
  if (p.land_size_acres != null) partial.landSizeAcres = String(p.land_size_acres)
  if (p.aadhaar_linked != null) partial.aadhaarLinked = p.aadhaar_linked
  if (p.bank_account_linked != null) partial.bankAccountLinked = p.bank_account_linked
  if (p.income_band) partial.incomeBand = toLocalIncomeBand(p.income_band)
  if (p.age != null) partial.age = String(p.age)
  if (p.land_ownership) partial.landOwnership = p.land_ownership as LocalProfile['landOwnership']

  // Profile v2 fields
  if (p.primary_crop) partial.primaryCrop = p.primary_crop
  if (p.secondary_crop) partial.secondaryCrop = p.secondary_crop
  if (p.season) partial.season = p.season as LocalProfile['season']
  if (p.irrigation_type) partial.irrigationType = p.irrigation_type as LocalProfile['irrigationType']
  if (p.soil_type) partial.soilType = p.soil_type as LocalProfile['soilType']
  if (p.soil_health_card_url) partial.soilHealthCardUploaded = true

  // Fallback: also read from crops[] child table for backward compat
  if (!partial.primaryCrop && p.crops?.[0]) partial.primaryCrop = p.crops[0].crop
  if (!partial.secondaryCrop && p.crops?.[1]) partial.secondaryCrop = p.crops[1].crop

  return partial
}
