import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FertilizerCard } from '@/components/pillar2/FertilizerCard'
import type { PrescriptionResponse } from '@/types/soil'

const mockData: PrescriptionResponse = {
  prescription_id: 'P-001',
  district: 'Thanjavur',
  crop: 'rice',
  season: 'dry_season',
  land_acres: 2.5,
  zone_id: 1,
  zone_name: 'Cauvery Delta Zone',
  zone_name_ta: 'காவிரி டெல்டா மண்டலம்',
  recommendation: {
    rec_id: 'REC-001',
    n_kg_ha: 150,
    p_kg_ha: 50,
    k_kg_ha: 50,
    n_adjusted: 165,
    p_adjusted: 50,
    k_adjusted: 50,
    adjustments_applied: ['n_deficiency: +10%'],
    confidence_level: 'symptom_adjusted',
    source_ref: 'TNAU CPG 2020',
    source_url: 'https://tnau.ac.in',
  },
  products: {
    urea_bags: 4.2,
    dap_bags: 1.6,
    mop_bags: 0.8,
    urea_kg: 189,
    dap_kg: 72,
    mop_kg: 33.7,
    cost: {
      urea_inr: 1120,
      dap_inr: 2160,
      mop_inr: 1336,
      total_inr: 4616,
    },
    prices_used: {
      urea_per_bag: 266.5,
      dap_per_bag: 1350,
      mop_per_bag: 1670,
      source: 'Govt MRP Kharif 2025-26',
    },
  },
  split_schedule: [],
  irrigation: null,
  joint_calendar: [],
  explanation: 'Test explanation',
  disclaimer: 'Consult your AEO',
  generated_at: '2026-06-18T10:00:00',
}

describe('FertilizerCard', () => {
  it('renders Tamil title', () => {
    render(<FertilizerCard data={mockData} lang="ta" />)
    expect(screen.getByText('உர பரிந்துரை')).toBeInTheDocument()
  })

  it('shows adjusted NPK values when adjustments present', () => {
    render(<FertilizerCard data={mockData} lang="en" />)
    // adjusted N=165 should appear, not 150
    expect(screen.getByText('165')).toBeInTheDocument()
  })

  it('shows zone name in Tamil', () => {
    render(<FertilizerCard data={mockData} lang="ta" />)
    expect(screen.getByText(/காவிரி/)).toBeInTheDocument()
  })
})
