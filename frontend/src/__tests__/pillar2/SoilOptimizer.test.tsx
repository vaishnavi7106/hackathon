import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SoilOptimizer from '@/pages/SoilOptimizer'
import { soilApi } from '@/api/soil'
import { useProfileStore } from '@/store/profileStore'
import { useSoilStore } from '@/store/soilStore'

vi.mock('@/api/soil', () => ({
  soilApi: {
    getPrescription: vi.fn(),
  },
}))

const COMPLETE_PROFILE = {
  name: 'Test Farmer',
  age: '40',
  phone: '9876543210',
  gender: '' as const,
  language: 'ta' as const,
  district: 'Thanjavur',
  taluk: '',
  village: '',
  primaryCrop: 'rice',
  secondaryCrop: '',
  landSizeAcres: '2.5',
  landOwnership: '' as const,
  irrigationType: 'borewell' as const,
  season: 'dry_season' as const,
  soilType: '' as const,
  aadhaarLinked: null,
  bankAccountLinked: null,
  incomeBand: '' as const,
  soilHealthCardUploaded: false,
  onboardingComplete: true,
  lastUpdated: null,
  serverSyncedAt: null,
}

const INCOMPLETE_PROFILE = {
  ...COMPLETE_PROFILE,
  primaryCrop: '',
  irrigationType: '' as const,
  season: '' as const,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SoilOptimizer />
    </MemoryRouter>,
  )
}

describe('SoilOptimizer — profile-driven', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfileStore.setState({ profile: COMPLETE_PROFILE, completionPct: 80 })
    useSoilStore.setState({ result: null, loading: false, error: null })
  })

  it('renders page title in Tamil', () => {
    renderPage()
    expect(screen.getByText('மண் & நீர் மேலாளர்')).toBeInTheDocument()
  })

  it('shows profile data in the summary card when complete', () => {
    renderPage()
    expect(screen.getByText('Thanjavur')).toBeInTheDocument()
    expect(screen.getByText('rice')).toBeInTheDocument()
    expect(screen.getByText('2.5 ஏக்கர்')).toBeInTheDocument()
  })

  it('shows "Complete Profile" CTA when required fields missing', () => {
    useProfileStore.setState({ profile: INCOMPLETE_PROFILE, completionPct: 30 })
    renderPage()
    expect(screen.getByText('சுயவிவரம் முழுமை இல்லை')).toBeInTheDocument()
    expect(screen.getByText('சுயவிவரம் நிரப்பு →')).toBeInTheDocument()
  })

  it('shows prescription input form when profile is complete', () => {
    renderPage()
    expect(screen.getByText('பயிர் வயது (நாட்கள்)')).toBeInTheDocument()
    expect(screen.getByText('பரிந்துரை பெறு 🌱')).toBeInTheDocument()
  })

  it('shows error when API call fails', async () => {
    vi.mocked(soilApi.getPrescription).mockRejectedValue(new Error('crop_not_found'))
    renderPage()

    const btn = screen.getByText('பரிந்துரை பெறு 🌱')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('crop_not_found')).toBeInTheDocument()
    })
  })
})
