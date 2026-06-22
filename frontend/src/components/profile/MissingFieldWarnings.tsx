import { Link } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'

interface Props {
  lang: 'ta' | 'en'
}

// Maps each missing field to a human-readable warning
const WARNINGS_TA: Record<string, string> = {
  name: '📛 பெயர் தேவை — சில திட்டங்கள் பெயர் கேட்கின்றன.',
  aadhaarLinked: '🪪 ஆதார் இணைப்பு தகவல் தேவை — PM-KISAN தகுதிக்கு அவசியம்.',
  bankAccountLinked: '🏦 வங்கி கணக்கு தகவல் தேவை — நேரடி பலன் பரிமாற்றத்திற்கு (DBT).',
  incomeBand: '💰 வருமான தகவல் தேவை — PMKMY போன்ற திட்டங்களுக்கு.',
  landSizeAcres: '📐 நில அளவு தேவை — PM-KISAN, PMFBY தகுதிக்கு.',
  landOwnership: '📄 நில உரிமை தகவல் தேவை — குத்தகை விவசாயி திட்டங்களுக்கு.',
  primaryCrop: '🌾 பயிர் தகவல் தேவை — பயிர் காப்பீடு, நலன் திட்டங்களுக்கு.',
  age: '🎂 வயது தேவை — PM-KMY திட்டத்தில் 18–40 வயது தகுதி.',
  district: '📍 மாவட்டம் தேவை — மாநில திட்டங்கள் மாவட்டத்தை பயன்படுத்துகின்றன.',
}

const WARNINGS_EN: Record<string, string> = {
  name: '📛 Name required — some schemes need your name.',
  aadhaarLinked: '🪪 Aadhaar linkage info required — mandatory for PM-KISAN.',
  bankAccountLinked: '🏦 Bank account info required — for Direct Benefit Transfer (DBT).',
  incomeBand: '💰 Income information required — for schemes like PMKMY.',
  landSizeAcres: '📐 Land size required — for PM-KISAN, PMFBY eligibility.',
  landOwnership: '📄 Land ownership required — for tenant farmer schemes.',
  primaryCrop: '🌾 Crop information required — for crop insurance and benefits.',
  age: '🎂 Age required — PM-KMY eligibility is for ages 18–40.',
  district: '📍 District required — used for state-level scheme matching.',
}

export function MissingFieldWarnings({ lang }: Props) {
  const { getMissingRequired } = useProfileStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const missingRequired = getMissingRequired()

  if (missingRequired.length === 0) return null

  const warnings = lang === 'ta' ? WARNINGS_TA : WARNINGS_EN

  return (
    <div className="space-y-2">
      {missingRequired.map((field) => warnings[field] && (
        <div key={field} className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
          <span className="text-orange-500 shrink-0 mt-0.5">⚠️</span>
          <p className="text-orange-800 text-xs flex-1">{warnings[field]}</p>
        </div>
      ))}

      {missingRequired.length > 0 && (
        <Link
          to="/profile/onboarding"
          className="block text-center text-xs text-primary-700 font-semibold py-2 border border-primary-200 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          {t('சுயவிவரம் முழுமைப்படுத்த →', 'Complete profile to unlock more schemes →')}
        </Link>
      )}
    </div>
  )
}
