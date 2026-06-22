import { useState } from 'react'
import type { PrescriptionResponse } from '@/types/soil'

interface Props {
  data: PrescriptionResponse
  lang: 'ta' | 'en'
  irrigationType: string
  hasSoilHealthCard: boolean
}

const LABELS = {
  ta: {
    title: 'பரிந்துரை அடிப்படை',
    subtitle: 'உங்கள் தகவல் எவ்வாறு பயன்படுத்தப்பட்டது',
    data_used: 'உங்கள் தரவு பயன்படுத்தப்பட்டது',
    source: 'ஆதாரம்',
    confidence: 'தரவு துல்லியம்',
    shc_yes: 'மண் ஆரோக்கிய அட்டை ✓',
    shc_no: 'மண் ஆரோக்கிய அட்டை இல்லை',
    shc_note: 'மண் ஆரோக்கிய அட்டை சேர்த்தால் பரிந்துரை இன்னும் துல்லியமாக இருக்கும்.',
    symptom_note: 'நீங்கள் குறிப்பிட்ட அறிகுறிகளின் அடிப்படையில் NPK சரிசெய்யப்பட்டது.',
    confidence_level: {
      district_default: 'மாவட்ட இயல்புநிலை — மண் ஆரோக்கிய அட்டை இல்லாமல்',
      symptom_adjusted: 'அறிகுறி அடிப்படையில் சரிசெய்யப்பட்டது',
      soil_health_card: 'மண் ஆரோக்கிய அட்டை தரவு பயன்படுத்தப்பட்டது',
    },
    fields: {
      crop: 'பயிர்',
      district: 'மாவட்டம்',
      season: 'பருவம்',
      irrigation: 'நீர்பாசனம்',
      land: 'நில அளவு',
      zone: 'TNAU மண்டலம்',
      acres: 'ஏக்கர்',
    },
    trust_title: 'இந்த பரிந்துரையை ஏன் நம்பலாம்?',
    trust_points: [
      'TNAU பயிர் உற்பத்தி வழிகாட்டி 2020 (அரசு வெளியீடு)',
      'மண்டலம் சார்ந்த NPK அட்டவணை — Thanjavur-க்கு சோதிக்கப்பட்டது',
      'நிலவியல் வானிலை கணிப்பு (Open-Meteo)',
    ],
    show_more: 'கூடுதல் விவரங்கள் ▼',
    show_less: 'மறை ▲',
  },
  en: {
    title: 'Recommendation Basis',
    subtitle: 'How your data was used',
    data_used: 'Your Data Used',
    source: 'Source',
    confidence: 'Data Quality',
    shc_yes: 'Soil Health Card ✓',
    shc_no: 'No Soil Health Card',
    shc_note: 'Upload your Soil Health Card for a more precise recommendation.',
    symptom_note: 'NPK adjusted based on symptoms you reported.',
    confidence_level: {
      district_default: 'District default — no Soil Health Card',
      symptom_adjusted: 'Adjusted based on symptoms reported',
      soil_health_card: 'Personalised using Soil Health Card data',
    },
    fields: {
      crop: 'Crop',
      district: 'District',
      season: 'Season',
      irrigation: 'Irrigation',
      land: 'Land Size',
      zone: 'TNAU Zone',
      acres: 'acres',
    },
    trust_title: 'Why trust this recommendation?',
    trust_points: [
      'TNAU Crop Production Guide 2020 (government publication)',
      'Zone-specific NPK table — validated for your agro-climatic region',
      'Live weather forecast via Open-Meteo (FAO-56 ET₀)',
    ],
    show_more: 'Show details ▼',
    show_less: 'Hide ▲',
  },
}

