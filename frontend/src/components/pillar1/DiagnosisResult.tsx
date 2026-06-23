import { useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Leaf, FlaskConical, Sprout, Share2, ArrowLeft, Info, MapPin, IndianRupee, Lightbulb, Stethoscope } from 'lucide-react'
import type { DiagnoseResponse, SimilarDisease } from '@/types/diagnose'

type Lang = 'ta' | 'en'

const L = {
  ta: {
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
    retake_similar:   'நெருக்கமான படம் எடுக்கவும்',
    unclear:          'படத்தை சரியாக எடுக்கவில்லை',
    retake_quality:   'மீண்டும் எடுக்கவும்',
    high_conf:        'AI கண்டறிந்தது',
    medium_conf:      'சாத்தியமான நோய்',
    medium_confirm:   'உறுதிப்படுத்த இன்னொரு நெருக்கமான படம் எடுக்கவும்.',
    source_ml:        'AI படம் பகுப்பாய்வு',
    source_symptom:   'அறிகுறி பொருத்தம் மூலம் கண்டறிந்தது',
    crop_label:       'பயிர்',
    modern:           'நவீன சிகிச்சை',
    traditional:      'இயற்கை வழி',
    chemical:         'மருந்து',
    dosage:           'அளவு',
    cost:             'ஏக்கருக்கு செலவு',
    supply:           'கிடைக்கும் விவரம்',
    remedy_name:      'தீர்வு',
    method:           'முறை',
    heatmap_why:      'AI இந்த பகுதியை ஏன் கவனித்தது?',
    scan_another:     'புதிய படம்',
    share:            'பகிர்',
    copied:           'நகலெடுக்கப்பட்டது',
    healthy:          'ஆரோக்கியமான பயிர்',
    healthy_sub:      'குறிப்பிடத்தக்க நோய் எதுவும் கண்டறியவில்லை.',
    mismatch_note:    'குறிப்பு: AI வேறு பயிர் வடிவை கண்டறிந்தது. முடிவு சரியாக இல்லாமல் போகலாம்.',
  },
  en: {
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
    retake_similar:   'Take a closer photo',
    unclear:          'Poor image quality',
    retake_quality:   'Retake Photo',
    high_conf:        'Identified',
    medium_conf:      'Possible match',
    medium_confirm:   'Take one more close photo of the leaf to confirm this diagnosis.',
    source_ml:        'Identified from photo analysis',
    source_symptom:   'Identified from symptoms you selected',
    crop_label:       'Crop',
    modern:           'Modern Treatment',
    traditional:      'Traditional Remedy',
    chemical:         'Chemical',
    dosage:           'Dosage',
    cost:             'Cost per acre',
    supply:           'Availability',
    remedy_name:      'Remedy',
    method:           'Method',
    heatmap_why:      'Why did the app flag this area?',
    scan_another:     'New Scan',
    share:            'Share',
    copied:           'Copied',
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
  hasMismatch?: boolean
  onReset: () => void
}

export function DiagnosisResult({ lang, response, preview, cropName, hasMismatch = false, onReset }: Props) {
  const t = L[lang]
  const [treatmentTab, setTreatmentTab] = useState<'modern' | 'traditional'>('modern')
  const [copyMsg, setCopyMsg] = useState(false)

  const { disease, confidence_level, source, heatmap_url, shap_label_ta, treatment,
    low_confidence_prompt_ta, low_confidence_prompt_en, rejection_reason, similar_diseases } = response

  // ── CASE A1: Similar diseases ─────────────────────────────────────────────
  if (confidence_level === 'low' && rejection_reason === 'similar_diseases') {
    const candidates: SimilarDisease[] = similar_diseases ?? []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #F59E0B' }}>
          <div style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} color="#D97706" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1E293B' }}>{t.similar_title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{t.similar_sub}</p>
            </div>
          </div>
          {candidates.length > 0 && (
            <div style={{ borderTop: '1px solid #FEF9C3', padding: '12px 16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.possible_matches}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidates.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: '#F59E0B', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{lang === 'ta' ? d.name_ta : d.name_en}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #0A5C47' }}>
          <div style={{ padding: '10px 14px', background: '#F0FDF4', borderBottom: '1px solid #DCFCE7', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb size={14} color="#0A5C47" />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0A5C47', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.next_action}</p>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{t.next_action_text}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {t.tips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={14} color="#0A5C47" />
                  <span style={{ fontSize: 13, color: '#374151' }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onReset}
          style={{ width: '100%', background: '#0A5C47', color: 'white', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Camera size={16} color="white" />
          {t.retake_similar}
        </button>
      </div>
    )
  }

  // ── CASE A2: Poor image quality ───────────────────────────────────────────
  if (confidence_level === 'low') {
    const prompt = lang === 'ta' ? low_confidence_prompt_ta : low_confidence_prompt_en
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#FFF5F5', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '3px solid #EF4444' }}>
          <div style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} color="#DC2626" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#991B1B' }}>{t.unclear}</p>
              {prompt && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#B91C1C', lineHeight: 1.5 }}>{prompt}</p>}
            </div>
          </div>
        </div>
        <button onClick={onReset}
          style={{ width: '100%', background: '#0A5C47', color: 'white', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Camera size={16} color="white" />
          {t.retake_quality}
        </button>
      </div>
    )
  }

  // ── CASE B: Confident result ──────────────────────────────────────────────
  const isHealthy   = !disease || disease.id?.includes('healthy') || disease.name_en?.toLowerCase().includes('healthy')
  const diseaseName = lang === 'ta' ? (disease?.name_ta || disease?.name_en) : disease?.name_en
  const isHigh      = confidence_level === 'high'

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
    ? cropName.toLowerCase()
    : (disease?.id?.split('_')[0] ?? '')
  const cropLabel =
    TN_CROP_LABELS[detectedCropKey]?.[lang] ||
    TN_CROP_LABELS[cropName.toLowerCase()]?.[lang] ||
    (detectedCropKey ? detectedCropKey.charAt(0).toUpperCase() + detectedCropKey.slice(1) : cropName)

  const confidenceBg    = isHigh ? '#DCFCE7' : '#FEF3C7'
  const confidenceColor = isHigh ? '#166534' : '#92400E'
  const borderColor     = isHigh ? '#0A5C47' : '#F59E0B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Mismatch caution */}
      {hasMismatch && (
        <div style={{ background: '#FFF7ED', borderRadius: 12, padding: '11px 14px', border: '1px solid #FED7AA', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#9A3412', lineHeight: 1.5 }}>{t.mismatch_note}</p>
        </div>
      )}

      {/* Disease header card */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${borderColor}` }}>
        <div style={{ display: 'flex', gap: 14, padding: '16px' }}>
          {preview ? (
            <img src={preview} alt="scanned leaf" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 12, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Leaf size={32} color="#0A5C47" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1E293B', lineHeight: 1.3 }}>
              {isHealthy ? t.healthy : diseaseName}
            </p>
            {isHealthy && <p style={{ margin: 0, fontSize: 12, color: '#16A34A' }}>{t.healthy_sub}</p>}
            {!isHealthy && (
              <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: confidenceBg, color: confidenceColor }}>
                {isHigh ? t.high_conf : t.medium_conf}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Stethoscope size={11} color="#94A3B8" />
              <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{source === 'symptom_match' ? t.source_symptom : t.source_ml}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sprout size={11} color="#94A3B8" />
              <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{t.crop_label}: <span style={{ fontWeight: 700, color: '#374151' }}>{cropLabel}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Medium-confidence nudge */}
      {!isHigh && !isHealthy && (
        <div style={{ background: '#FFFBF0', borderRadius: 12, padding: '11px 14px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Camera size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>{t.medium_confirm}</p>
        </div>
      )}

      {/* Treatment tabs */}
      {!isHealthy && treatment && (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', background: '#F8F9FA', borderBottom: '1px solid #E2E8F0' }}>
            {(['modern', 'traditional'] as const).map((tab) => (
              <button key={tab} onClick={() => setTreatmentTab(tab)}
                style={{
                  flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: treatmentTab === tab ? 'white' : 'transparent',
                  color: treatmentTab === tab ? '#0A5C47' : '#94A3B8',
                  borderBottom: treatmentTab === tab ? '2px solid #0A5C47' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}>
                {tab === 'modern'
                  ? <><FlaskConical size={13} color={treatmentTab === 'modern' ? '#0A5C47' : '#94A3B8'} />{t.modern}</>
                  : <><Sprout size={13} color={treatmentTab === 'traditional' ? '#0A5C47' : '#94A3B8'} />{t.traditional}</>}
              </button>
            ))}
          </div>

          {treatmentTab === 'modern' && treatment.modern && (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {treatment.modern.chemical && (
                <InfoRow icon={<FlaskConical size={13} color="#6D28D9" />} bg="#F5F3FF" label={t.chemical} value={treatment.modern.chemical} valueColor="#1E293B" />
              )}
              {treatment.modern.dosage && (
                <InfoRow icon={<Info size={13} color="#1D4ED8" />} bg="#EFF6FF" label={t.dosage} value={treatment.modern.dosage} valueColor="#1E293B" />
              )}
              {treatment.modern.cost_per_acre != null && (
                <InfoRow icon={<IndianRupee size={13} color="#0A5C47" />} bg="#F0FDF4" label={t.cost} value={`₹${treatment.modern.cost_per_acre}`} valueColor="#0A5C47" bold />
              )}
              {treatment.modern.supply_note && (
                <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <MapPin size={13} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 12, color: '#1E40AF', fontStyle: 'italic', lineHeight: 1.5 }}>{treatment.modern.supply_note}</p>
                </div>
              )}
            </div>
          )}

          {treatmentTab === 'traditional' && treatment.indigenous && (
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {treatment.indigenous.name && (
                <InfoRow icon={<Sprout size={13} color="#0A5C47" />} bg="#F0FDF4" label={t.remedy_name} value={treatment.indigenous.name} valueColor="#1E293B" />
              )}
              {(lang === 'ta' ? treatment.indigenous.preparation_ta : treatment.indigenous.method) && (
                <div style={{ background: '#F8FAF8', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.method}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {lang === 'ta' ? treatment.indigenous.preparation_ta : treatment.indigenous.method}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHAP heatmap */}
      {heatmap_url && (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '10px 14px', background: '#F8F9FA', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={13} color="#64748B" />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#64748B' }}>{t.heatmap_why}</p>
          </div>
          <div style={{ background: 'black' }}>
            <img src={heatmap_url} alt="AI attention heatmap" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }} />
          </div>
          {shap_label_ta && (
            <div style={{ padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>{shap_label_ta}</p>
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onReset}
          style={{ flex: 1, background: 'white', color: '#0A5C47', border: '1.5px solid #A7F3D0', borderRadius: 14, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <ArrowLeft size={15} color="#0A5C47" />
          {t.scan_another}
        </button>
        {!isHealthy && (
          <button onClick={handleShare}
            style={{ flex: 1, background: '#0A5C47', color: 'white', border: 'none', borderRadius: 14, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Share2 size={15} color="white" />
            {copyMsg ? t.copied : t.share}
          </button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, bg, label, value, valueColor, bold }: {
  icon: React.ReactNode; bg: string; label: string; value: string; valueColor: string; bold?: boolean
}) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: valueColor, textAlign: 'right' as const, lineHeight: 1.4 }}>{value}</span>
    </div>
  )
}
