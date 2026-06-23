import { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { diagnoseImage, submitRiceSymptoms, getDiagnoseHistory } from '@/api/diagnose'
import type { DiagnoseResponse, DiagnoseHistoryItem, SymptomOption } from '@/types/diagnose'
import { DiagnosisResult } from '@/components/pillar1/DiagnosisResult'
import { SymptomSelector } from '@/components/pillar1/SymptomSelector'
import { useProfileStore } from '@/store/profileStore'
import { SYMPTOM_MAP, matchSymptoms } from '@/data/symptomMap'

// ── Local scan record stored in localStorage ──────────────────────────────
interface LocalScan {
  diagnosis_id: string
  date: string
  image_thumbnail: string
  disease_name_en: string
  disease_name_ta: string
  confidence_level: string
  crop: string
}

const SCAN_KEY = 'cropScans'
const MAX_SCANS = 20

function loadScans(): LocalScan[] {
  try { return JSON.parse(localStorage.getItem(SCAN_KEY) ?? '[]') }
  catch { return [] }
}

function persistScan(scan: LocalScan) {
  const list = loadScans().filter(s => s.diagnosis_id !== scan.diagnosis_id)
  localStorage.setItem(SCAN_KEY, JSON.stringify([scan, ...list].slice(0, MAX_SCANS)))
}

// ── Image helpers ─────────────────────────────────────────────────────────
async function resizeImage(file: File, maxDim: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxDim / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => blob
          ? resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          : reject(new Error('canvas toBlob failed')),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = reject
    img.src = url
  })
}

async function makeThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 80
      const { width, height } = img
      const scale = Math.max(size / width, size / height)
      const sw = Math.round(width * scale)
      const sh = Math.round(height * scale)
      const dx = Math.round((size - sw) / 2)
      const dy = Math.round((size - sh) / 2)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, dx, dy, sw, sh)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = reject
    img.src = url
  })
}

// ── TN-priority crop list (6 crops, matches disease_mapping.py crop_ids) ─
const MODEL_CROPS = [
  { id: 'rice',      en: 'Rice',         ta: 'நெல்'          },
  { id: 'tomato',    en: 'Tomato',       ta: 'தக்காளி'       },
  { id: 'banana',    en: 'Banana',       ta: 'வாழை'          },
  { id: 'groundnut', en: 'Groundnut',    ta: 'நிலக்கடலை'    },
  { id: 'sugarcane', en: 'Sugarcane',    ta: 'கரும்பு'       },
  { id: 'maize',     en: 'Corn (Maize)', ta: 'மக்காச்சோளம்' },
] as const

type CropId = typeof MODEL_CROPS[number]['id']

// ── Phase state machine ───────────────────────────────────────────────────
type Phase =
  | { kind: 'home' }
  | { kind: 'scanning'; file: File; preview: string }
  | { kind: 'scan_error'; file: File; preview: string; message: string }
  | {
      kind: 'symptom_check'          // rice backend flow (unchanged)
      diagnosisId: string
      preview: string
      thumbnail: string
      symptoms: SymptomOption[]
      promptTa: string
      promptEn: string
      sympLoading: boolean
      sympError: string | null
    }
  | {
      kind: 'symptom_check_local'    // frontend-only symptom checker for all 6 crops
      cropId: CropId
      preview: string
    }
  | {
      kind: 'mismatch'               // model detected wrong crop (low confidence)
      preview: string
      selectedCropId: CropId
    }
  | {
      kind: 'result'
      response: DiagnoseResponse
      preview: string
      cropName: string
      hasMismatch: boolean           // high-confidence mismatch — show caution note
    }

