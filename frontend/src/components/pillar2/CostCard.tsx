import type { PrescriptionResponse } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
}

const LABELS = {
  ta: {
    title: 'செலவு மதிப்பீடு',
    subtitle: 'அரசு MRP கரீஃப் 2025–26',
    urea: 'யூரியா',
    dap: 'டிஏபி',
    mop: 'எம்ஓபி',
    total: 'மொத்தம்',
    per_bag: 'பை/₹',
    source: 'விலை ஆதாரம்',
  },
  en: {
    title: 'Input Cost Estimate',
    subtitle: 'Govt MRP Kharif 2025–26',
    urea: 'Urea',
    dap: 'DAP',
    mop: 'MOP',
    total: 'Total',
    per_bag: '₹/bag',
    source: 'Price source',
  },
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function CostCard({ data, lang }: Props) {
  const t = LABELS[lang]
  const cost = data.products.cost
  const prices = data.products.prices_used

  const rows = [
    { label: t.urea, inr: cost.urea_inr, per: prices.urea_per_bag },
    { label: t.dap, inr: cost.dap_inr, per: prices.dap_per_bag },
    { label: t.mop, inr: cost.mop_inr, per: prices.mop_per_bag },
  ]

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      <div className="px-4 py-3" style={{ background: '#2D6A4F' }}>
        <p className="text-xs font-bold tracking-widest text-green-300 uppercase">
          {t.title}
        </p>
        <p className="text-xs text-green-400 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4 space-y-3">
        {rows.map(({ label, inr, per }) => (
          <div key={label} className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
              <span className="ml-2 text-xs text-gray-400">₹{fmt(per)}/{t.per_bag.replace('₹/', '')}</span>
            </div>
            <span className="text-sm font-bold text-gray-800">₹{fmt(inr)}</span>
          </div>
        ))}

        <div
          className="flex items-center justify-between rounded-xl px-3 py-3 mt-2"
          style={{ background: '#F8F4ED' }}
        >
          <span className="text-sm font-bold" style={{ color: '#1B4332' }}>
            {t.total}
          </span>
          <span className="text-xl font-extrabold" style={{ color: '#1B4332' }}>
            ₹{fmt(cost.total_inr)}
          </span>
        </div>

        <p className="text-xs text-gray-400 text-center">{prices.source}</p>
      </div>
    </div>
  )
}
