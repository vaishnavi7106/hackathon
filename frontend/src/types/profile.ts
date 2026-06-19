export type LandOwnership = 'own' | 'tenant' | 'lease'
export type IrrigationType = 'rain_fed' | 'irrigated' | 'mixed'
export type ExtendedIncomeBand = 'below_1L' | '1L_3L' | '3L_5L' | '5L_10L' | 'above_10L'
export type SoilType = 'clay' | 'loamy' | 'sandy' | 'red' | 'black' | 'other'

export interface LocalProfile {
  // Personal
  name: string
  age: string
  phone: string
  language: 'ta' | 'en'

  // Location
  district: string
  taluk: string
  village: string

  // Farm
  primaryCrop: string
  secondaryCrop: string
  landSizeAcres: string
  landOwnership: LandOwnership | ''
  irrigationType: IrrigationType | ''

  // Eligibility
  aadhaarLinked: boolean | null
  bankAccountLinked: boolean | null
  incomeBand: ExtendedIncomeBand | ''

  // Future / Optional
  soilType: SoilType | ''
  waterSource: string
  livestockType: string

  // Metadata
  onboardingComplete: boolean
  lastUpdated: string | null
}

export const EMPTY_PROFILE: LocalProfile = {
  name: '',
  age: '',
  phone: '',
  language: 'ta',
  district: '',
  taluk: '',
  village: '',
  primaryCrop: '',
  secondaryCrop: '',
  landSizeAcres: '',
  landOwnership: '',
  irrigationType: '',
  aadhaarLinked: null,
  bankAccountLinked: null,
  incomeBand: '',
  soilType: '',
  waterSource: '',
  livestockType: '',
  onboardingComplete: false,
  lastUpdated: null,
}

// Weighted completion scoring (total = 100)
const COMPLETION_WEIGHTS: Array<{ key: keyof LocalProfile; weight: number }> = [
  { key: 'name', weight: 15 },
  { key: 'district', weight: 15 },
  { key: 'primaryCrop', weight: 10 },
  { key: 'landSizeAcres', weight: 10 },
  { key: 'aadhaarLinked', weight: 10 },
  { key: 'incomeBand', weight: 10 },
  { key: 'age', weight: 5 },
  { key: 'taluk', weight: 5 },
  { key: 'landOwnership', weight: 5 },
  { key: 'irrigationType', weight: 5 },
  { key: 'bankAccountLinked', weight: 5 },
  { key: 'village', weight: 2 },
  { key: 'secondaryCrop', weight: 2 },
  { key: 'soilType', weight: 1 },
  { key: 'waterSource', weight: 1 },
]

export function computeCompletion(profile: LocalProfile): number {
  let earned = 0
  for (const { key, weight } of COMPLETION_WEIGHTS) {
    const val = profile[key]
    if (val !== null && val !== '' && val !== undefined) earned += weight
  }
  return Math.round(earned)
}

// Map extended income band to the 3-band backend format
export function toBackendIncomeBand(band: ExtendedIncomeBand | ''): 'below_1L' | '1L_2L' | 'above_2L' | null {
  if (!band) return null
  if (band === 'below_1L') return 'below_1L'
  if (band === '1L_3L') return '1L_2L'
  return 'above_2L'
}