// ── Labels ────────────────────────────────────────────────────────────────
const L = {
  ta: {
    title:              'பயிர் காவலன்',
    subtitle:           'நோயுற்ற இலையின் புகைப்படம் எடுத்து உடனடி கண்டறிதல் பெறுங்கள்',
    pick_crop:          'எந்த பயிரில் பிரச்சனை?',
    selected_prefix:    'தேர்ந்தெடுக்கப்பட்டது:',
    change:             'மாற்றவும்',
    take_photo:         'புகைப்படம் எடுக்கவும்',
    upload:             'படம் பதிவேற்றவும்',
    recent:             'சமீபத்திய ஸ்கேன்கள்',
    no_scans:           'இன்னும் ஸ்கேன் இல்லை.',
    see_all:            'அனைத்தையும் காண',
    analysing:          'உங்கள் பயிரை பகுப்பாய்வு செய்கிறது…',
    error_large:        'படம் மிகவும் பெரியது. 5MB-க்கும் குறைவான படம் பயன்படுத்தவும்.',
    error_type:         'JPEG அல்லது PNG படம் மட்டுமே பயன்படுத்தவும்.',
    error_network:      'படத்தை பகுப்பாய்வு செய்ய முடியவில்லை. உங்கள் இணைப்பை சரிபார்க்கவும்.',
    retry:              'மீண்டும் முயற்சிக்கவும்',
    retake_link:        '← புகைப்படம் மீண்டும் எடுக்கவும்',
    symp_error:         'மீண்டும் முயற்சிக்கவும்',
    // mismatch screen
    mismatch_try_photo: 'தெளிவான புகைப்படம் எடுக்கவும் →',
    mismatch_symptoms:  'அறிகுறிகளை விவரிக்கவும் →',
    // local symptom checker
    symp_heading:       'அறிகுறிகளை தேர்ந்தெடுக்கவும்',
    symp_prompt:        'உங்கள் பயிரில் தெரியும் அறிகுறிகளை தேர்வு செய்யுங்கள்.',
  },
  en: {
    title:              'Crop Sentinel',
    subtitle:           'Take a photo of a diseased leaf for instant diagnosis',
    pick_crop:          'Which crop has the problem?',
    selected_prefix:    'Selected:',
    change:             'Change',
    take_photo:         'Take Photo',
    upload:             'Upload Image',
    recent:             'Recent Scans',
    no_scans:           'No scans yet. Take your first photo above.',
    see_all:            'See all history',
    analysing:          'Analysing your crop…',
    error_large:        'Photo is too large. Please use a photo under 5MB.',
    error_type:         'Please upload a JPEG or PNG photo.',
    error_network:      'Could not analyse photo. Check your connection.',
    retry:              'Try again',
    retake_link:        '← Retake photo',
    symp_error:         'Something went wrong. Try again.',
    // mismatch screen
    mismatch_try_photo: 'Try a clearer photo →',
    mismatch_symptoms:  'Describe symptoms →',
    // local symptom checker
    symp_heading:       'Select Symptoms',
    symp_prompt:        'Select all symptoms you can see on your crop.',
  },
} as const

function confidenceLevelFromScore(score: number | null): 'high' | 'medium' | 'low' {
  if (score == null) return 'low'
  if (score >= 0.85) return 'high'
  if (score >= 0.70) return 'medium'
  return 'low'
}

// Returns the crop_id prefix from a disease_id (e.g. "tomato_early_blight" → "tomato")
function cropPrefixFromDiseaseId(diseaseId: string | null | undefined): string {
  return diseaseId?.split('_')[0] ?? ''
}

