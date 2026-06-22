import type { PrescriptionResponse } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
}

const LABELS = {
  ta: {
    title: 'AI விளக்கம்',
    subtitle: 'Groq AI விளக்கம்',
    disclaimer_label: 'அறிவிப்பு',
    confidence: {
      soil_health_card: 'மண் ஆரோக்கிய அட்டை',
      symptom_adjusted: 'அறிகுறி சரிசெய்யப்பட்டது',
      district_default: 'மாவட்ட இயல்புநிலை',
    },
  },
  en: {
    title: 'AI EXPLAINS / விளக்கம்',
    subtitle: 'Powered by Groq AI',
    disclaimer_label: 'Disclaimer',
    confidence: {
      soil_health_card: 'Soil Health Card',
      symptom_adjusted: 'Symptom Adjusted',
      district_default: 'District Default',
    },
  },
}

export function ExplanationCard({ data, lang }: Props) {
  const t = LABELS[lang]
  const conf = data.recommendation.confidence_level

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      {/* Header with gradient */}
      <div
        className="px-4 py-3"
        style={{
          background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #E8820C 100%)',
        }}
      >
        <p className="text-xs font-bold tracking-widest text-white uppercase">
          {t.title}
        </p>
        <p className="text-xs text-green-200 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4 space-y-3">
        {/* Confidence badge */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background:
                conf === 'soil_health_card'
                  ? '#DCFCE7'
                  : conf === 'symptom_adjusted'
                  ? '#FEF3C7'
                  : '#F3F4F6',
              color:
                conf === 'soil_health_card'
                  ? '#166534'
                  : conf === 'symptom_adjusted'
                  ? '#92400E'
                  : '#374151',
            }}
          >
            {t.confidence[conf]}
          </span>
        </div>

        {/* Explanation text */}
        <div
          className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: '#F8F4ED', color: '#1B2A1F' }}
        >
          {data.explanation}
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg px-3 py-2 text-xs border border-amber-200" style={{ background: '#FFFBEB' }}>
          <span className="font-semibold text-amber-700">{t.disclaimer_label}: </span>
          <span className="text-gray-600">{data.disclaimer}</span>
        </div>
      </div>
    </div>
  )
}
