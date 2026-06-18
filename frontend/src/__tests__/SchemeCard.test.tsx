import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SchemeCard } from '@/components/schemes/SchemeCard'
import type { EligibleSchemeOut } from '@/types/api'

const mockScheme: EligibleSchemeOut = {
  scheme_id: 'pm-kisan',
  name_ta: 'பிரதான் மந்திரி கிசான் சம்மன் நிதி',
  name_en: 'PM-KISAN',
  level: 'central',
  benefit_ta: 'ஆண்டுக்கு ₹6,000 வருமான உதவி',
  benefit_en: 'Rs 6000 annual income support',
  is_eligible: true,
  missing_criteria: [],
  match_score: 1.0,
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <SchemeCard scheme={mockScheme} {...props} />
    </MemoryRouter>,
  )
}

describe('SchemeCard', () => {
  it('renders Tamil scheme name', () => {
    renderCard()
    expect(screen.getByText('பிரதான் மந்திரி கிசான் சம்மன் நிதி')).toBeInTheDocument()
  })

  it('shows central badge', () => {
    renderCard()
    expect(screen.getByText('மத்திய')).toBeInTheDocument()
  })

  it('shows benefit text', () => {
    renderCard()
    expect(screen.getByText(/₹6,000/)).toBeInTheDocument()
  })

  it('calls onCheckEligibility when button clicked', () => {
    const onCheck = vi.fn()
    renderCard({ onCheckEligibility: onCheck })
    fireEvent.click(screen.getByText('தகுதி சரிபார்'))
    expect(onCheck).toHaveBeenCalledWith(mockScheme)
  })

  it('shows eligibility badge when showEligibility=true', () => {
    renderCard({ showEligibility: true })
    expect(screen.getByText('✓ தகுதியுள்ளவர்')).toBeInTheDocument()
  })

  it('links to detail page', () => {
    renderCard()
    const link = screen.getByText('விவரங்கள்').closest('a')
    expect(link?.getAttribute('href')).toBe('/schemes/pm-kisan')
  })
})