export default function CropSentinel() {
  const { profile } = useProfileStore()
  const lang = profile.language as 'ta' | 'en'
  const t = L[lang]

  // Pre-select the farmer's primary crop if it matches one of the 6.
  const profileCropId = profile.crops?.[0]?.name || profile.primaryCrop || ''
  const [selectedCrop, setSelectedCrop] = useState<CropId | ''>(() =>
    MODEL_CROPS.some(c => c.id === profileCropId) ? (profileCropId as CropId) : '',
  )

  const [phase, setPhase] = useState<Phase>({ kind: 'home' })
  const [scans, setScans] = useState<LocalScan[]>([])
  const [apiHistory, setApiHistory] = useState<DiagnoseHistoryItem[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)

  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const local = loadScans()
    setScans(local)
    if (local.length === 0) {
      getDiagnoseHistory()
        .then(setApiHistory)
        .catch(() => { /* non-fatal */ })
    }
  }, [])

  // ── File validation + upload flow ─────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setFileError(null)

    if (file.size > 5 * 1024 * 1024) { setFileError(t.error_large); return }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setFileError(t.error_type)
      return
    }

    const preview = URL.createObjectURL(file)
    setPhase({ kind: 'scanning', file, preview })

    try {
      const resized   = await resizeImage(file, 1200)
      const response  = await diagnoseImage(resized, selectedCrop || '')

      // ── Rice backend symptom check (existing path, unchanged) ──────────
      if (response.requires_symptom_check) {
        const thumbnail = await makeThumbnail(file)
        setPhase({
          kind: 'symptom_check',
          diagnosisId: response.diagnosis_id,
          preview,
          thumbnail,
          symptoms: response.symptoms_to_show ?? [],
          promptTa: response.prompt_ta ?? '',
          promptEn: response.prompt_en ?? '',
          sympLoading: false,
          sympError: null,
        })
        return
      }

      // ── Mismatch detection ─────────────────────────────────────────────
      const isGemini       = response.source === 'gemini_vision'
      const detectedCropId = cropPrefixFromDiseaseId(response.disease?.id)
      const isHealthy      = response.disease?.id?.includes('healthy') ?? false
      const confidence     = response.confidence ?? 0
      // Gemini disease IDs don't include crop prefix, so skip mismatch check for Gemini
      const hasMismatch    = !isGemini &&
                             !isHealthy &&
                             !!detectedCropId &&
                             !!selectedCrop &&
                             detectedCropId !== selectedCrop

      if (hasMismatch && confidence < 0.85) {
        // Low-confidence mismatch → show mismatch guidance screen
        setPhase({ kind: 'mismatch', preview, selectedCropId: selectedCrop as CropId })
        return
      }

      // ── Successful / high-confidence result ────────────────────────────
      if (response.disease && response.confidence_level !== 'low') {
        const thumbnail = await makeThumbnail(file)
        persistScan({
          diagnosis_id:     response.diagnosis_id,
          date:             new Date().toISOString(),
          image_thumbnail:  thumbnail,
          disease_name_en:  response.disease.name_en,
          disease_name_ta:  response.disease.name_ta,
          confidence_level: response.confidence_level ?? 'medium',
          crop:             selectedCrop || '',
        })
        setScans(loadScans())
      }

      setPhase({
        kind: 'result',
        response,
        preview,
        cropName:    selectedCrop || '',
        hasMismatch: hasMismatch && confidence >= 0.85,   // show note for high-conf mismatch
      })
    } catch {
      setPhase((prev) =>
        prev.kind === 'scanning'
          ? { kind: 'scan_error', file: prev.file, preview: prev.preview, message: t.error_network }
          : prev,
      )
    }
  }, [selectedCrop, t])

  // ── Rice backend symptom submit (unchanged) ────────────────────────────
  async function handleSymptomSubmit(selected: string[]) {
    if (phase.kind !== 'symptom_check') return
    setPhase({ ...phase, sympLoading: true, sympError: null })

    try {
      const response = await submitRiceSymptoms(phase.diagnosisId, selected)
      const { preview, thumbnail } = phase

      if (response.disease && response.confidence_level !== 'low') {
        persistScan({
          diagnosis_id:     response.diagnosis_id,
          date:             new Date().toISOString(),
          image_thumbnail:  thumbnail,
          disease_name_en:  response.disease.name_en,
          disease_name_ta:  response.disease.name_ta,
          confidence_level: response.confidence_level ?? 'medium',
          crop:             selectedCrop || '',
        })
        setScans(loadScans())
      }

      setPhase({ kind: 'result', response, preview, cropName: selectedCrop || '', hasMismatch: false })
    } catch {
      setPhase((prev) =>
        prev.kind === 'symptom_check'
          ? { ...prev, sympLoading: false, sympError: t.symp_error }
          : prev,
      )
    }
  }

  // ── Frontend-only local symptom submit ─────────────────────────────────
  function handleLocalSymptomSubmit(selected: string[]) {
    if (phase.kind !== 'symptom_check_local') return
    const { cropId, preview } = phase
    const best = matchSymptoms(cropId, selected)

    let response: DiagnoseResponse
    if (best) {
      response = {
        diagnosis_id:           'local_' + Date.now(),
        disease:                { id: best.disease_id, name_en: best.name_en, name_ta: best.name_ta },
        confidence:             null,
        confidence_level:       'medium',
        source:                 'symptom_match',
        heatmap_url:            null,
        shap_label_ta:          null,
        treatment:              null,
        low_confidence_prompt_ta: null,
        low_confidence_prompt_en: null,
        rejection_reason:       null,
        similar_diseases:       null,
        requires_symptom_check: null,
        prompt_en:              null,
        prompt_ta:              null,
        symptoms_to_show:       null,
        matched_symptoms:       selected,
        match_score:            null,
      }
    } else {
      // No matching disease — prompt to visit local office
      response = {
        diagnosis_id:           'local_no_match',
        disease:                null,
        confidence:             null,
        confidence_level:       'low',
        source:                 'symptom_match',
        heatmap_url:            null,
        shap_label_ta:          null,
        treatment:              null,
        low_confidence_prompt_ta: 'அறிகுறிகள் எந்த நோயுடனும் பொருந்தவில்லை. உங்கள் மாவட்ட வேளாண்மை அலுவலகத்தை தொடர்பு கொள்ளுங்கள்.',
        low_confidence_prompt_en: 'Symptoms do not clearly match a known disease. Please contact your local agricultural office.',
        rejection_reason:       'image_quality',
        similar_diseases:       null,
        requires_symptom_check: null,
        prompt_en:              null,
        prompt_ta:              null,
        symptoms_to_show:       null,
        matched_symptoms:       null,
        match_score:            null,
      }
    }

    setPhase({ kind: 'result', response, preview, cropName: cropId, hasMismatch: false })
  }

  // ── File input handlers ────────────────────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  function goHome() {
    if (phase.kind === 'result')       URL.revokeObjectURL(phase.preview)
    if (phase.kind === 'scanning' || phase.kind === 'scan_error') URL.revokeObjectURL(phase.preview)
    if (phase.kind === 'symptom_check')       URL.revokeObjectURL(phase.preview)
    if (phase.kind === 'symptom_check_local') URL.revokeObjectURL(phase.preview)
    if (phase.kind === 'mismatch')            URL.revokeObjectURL(phase.preview)
    setPhase({ kind: 'home' })
    setFileError(null)
  }

  // ── History display helpers ────────────────────────────────────────────
  const localHistory = scans
  const fallbackHistory: Array<{ id: string; nameTa: string | null; nameEn: string | null; level: string; date: string; thumb?: string }> =
    localHistory.length > 0
      ? localHistory.map(s => ({
          id: s.diagnosis_id,
          nameTa: s.disease_name_ta,
          nameEn: s.disease_name_en,
          level:  s.confidence_level,
          date:   s.date,
          thumb:  s.image_thumbnail,
        }))
      : apiHistory.map(h => ({
          id:     h.diagnosis_id,
          nameTa: h.disease_name_ta,
          nameEn: h.disease_name_en,
          level:  confidenceLevelFromScore(h.confidence),
          date:   h.created_at,
        }))

  const displayedHistory = showAllHistory ? fallbackHistory : fallbackHistory.slice(0, 5)

  const confBadgeStyle = (level: string) => {
    if (level === 'high')   return { bg: '#D1FAE5', color: '#065F46' }
    if (level === 'medium') return { bg: '#FEF3C7', color: '#92400E' }
    return { bg: '#FEE2E2', color: '#991B1B' }
  }

  const confLabel = (level: string) =>
    lang === 'ta'
      ? level === 'high' ? 'அதிகம்' : level === 'medium' ? 'நடுத்தரம்' : 'குறைவு'
      : level === 'high' ? 'High'   : level === 'medium' ? 'Medium'   : 'Low'

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: 'numeric', month: 'short',
      })
    } catch { return iso.slice(0, 10) }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Scanning / Error
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'scanning' || phase.kind === 'scan_error') {
    const isError = phase.kind === 'scan_error'
    return (
      <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <GradientHeader title={t.title} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '48px 24px' }}>
          <div style={{ position: 'relative' }}>
            <img src={phase.preview} alt="selected leaf"
              style={{ width: 200, height: 200, borderRadius: 20, objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '4px solid white' }} />
            {!isError && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '4px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
          </div>
          {isError ? (
            <div style={{ width: '100%', maxWidth: 280, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 500 }}>{phase.message}</p>
              <button onClick={() => handleFile(phase.file)}
                style={{ width: '100%', background: '#0A5C47', color: 'white', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t.retry}
              </button>
              <button onClick={goHome} style={{ fontSize: 13, color: '#0A5C47', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {t.retake_link}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>{t.analysing}</p>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // MISMATCH — model detected a different crop (low confidence)
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'mismatch') {
    const cropInfo  = MODEL_CROPS.find(c => c.id === phase.selectedCropId)
    const cropLabel = lang === 'ta' ? cropInfo?.ta : cropInfo?.en
    const localSymptoms: SymptomOption[] = SYMPTOM_MAP[phase.selectedCropId]?.symptoms ?? []

    return (
      <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <GradientHeader title={t.title} onBack={goHome} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔍</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B', lineHeight: 1.4 }}>
            {lang === 'ta'
              ? `இந்த படத்தில் ${cropLabel} நோயை தெளிவாக கண்டறிய முடியவில்லை.`
              : `We couldn't clearly identify a ${cropLabel} disease in this photo.`}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.6, maxWidth: 280 }}>
            {lang === 'ta'
              ? 'நெருக்கமான தெளிவான படம் எடுக்கவும், அல்லது அறிகுறிகளை விவரிக்கவும்.'
              : 'Try a closer, clearer photo — or describe what you see on the leaf.'}
          </p>
          <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <button onClick={goHome}
              style={{ width: '100%', background: '#0A5C47', color: 'white', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {t.mismatch_try_photo}
            </button>
            {localSymptoms.length > 0 && (
              <button
                onClick={() => setPhase({ kind: 'symptom_check_local', cropId: phase.selectedCropId, preview: phase.preview })}
                style={{ width: '100%', background: '#FFFBF0', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t.mismatch_symptoms}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 3a — Rice backend symptom checker
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'symptom_check') {
    return (
      <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <GradientHeader title={lang === 'ta' ? 'நோயை கண்டறிக' : 'Identify the Disease'} onBack={goHome} />
        <div style={{ padding: '16px 16px', paddingBottom: 112 }}>
          <SymptomSelector lang={lang} promptText={lang === 'ta' ? phase.promptTa : phase.promptEn}
            symptoms={phase.symptoms} loading={phase.sympLoading} onSubmit={handleSymptomSubmit} />
          {phase.sympError && (
            <p style={{ fontSize: 12, color: '#DC2626', textAlign: 'center', marginTop: 12 }}>{phase.sympError}</p>
          )}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={goHome} style={{ fontSize: 13, color: '#0A5C47', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t.retake_link}</button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 3b — Frontend-only symptom checker
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'symptom_check_local') {
    const cropInfo  = MODEL_CROPS.find(c => c.id === phase.cropId)
    const cropLabel = lang === 'ta' ? cropInfo?.ta : cropInfo?.en
    const localSymptoms: SymptomOption[] = SYMPTOM_MAP[phase.cropId]?.symptoms ?? []

    return (
      <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <GradientHeader title={lang === 'ta' ? 'நோயை கண்டறிக' : 'Identify the Disease'} subtitle={cropLabel} onBack={goHome} />
        <div style={{ padding: '16px 16px', paddingBottom: 112 }}>
          <SymptomSelector lang={lang} promptText={t.symp_prompt}
            symptoms={localSymptoms} loading={false} onSubmit={handleLocalSymptomSubmit} />
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={goHome} style={{ fontSize: 13, color: '#0A5C47', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{t.retake_link}</button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 4 — Result
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'result') {
    return (
      <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <GradientHeader title={lang === 'ta' ? 'கண்டறிதல் முடிவு' : 'Diagnosis Result'} onBack={goHome} />
        <div style={{ padding: '16px 16px', paddingBottom: 112 }}>
          <DiagnosisResult lang={lang} response={phase.response} preview={phase.preview}
            cropName={phase.cropName} hasMismatch={phase.hasMismatch} onReset={goHome} />
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Home
  // ══════════════════════════════════════════════════════════════════════
  const activeCropInfo = MODEL_CROPS.find(c => c.id === selectedCrop)

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '16px 16px 20px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>{t.title}</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{t.subtitle}</p>
      </header>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* File error */}
        {fileError && (
          <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '12px 14px', border: '1px solid #FECACA' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>{fileError}</p>
          </div>
        )}

        {/* ── STEP 1: Crop grid ──────────────────────────────────────────── */}
        {!selectedCrop && (
          <section>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t.pick_crop}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODEL_CROPS.map((crop) => (
                <button key={crop.id} onClick={() => setSelectedCrop(crop.id)}
                  style={{ background: 'white', borderRadius: 14, border: '1.5px solid #E2E8F0', padding: '14px 12px', textAlign: 'left', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{lang === 'ta' ? crop.ta : crop.en}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>{lang === 'ta' ? crop.en : crop.ta}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── STEP 2: Selected crop + photo buttons ──────────────────────── */}
        {selectedCrop && activeCropInfo && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Selected crop banner */}
            <div style={{ background: '#F0FDF4', borderRadius: 14, padding: '13px 16px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0A5C47', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.selected_prefix}</p>
                <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: '#0A5C47' }}>
                  {lang === 'ta' ? activeCropInfo.ta : activeCropInfo.en}
                </p>
              </div>
              <button onClick={() => setSelectedCrop('')}
                style={{ fontSize: 12, fontWeight: 700, color: '#0A5C47', background: 'white', border: '1px solid #A7F3D0', borderRadius: 20, padding: '5px 14px', cursor: 'pointer' }}>
                {t.change}
              </button>
            </div>

            {/* Photo action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => cameraRef.current?.click()}
                style={{ background: 'white', borderRadius: 14, border: '1.5px solid #A7F3D0', padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={22} color="#0A5C47" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0A5C47' }}>{t.take_photo}</span>
              </button>
              <button onClick={() => galleryRef.current?.click()}
                style={{ background: 'white', borderRadius: 14, border: '1.5px solid #A7F3D0', padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={22} color="#0A5C47" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0A5C47' }}>{t.upload}</span>
              </button>
            </div>
          </section>
        )}

        {/* Hidden file inputs */}
        <input ref={cameraRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" capture="environment" style={{ display: 'none' }} onChange={onFileChange} />
        <input ref={galleryRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={onFileChange} />

        {/* ── Recent scans ──────────────────────────────────────────────────── */}
        <section>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t.recent}
          </p>

          {fallbackHistory.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: '28px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>{t.no_scans}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayedHistory.map((scan) => {
                const badge = confBadgeStyle(scan.level)
                const name  = lang === 'ta' ? (scan.nameTa ?? scan.nameEn) : scan.nameEn
                return (
                  <div key={scan.id} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    {scan.thumb ? (
                      <img src={scan.thumb} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ImageIcon size={18} color="#9CA3AF" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name ?? (lang === 'ta' ? 'கண்டறியப்பட்டது' : 'Diagnosed')}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>{formatDate(scan.date)}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                      {confLabel(scan.level)}
                    </span>
                  </div>
                )
              })}
              {fallbackHistory.length > 5 && !showAllHistory && (
                <button onClick={() => setShowAllHistory(true)}
                  style={{ width: '100%', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '10px', fontSize: 13, fontWeight: 700, color: '#0A5C47', cursor: 'pointer' }}>
                  {t.see_all} →
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Shared gradient header ────────────────────────────────────────────────────

function GradientHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '14px 16px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      {onBack && (
        <button onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}
      <div>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.2px' }}>{title}</h1>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{subtitle}</p>}
      </div>
    </header>
  )
}
