export type LandOwnership = 'own' | 'tenant' | 'lease'
export type IrrigationType = 'borewell' | 'canal' | 'tank' | 'rainfed' | 'drip'
export type ExtendedIncomeBand = 'below_1L' | '1L_3L' | '3L_5L' | '5L_10L' | 'above_10L'
export type SoilType = 'clay' | 'loamy' | 'sandy' | 'red' | 'black' | 'other'
export type Season = 'wet_season' | 'dry_season' | 'summer'
export type Gender = 'male' | 'female' | 'other'

export interface FarmerCrop {
  id: string               // uuid, generated on creation
  name: string             // "rice", "banana", etc.
  acres: number
  plantingDate: string     // ISO "YYYY-MM-DD"
  season: Season | ''
  irrigationType: IrrigationType | ''
}

export interface LocalProfile {
  // Personal
  name: string
  age: string
  phone: string
  gender: Gender | ''
  language: 'ta' | 'en'

  // Location
  district: string
  taluk: string
  village: string

  // Multi-crop (primary data model)
  crops: FarmerCrop[]

  // Legacy compat fields — kept so Pillars 1/3/4 keep working.
  // Always mirror crops[0] values; do not edit directly.
  primaryCrop: string
  secondaryCrop: string
  plantingDate: string
  landSizeAcres: string
  season: Season | ''
  irrigationType: IrrigationType | ''

  // Farm (non-crop)
  landOwnership: LandOwnership | ''
  soilType: SoilType | ''

  // Eligibility
  aadhaarLinked: boolean | null
  bankAccountLinked: boolean | null
  incomeBand: ExtendedIncomeBand | ''

  // Documents
  soilHealthCardUploaded: boolean

  // Metadata
  onboardingComplete: boolean
  lastUpdated: string | null
  serverSyncedAt: string | null
}

export const EMPTY_PROFILE: LocalProfile = {
  name: '',
  age: '',
  phone: '',
  gender: '',
  language: 'ta',
  district: '',
  taluk: '',
  village: '',
  crops: [],
  primaryCrop: '',
  secondaryCrop: '',
  plantingDate: '',
  landSizeAcres: '',
  season: '',
  irrigationType: '',
  landOwnership: '',
  soilType: '',
  aadhaarLinked: null,
  bankAccountLinked: null,
  incomeBand: '',
  soilHealthCardUploaded: false,
  onboardingComplete: false,
  lastUpdated: null,
  serverSyncedAt: null,
}

// Derive compat flat fields from the crops array
export function syncCropCompat(profile: LocalProfile): LocalProfile {
  const c0 = profile.crops[0]
  const c1 = profile.crops[1]
  const totalAcres = profile.crops.reduce((s, c) => s + (c.acres || 0), 0)
  return {
    ...profile,
    primaryCrop: c0?.name || '',
    secondaryCrop: c1?.name || '',
    plantingDate: c0?.plantingDate || '',
    landSizeAcres: totalAcres > 0 ? String(totalAcres) : profile.landSizeAcres,
    season: c0?.season || profile.season,
    irrigationType: c0?.irrigationType || profile.irrigationType,
  }
}

// Migrate old flat-field profile to crops array (idempotent)
export function migrateProfileCrops(profile: LocalProfile): LocalProfile {
  if (profile.crops && profile.crops.length > 0) return profile // already migrated
  if (!profile.primaryCrop) return profile                       // no data to migrate

  const totalAcres = parseFloat(profile.landSizeAcres) || 1
  const twoAcres = profile.secondaryCrop ? totalAcres / 2 : totalAcres

  const crops: FarmerCrop[] = []
  crops.push({
    id: crypto.randomUUID(),
    name: profile.primaryCrop,
    acres: twoAcres,
    plantingDate: profile.plantingDate || '',
    season: profile.season || '',
    irrigationType: profile.irrigationType || '',
  })
  if (profile.secondaryCrop) {
    crops.push({
      id: crypto.randomUUID(),
      name: profile.secondaryCrop,
      acres: twoAcres,
      plantingDate: new Date().toISOString().slice(0, 10),
      season: profile.season || '',
      irrigationType: profile.irrigationType || '',
    })
  }

  return syncCropCompat({ ...profile, crops })
}

// Weighted completion scoring
const COMPLETION_WEIGHTS: Array<{ key: keyof LocalProfile; weight: number }> = [
  { key: 'name', weight: 12 },
  { key: 'district', weight: 12 },
  { key: 'primaryCrop', weight: 10 },
  { key: 'landSizeAcres', weight: 8 },
  { key: 'aadhaarLinked', weight: 8 },
  { key: 'incomeBand', weight: 8 },
  { key: 'irrigationType', weight: 8 },
  { key: 'season', weight: 7 },
  { key: 'age', weight: 5 },
  { key: 'taluk', weight: 4 },
  { key: 'landOwnership', weight: 5 },
  { key: 'bankAccountLinked', weight: 5 },
  { key: 'village', weight: 3 },
  { key: 'secondaryCrop', weight: 2 },
  { key: 'soilType', weight: 2 },
  { key: 'soilHealthCardUploaded', weight: 1 },
]

export function computeCompletion(profile: LocalProfile): number {
  let earned = 0
  for (const { key, weight } of COMPLETION_WEIGHTS) {
    const val = profile[key]
    if (val !== null && val !== '' && val !== undefined && val !== false) earned += weight
  }
  return Math.min(100, Math.round(earned))
}

export function toBackendIncomeBand(band: ExtendedIncomeBand | ''): 'below_1L' | '1L_2L' | 'above_2L' | null {
  if (!band) return null
  if (band === 'below_1L') return 'below_1L'
  if (band === '1L_3L') return '1L_2L'
  return 'above_2L'
}

export const PILLAR_REQUIREMENTS = {
  pillar1: ['district', 'primaryCrop'] as const,
  pillar2: ['district', 'primaryCrop', 'landSizeAcres', 'irrigationType', 'season'] as const,
  pillar3: ['district', 'primaryCrop', 'season'] as const,
  pillar4: ['age', 'incomeBand', 'aadhaarLinked', 'bankAccountLinked', 'landSizeAcres', 'landOwnership'] as const,
  pillar5: ['district', 'primaryCrop', 'village'] as const,
}

export const PILLAR_LABELS: Record<keyof typeof PILLAR_REQUIREMENTS, { ta: string; en: string }> = {
  pillar1: { ta: 'பயிர் காவலன்', en: 'Crop Sentinel' },
  pillar2: { ta: 'மண் & நீர்', en: 'Soil Optimizer' },
  pillar3: { ta: 'சந்தை ஒரக்கிள்', en: 'Market Oracle' },
  pillar4: { ta: 'அரசு திட்டங்கள்', en: 'Govt Navigator' },
  pillar5: { ta: 'நோய் வலைப்பின்னல்', en: 'Outbreak Network' },
}
