import { useRef, useState, useEffect, useCallback } from 'react'
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
  { id: 'rice',      emoji: '🌾', en: 'Rice',          ta: 'நெல்'          },
  { id: 'tomato',    emoji: '🍅', en: 'Tomato',        ta: 'தக்காளி'       },
  { id: 'banana',    emoji: '🍌', en: 'Banana',        ta: 'வாழை'          },
  { id: 'groundnut', emoji: '🥜', en: 'Groundnut',     ta: 'நிலக்கடலை'    },
  { id: 'sugarcane', emoji: '🌿', en: 'Sugarcane',     ta: 'கரும்பு'       },
  { id: 'maize',     emoji: '🌽', en: 'Corn (Maize)',  ta: 'மக்காச்சோளம்' },
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
    take_photo:         '📷 புகைப்படம் எடுக்கவும்',
    upload:             '🖼 படம் பதிவேற்றவும்',
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
    take_photo:         '📷 Take Photo',
    upload:             '🖼 Upload Image',
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
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-base">{t.title}</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-24">
          <div className="relative">
            <img
              src={phase.preview}
              alt="selected leaf"
              className="w-52 h-52 rounded-2xl object-cover shadow-lg border-4 border-white"
            />
            {!isError && (
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.35)' }}
              >
                <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {isError ? (
            <div className="w-full max-w-xs space-y-4 text-center">
              <p className="text-sm text-red-700 font-medium">{phase.message}</p>
              <button
                onClick={() => handleFile(phase.file)}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: '#1B4332' }}
              >
                {t.retry}
              </button>
              <button onClick={goHome} className="text-sm text-green-700 underline">
                {t.retake_link}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600 font-medium">{t.analysing}</p>
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
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-base">{t.title} 🌿</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 pb-24 text-center">
          <span className="text-5xl">⚠️</span>

          <p className="text-base font-bold text-gray-900 leading-snug">
            {lang === 'ta'
              ? `இந்த படத்தில் ${cropLabel} நோயை தெளிவாக கண்டறிய முடியவில்லை.`
              : `We couldn't clearly identify a ${cropLabel} disease in this photo.`}
          </p>

          <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
            {lang === 'ta'
              ? 'நெருக்கமான தெளிவான படம் எடுக்கவும், அல்லது அறிகுறிகளை விவரிக்கவும்.'
              : 'Try a closer, clearer photo — or describe what you see on the leaf.'}
          </p>

          <div className="w-full max-w-xs space-y-3 mt-2">
            <button
              onClick={goHome}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: '#1B4332' }}
            >
              {t.mismatch_try_photo}
            </button>

            {localSymptoms.length > 0 && (
              <button
                onClick={() =>
                  setPhase({
                    kind:    'symptom_check_local',
                    cropId:  phase.selectedCropId,
                    preview: phase.preview,
                  })
                }
                className="w-full py-3 rounded-xl text-sm font-bold border-2 border-amber-600 text-amber-800 bg-amber-50"
              >
                {t.mismatch_symptoms}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 3a — Rice backend symptom checker (existing, unchanged)
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'symptom_check') {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-base">
            {lang === 'ta' ? 'நோயை கண்டறிக' : 'Identify the Disease'}
          </h1>
        </header>

        <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
          <SymptomSelector
            lang={lang}
            promptText={lang === 'ta' ? phase.promptTa : phase.promptEn}
            symptoms={phase.symptoms}
            loading={phase.sympLoading}
            onSubmit={handleSymptomSubmit}
          />

          {phase.sympError && (
            <p className="text-xs text-red-600 text-center mt-3">{phase.sympError}</p>
          )}

          <div className="mt-5 text-center">
            <button onClick={goHome} className="text-sm text-green-700 underline">
              {t.retake_link}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 3b — Frontend-only symptom checker (all 6 crops from mismatch)
  // ══════════════════════════════════════════════════════════════════════
  if (phase.kind === 'symptom_check_local') {
    const cropInfo    = MODEL_CROPS.find(c => c.id === phase.cropId)
    const cropLabel   = lang === 'ta' ? cropInfo?.ta : cropInfo?.en
    const localSymptoms: SymptomOption[] = SYMPTOM_MAP[phase.cropId]?.symptoms ?? []

    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-base">
            {lang === 'ta' ? 'நோயை கண்டறிக' : 'Identify the Disease'}
          </h1>
          {cropLabel && (
            <p className="text-xs text-gray-500 mt-0.5">
              {cropInfo?.emoji} {cropLabel}
            </p>
          )}
        </header>

        <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
          <SymptomSelector
            lang={lang}
            promptText={lang === 'ta' ? t.symp_prompt : t.symp_prompt}
            symptoms={localSymptoms}
            loading={false}
            onSubmit={handleLocalSymptomSubmit}
          />

          <div className="mt-5 text-center">
            <button onClick={goHome} className="text-sm text-green-700 underline">
              {t.retake_link}
            </button>
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
      <div className="flex flex-col min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="font-semibold text-gray-900 text-base">
            {lang === 'ta' ? 'கண்டறிதல் முடிவு' : 'Diagnosis Result'}
          </h1>
        </header>

        <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
          <DiagnosisResult
            lang={lang}
            response={phase.response}
            preview={phase.preview}
            cropName={phase.cropName}
            hasMismatch={phase.hasMismatch}
            onReset={goHome}
          />
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Home (2-step crop selection → photo upload)
  // ══════════════════════════════════════════════════════════════════════
  const activeCropInfo = MODEL_CROPS.find(c => c.id === selectedCrop)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">{t.title} 🌿</h1>
        <p className="text-xs text-gray-500 mt-0.5">{t.subtitle}</p>
      </header>

      <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto space-y-6">

        {/* File error */}
        {fileError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{fileError}</p>
          </div>
        )}

        {/* ── STEP 1: Crop grid — show when no crop is selected ───────── */}
        {!selectedCrop && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-700">{t.pick_crop}</p>
            <div className="grid grid-cols-2 gap-3">
              {MODEL_CROPS.map((crop) => (
                <button
                  key={crop.id}
                  onClick={() => setSelectedCrop(crop.id)}
                  className="rounded-2xl border-2 border-gray-200 bg-white py-5 flex flex-col items-center gap-1.5 text-center transition-all hover:border-green-400 hover:bg-green-50 active:scale-95"
                >
                  <span className="text-4xl">{crop.emoji}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {lang === 'ta' ? crop.ta : crop.en}
                  </span>
                  {lang !== 'ta' && (
                    <span className="text-xs text-gray-400">{crop.ta}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Photo upload — show after crop is selected ──────── */}
        {selectedCrop && activeCropInfo && (
          <div className="space-y-4">
            {/* Selected crop banner */}
            <div className="rounded-2xl bg-green-50 border-2 border-green-700 px-4 py-3 flex items-center gap-3">
              <span className="text-3xl shrink-0">{activeCropInfo.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">
                  {t.selected_prefix}
                </p>
                <p className="text-base font-bold text-green-900">
                  {lang === 'ta' ? activeCropInfo.ta : activeCropInfo.en}
                  {lang !== 'ta' && (
                    <span className="ml-2 text-sm font-normal text-green-700">({activeCropInfo.ta})</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedCrop('')}
                className="text-xs text-green-700 font-semibold border border-green-400 rounded-full px-3 py-1 hover:bg-green-100 shrink-0"
              >
                {t.change}
              </button>
            </div>

            {/* Photo buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="rounded-2xl border-2 border-green-700 bg-white py-5 flex flex-col items-center gap-2 transition hover:bg-green-50"
              >
                <span className="text-3xl">📷</span>
                <span className="text-xs font-bold text-green-800">{t.take_photo}</span>
              </button>

              <button
                onClick={() => galleryRef.current?.click()}
                className="rounded-2xl border-2 border-green-700 bg-white py-5 flex flex-col items-center gap-2 transition hover:bg-green-50"
              >
                <span className="text-3xl">🖼</span>
                <span className="text-xs font-bold text-green-800">{t.upload}</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
        />

        {/* ── Recent scans ─────────────────────────────────────────────── */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-3">{t.recent}</p>

          {fallbackHistory.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 px-4 py-8 text-center">
              <p className="text-sm text-gray-400">{t.no_scans}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedHistory.map((scan) => {
                const badge = confBadgeStyle(scan.level)
                const name  = lang === 'ta' ? (scan.nameTa ?? scan.nameEn) : scan.nameEn
                return (
                  <div
                    key={scan.id}
                    className="rounded-xl bg-white border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm"
                  >
                    {scan.thumb ? (
                      <img
                        src={scan.thumb}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-xl">🌿</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {name ?? (lang === 'ta' ? 'கண்டறியப்பட்டது' : 'Diagnosed')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(scan.date)}</p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {confLabel(scan.level)}
                    </span>
                  </div>
                )
              })}

              {fallbackHistory.length > 5 && !showAllHistory && (
                <button
                  onClick={() => setShowAllHistory(true)}
                  className="w-full text-xs text-green-700 font-semibold py-2 text-center"
                >
                  {t.see_all} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