const IRRIGATION_LABEL: Record<string, Record<'ta' | 'en', string>> = {
  borewell: { ta: 'ஆழ்துளை', en: 'Borewell' },
  canal:    { ta: 'கால்வாய்', en: 'Canal' },
  tank:     { ta: 'குளம்', en: 'Tank' },
  rainfed:  { ta: 'மழை நீர்', en: 'Rain-fed' },
  drip:     { ta: 'சொட்டு நீர்', en: 'Drip' },
  irrigated:{ ta: 'நீர்பாசன', en: 'Irrigated' },
}

const SEASON_LABEL: Record<string, Record<'ta' | 'en', string>> = {
  wet_season: { ta: 'ஆடி / குறுவை', en: 'Wet Season' },
  dry_season: { ta: 'சம்பா / கார்', en: 'Dry Season' },
  summer:     { ta: 'கோடை', en: 'Summer' },
}

export function RecommendationBasisCard({ data, lang, irrigationType, hasSoilHealthCard }: Props) {
  const [showMore, setShowMore] = useState(false)
  const t = LABELS[lang]
  const conf = data.recommendation.confidence_level

  const CONF_STYLE: Record<string, { bg: string; color: string }> = {
    soil_health_card: { bg: '#DCFCE7', color: '#166534' },
    symptom_adjusted: { bg: '#FEF3C7', color: '#92400E' },
    district_default: { bg: '#F3F4F6', color: '#374151' },
  }
  const confStyle = CONF_STYLE[conf] ?? { bg: '#F3F4F6', color: '#374151' }

  return (
    <div className="rounded-2xl overflow-hidden shadow-md">
      <div className="px-4 py-3" style={{ background: '#374151' }}>
        <p className="text-xs font-bold tracking-widest text-gray-300 uppercase">{t.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{t.subtitle}</p>
      </div>

      <div className="bg-white p-4 space-y-4">
        {/* Profile data chips */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{t.data_used}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t.fields.crop,      val: data.crop,                                             icon: '🌾' },
              { label: t.fields.district,  val: data.district,                                         icon: '📍' },
              { label: t.fields.season,    val: SEASON_LABEL[data.season]?.[lang] ?? data.season,      icon: '🗓' },
              { label: t.fields.irrigation,val: IRRIGATION_LABEL[irrigationType]?.[lang] ?? irrigationType, icon: '💧' },
              { label: t.fields.land,      val: `${data.land_acres} ${t.fields.acres}`,                icon: '📐' },
              { label: t.fields.zone,      val: data.zone_name_ta || data.zone_name,                   icon: '🏔' },
            ].map(({ label, val, icon }) => (
              <div key={label} className="rounded-lg px-3 py-2" style={{ background: '#F8F9FA' }}>
                <p className="text-xs text-gray-500">{icon} {label}</p>
                <p className="text-xs font-bold text-gray-800 mt-0.5 truncate">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Source + confidence row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-800">
            TNAU CPG 2020
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: confStyle.bg, color: confStyle.color }}
          >
            {t.confidence_level[conf]}
          </span>
        </div>

        {/* SHC status */}
        <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${hasSoilHealthCard ? 'bg-green-50' : 'bg-amber-50'}`}>
          <span>{hasSoilHealthCard ? '✅' : '⚠️'}</span>
          <div>
            <p className={`font-semibold ${hasSoilHealthCard ? 'text-green-800' : 'text-amber-800'}`}>
              {hasSoilHealthCard ? t.shc_yes : t.shc_no}
            </p>
            {!hasSoilHealthCard && <p className="text-amber-700 mt-0.5">{t.shc_note}</p>}
            {conf === 'symptom_adjusted' && <p className="text-amber-700 mt-0.5">{t.symptom_note}</p>}
          </div>
        </div>

        {/* Trust points — expandable */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="w-full text-xs text-gray-400 flex items-center justify-center gap-1"
        >
          {showMore ? t.show_less : t.show_more}
        </button>

        {showMore && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-bold text-gray-600">{t.trust_title}</p>
            {t.trust_points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{pt}</span>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">
              Ref: {data.recommendation.source_ref}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
