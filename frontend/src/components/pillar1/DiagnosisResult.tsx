import { useState } from 'react'
import type { DiagnoseResponse, SimilarDisease } from '@/types/diagnose'
import { cn } from '@/lib/utils'

type Lang = 'ta' | 'en'

const L = {
  ta: {
    // ── similar_diseases state ──────────────────────────────────────────────
    similar_title:    'நோயை உறுதியாக கண்டறிய முடியவில்லை',
    similar_sub:      'நம்பகமான நோய் கண்டறிவுக்கு படத்தில் போதுமான தகவல் இல்லை.',
    possible_matches: 'சாத்தியமான நோய்கள்',
    next_action:      'அடுத்து என்ன செய்வது',
    next_action_text: 'பாதிக்கப்பட்ட ஒரு இலையை மட்டும் நெருக்கமாக படம் எடுக்கவும்.',
    tips: [
      'பகல் வெளிச்சத்தில் எடுக்கவும்',
      'பாதிக்கப்பட்ட ஒரு இலை மட்டும் படம் எடுக்கவும்',
      'இலையை படத்தில் முழுமையாக நிரப்பவும்',
      'மங்கலான படம் வேண்டாம்',
      'முழு செடியை காட்ட வேண்டாம்',
    ],
    retake_similar:   '📷 நெருக்கமான படம் எடுக்கவும்',
    // ── image_quality state ─────────────────────────────────────────────────
    unclear:          'படத்தை சரியாக எடுக்கவில்லை',
    retake_quality:   '📷 மீண்டும் எடுக்கவும்',
    // ── confident result ────────────────────────────────────────────────────
    high_conf:        'AI கண்டறிந்தது',
    medium_conf:      'சாத்தியமான நோய்',
    medium_confirm:   'உறுதிப்படுத்த இன்னொரு நெருக்கமான படம் எடுக்கவும்.',
    source_ml:        'AI படம் பகுப்பாய்வு',
    source_symptom:   'அறிகுறி பொருத்தம் மூலம் கண்டறிந்தது',
    crop_label:       'பயிர்:',
    modern:           'நவீன சிகிச்சை',
    traditional:      'இயற்கை வழி',
    chemical:         'மருந்து',
    dosage:           'அளவு',
    cost:             'ஏக்கருக்கு செலவு',
    supply:           'கிடைக்கும் விவரம்',
    remedy_name:      'தீர்வு',
    method:           'முறை',
    heatmap_why:      'AI இந்த பகுதியை ஏன் கவனித்தது?',
    scan_another:     '← புதிய படம்',
    share:            'பகிர்',
    copied:           'நகலெடுக்கப்பட்டது ✓',
    healthy:          'ஆரோக்கியமான பயிர்',
    healthy_sub:      'குறிப்பிடத்தக்க நோய் எதுவும் கண்டறியவில்லை.',
    mismatch_note:    'குறிப்பு: AI வேறு பயிர் வடிவை கண்டறிந்தது. முடிவு சரியாக இல்லாமல் போகலாம்.',
  },
  en: {
    // ── similar_diseases state ──────────────────────────────────────────────
    similar_title:    'Unable to confidently identify the disease',
    similar_sub:      'The image does not contain enough information for a reliable diagnosis.',
    possible_matches: 'Possible matches',
    next_action:      'What to do next',
    next_action_text: 'Capture one close photo of a single affected leaf.',
    tips: [
      'Use daylight',
      'Capture only one affected leaf',
      'Fill most of the image with the leaf',
      'Avoid blurry images',
      'Avoid showing the entire plant',
    ],
    retake_similar:   '📷 Take a closer photo',
    // ── image_quality state ─────────────────────────────────────────────────
    unclear:          'Poor image quality',
    retake_quality:   '📷 Retake Photo',
    // ── confident result ────────────────────────────────────────────────────
    high_conf:        'Identified',
    medium_conf:      'Possible match',
    medium_confirm:   'Take one more close photo of the leaf to confirm this diagnosis.',
    source_ml:        'Identified from photo analysis',
    source_symptom:   'Identified from symptoms you selected',
    crop_label:       'Crop:',
    modern:           'Modern Treatment',
    traditional:      'Traditional Remedy',
    chemical:         'Chemical',
    dosage:           'Dosage',
    cost:             'Cost per acre',
    supply:           'Availability',
    remedy_name:      'Remedy',
    method:           'Method',
    heatmap_why:      'Why did the app flag this area?',
    scan_another:     '← Scan another',
    share:            'Share',
    copied:           'Copied ✓',
    healthy:          'Healthy Crop',
    healthy_sub:      'No significant disease detected.',
    mismatch_note:    'Note: our model detected a different crop pattern. Result may not be accurate.',
  },
} as const

interface Props {
  lang: Lang
  response: DiagnoseResponse
  preview: string
  cropName: string
  hasMismatch?: boolean   // high-confidence result but wrong crop — show caution note
  onReset: () => void
}

export function DiagnosisResult({ lang, response, preview, cropName, hasMismatch = false, onReset }: Props) {
  const t = L[lang]
  const [treatmentTab, setTreatmentTab] = useState<'modern' | 'traditional'>('modern')
  const [copyMsg, setCopyMsg] = useState(false)

  const {
    disease,
    confidence_level,
    source,
    heatmap_url,
    shap_label_ta,
    treatment,
    low_confidence_prompt_ta,
    low_confidence_prompt_en,
    rejection_reason,
    similar_diseases,
  } = response

  // ── CASE A1: Similar diseases ─────────────────────────────────────────────
  // Model sees something but cannot distinguish between close candidates.
  // Show possible disease names (no percentages) and photo guidance.
  if (confidence_level === 'low' && rejection_reason === 'similar_diseases') {
    const candidates: SimilarDisease[] = similar_diseases ?? []
    return (
      <div className="space-y-3">

        {/* Header */}
        <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-3">
            <p className="text-base font-bold text-gray-900 leading-snug">
              {t.similar_title}
            </p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {t.similar_sub}
            </p>
          </div>

          {/* Possible matches — names only, no % */}
          {candidates.length > 0 && (
            <div className="border-t border-amber-100 px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                {t.possible_matches}
              </p>
              <ul className="space-y-1.5 mb-3">
                {candidates.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-sm text-gray-800">
                      {lang === 'ta' ? d.name_ta : d.name_en}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Next action card */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#F0FDF4' }}>
            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">
              {t.next_action}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {t.next_action_text}
            </p>
            <ul className="space-y-2">
              {t.tips.map((tip, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="text-green-600 font-bold text-sm shrink-0">✓</span>
                  <span className="text-sm text-gray-700">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onReset}
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: '#1B4332' }}
        >
          {t.retake_similar}
        </button>
      </div>
    )
  }

  // ── CASE A2: Image quality — truly unclear / bad photo ───────────────────
  if (confidence_level === 'low') {
    const prompt = lang === 'ta' ? low_confidence_prompt_ta : low_confidence_prompt_en
    return (
      <div className="space-y-4">
        <div className="rounded-2xl overflow-hidden border border-orange-200 shadow-sm bg-white">
          <div className="px-4 py-4 flex items-start gap-3 bg-orange-50">
            <span className="text-3xl shrink-0">⚠️</span>
            <div>
              <p className="text-base font-bold text-orange-900">{t.unclear}</p>
              {prompt && <p className="text-sm text-orange-800 mt-1 leading-relaxed">{prompt}</p>}
            </div>
          </div>
        </div>
        <button
          onClick={onReset}
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: '#1B4332' }}
        >
          {t.retake_quality}
        </button>
      </div>
    )
  }

  // ── CASE B: Confident result (high or medium) ────────────────────────────
  const isHealthy  = !disease || disease.id?.includes('healthy') || disease.name_en?.toLowerCase().includes('healthy')
  const diseaseName = lang === 'ta' ? (disease?.name_ta || disease?.name_en) : disease?.name_en
  const isHigh     = confidence_level === 'high'

  async function handleShare() {
    const name = diseaseName ?? (lang === 'ta' ? 'நோய் கண்டறியப்பட்டது' : 'Disease detected')
    const chem = treatment?.modern?.chemical ?? ''
    const dose = treatment?.modern?.dosage ?? ''
    const text = `${name}\n${chem}${dose ? ` — ${dose}` : ''}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Crop Sentinel', text }) } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCopyMsg(true)
        setTimeout(() => setCopyMsg(false), 2000)
      } catch { /* ignore */ }
    }
  }

  // Derive detected crop from disease.id (e.g. "tomato_early_blight" → "tomato").
  // Gemini disease IDs are disease-only (e.g. "early_blight"), so skip parsing for Gemini.
  const TN_CROP_LABELS: Record<string, { ta: string; en: string }> = {
    rice:       { ta: 'நெல்',            en: 'Rice' },
    tomato:     { ta: 'தக்காளி',         en: 'Tomato' },
    banana:     { ta: 'வாழை',            en: 'Banana' },
    groundnut:  { ta: 'நிலக்கடலை',      en: 'Groundnut' },
    sugarcane:  { ta: 'கரும்பு',          en: 'Sugarcane' },
    maize:      { ta: 'மக்காசோளம்',      en: 'Maize' },
    cotton:     { ta: 'பருத்தி',          en: 'Cotton' },
    onion:      { ta: 'வெங்காயம்',       en: 'Onion' },
    apple:      { ta: 'ஆப்பிள்',          en: 'Apple' },
    grape:      { ta: 'திராட்சை',         en: 'Grape' },
    potato:     { ta: 'உருளைக்கிழங்கு', en: 'Potato' },
    corn:       { ta: 'மக்காச்சோளம்',    en: 'Maize' },
    pepper:     { ta: 'குடைமிளகாய்',     en: 'Bell Pepper' },
    strawberry: { ta: 'ஸ்ட்ராபெர்ரி',    en: 'Strawberry' },
    squash:     { ta: 'சுரைக்காய்',       en: 'Squash' },
    orange:     { ta: 'ஆரஞ்சு',           en: 'Orange' },
    peach:      { ta: 'பீச்',             en: 'Peach' },
    cherry:     { ta: 'செர்ரி',           en: 'Cherry' },
    soybean:    { ta: 'சோயாபீன்',         en: 'Soybean' },
    raspberry:  { ta: 'ராஸ்பெர்ரி',       en: 'Raspberry' },
    blueberry:  { ta: 'நீலக்கனி',         en: 'Blueberry' },
  }
  const detectedCropKey = (source === 'gemini_vision' || source === 'symptom_match')
    ? ''
    : (disease?.id?.split('_')[0] ?? '')
  const cropLabel =
    TN_CROP_LABELS[detectedCropKey]?.[lang] ||
    (detectedCropKey ? detectedCropKey.charAt(0).toUpperCase() + detectedCropKey.slice(1) : cropName)

  // Badge: label only, no %. Medium uses "Possible match" framing.
  const badgeBg    = isHigh ? '#D1FAE5' : '#FEF3C7'
  const badgeColor = isHigh ? '#065F46' : '#92400E'
  const badgeLabel = isHigh ? t.high_conf : t.medium_conf

  return (
    <div className="space-y-4">

      {/* ── Mismatch caution note (high-confidence but wrong crop) ─────────── */}
      {hasMismatch && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">⚠️</span>
          <p className="text-xs text-orange-800 leading-relaxed">{t.mismatch_note}</p>
        </div>
      )}

      {/* ── Disease header ────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
        <div className="flex gap-3 px-4 py-4">
          {preview ? (
            <img
              src={preview}
              alt="scanned leaf"
              className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-3xl">
              🌿
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <p className="text-base font-bold text-gray-900 leading-tight">
              {isHealthy ? t.healthy : diseaseName}
            </p>
            {isHealthy && (
              <p className="text-xs text-green-700">{t.healthy_sub}</p>
            )}
            {/* Badge — label only, confidence % kept internal */}
            {!isHealthy && (
              <span
                className="self-start text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: badgeBg, color: badgeColor }}
              >
                {badgeLabel}
              </span>
            )}
            <p className="text-xs text-gray-500">
              {source === 'symptom_match' ? t.source_symptom : t.source_ml}
            </p>
            <p className="text-xs text-gray-500">
              {t.crop_label}{' '}
              <span className="font-semibold text-gray-700">{cropLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Medium-confidence confirmation nudge ─────────────────────────── */}
      {!isHigh && !isHealthy && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">📷</span>
          <p className="text-xs text-amber-800 leading-relaxed">{t.medium_confirm}</p>
        </div>
      )}

      {/* ── Treatment tabs ────────────────────────────────────────────────── */}
      {!isHealthy && treatment && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100" style={{ background: '#F8F9FA' }}>
            {(['modern', 'traditional'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTreatmentTab(tab)}
                className={cn(
                  'flex-1 text-xs font-semibold py-3 border-b-2 transition-colors',
                  treatmentTab === tab
                    ? 'border-green-700 text-green-800'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                )}
              >
                {tab === 'modern' ? `💊 ${t.modern}` : `🌿 ${t.traditional}`}
              </button>
            ))}
          </div>

          {treatmentTab === 'modern' && treatment.modern && (
            <div className="bg-white px-4 py-4 space-y-3">
              {treatment.modern.chemical && (
                <TreatmentRow label={t.chemical} value={treatment.modern.chemical} />
              )}
              {treatment.modern.dosage && (
                <TreatmentRow label={t.dosage} value={treatment.modern.dosage} />
              )}
              {treatment.modern.cost_per_acre != null && (
                <TreatmentRow
                  label={t.cost}
                  value={`₹${treatment.modern.cost_per_acre}`}
                  highlight
                />
              )}
              {treatment.modern.supply_note && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                  <p className="text-xs text-blue-700 leading-relaxed italic">
                    {treatment.modern.supply_note}
                  </p>
                </div>
              )}
            </div>
          )}

          {treatmentTab === 'traditional' && treatment.indigenous && (
            <div className="bg-white px-4 py-4 space-y-3">
              {treatment.indigenous.name && (
                <TreatmentRow label={t.remedy_name} value={treatment.indigenous.name} />
              )}
              {(lang === 'ta' ? treatment.indigenous.preparation_ta : treatment.indigenous.method) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t.method}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {lang === 'ta' ? treatment.indigenous.preparation_ta : treatment.indigenous.method}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SHAP heatmap ─────────────────────────────────────────────────── */}
      {heatmap_url && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#F8F9FA' }}>
            <p className="text-xs font-semibold text-gray-600">{t.heatmap_why}</p>
          </div>
          <div className="bg-black">
            <img
              src={heatmap_url}
              alt="AI attention heatmap"
              className="w-full max-h-64 object-contain"
            />
          </div>
          {shap_label_ta && (
            <div className="bg-white px-4 py-2.5">
              <p className="text-xs text-gray-500 italic">{shap_label_ta}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Action row ───────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-xl border-2 border-green-700 text-green-800 text-sm font-bold hover:bg-green-50 transition-colors"
        >
          {t.scan_another}
        </button>
        {!isHealthy && (
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: '#1B4332' }}
          >
            {copyMsg ? t.copied : `📤 ${t.share}`}
          </button>
        )}
      </div>
    </div>
  )
}

function TreatmentRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 shrink-0 mt-0.5">{label}</span>
      <span
        className={cn(
          'text-sm text-right',
          highlight ? 'font-bold text-green-700' : 'font-medium text-gray-800',
        )}
      >
        {value}
      </span>
    </div>
  )
}
