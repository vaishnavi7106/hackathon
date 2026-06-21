/**
 * Crop Sentinel — Disease Detection Page
 * Pillar 1 · Uzhavar AI
 *
 * Flow:
 *   1. Farmer taps "Take Photo" or "Upload"
 *   2. Image preview shown with optional crop tag
 *   3. POST /diagnose → loading state
 *   4a. High confidence → disease name (EN + TA), confidence bar,
 *       modern + indigenous treatment, SHAP heatmap (if returned)
 *   4b. Low confidence → retake prompt in Tamil
 *   5. History tab shows past diagnoses
 */

import { useRef, useState, useCallback } from 'react'
import { api } from '@/api/client'
import { useSchemeStore } from '@/store/schemeStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModernTreatment {
  chemical: string | null
  dosage: string | null
  cost_per_acre: number | null
  supply_note: string | null
}

interface IndigenousRemedy {
  name: string | null
  method: string | null
  preparation_ta: string | null
}

interface TreatmentOut {
  modern: ModernTreatment | null
  indigenous: IndigenousRemedy | null
}

interface DiseaseOut {
  id: string
  name_en: string
  name_ta: string
}

interface DiagnoseResponse {
  diagnosis_id: string
  disease?: DiseaseOut
  confidence?: number
  confidence_level?: 'high' | 'medium' | 'low'
  heatmap_url?: string | null
  treatment?: TreatmentOut | null
  low_confidence_prompt_ta?: string
  low_confidence_prompt_en?: string
}

interface HistoryItem {
  diagnosis_id: string
  disease_name_ta: string | null
  disease_name_en: string | null
  confidence: number | null
  created_at: string
  heatmap_url: string | null
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function diagnoseImage(
  file: File,
  crop?: string,
  latitude?: number,
  longitude?: number,
): Promise<DiagnoseResponse> {
  const form = new FormData()
  form.append('image', file)
  if (crop) form.append('crop', crop)
  if (latitude != null) form.append('latitude', String(latitude))
  if (longitude != null) form.append('longitude', String(longitude))
  return api.postForm<DiagnoseResponse>('/diagnose', form)
}

async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await api.get<{ diagnoses: HistoryItem[] }>('/diagnose/history')
  return res.diagnoses
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceColor(level?: string) {
  if (level === 'high') return 'bg-green-500'
  if (level === 'medium') return 'bg-saffron'
  return 'bg-red-400'
}

function confidenceBadge(level?: string, t?: (ta: string, en: string) => string) {
  if (!t) return ''
  if (level === 'high') return t('அதிக நம்பகம்', 'High Confidence')
  if (level === 'medium') return t('நடுத்தர நம்பகம்', 'Medium Confidence')
  return t('குறைந்த நம்பகம்', 'Low Confidence')
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ta-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'scan' | 'history'

export default function CropSentinel() {
  const { lang } = useSchemeStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const [tab, setTab] = useState<Tab>('scan')

  // Scan state
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [crop, setCrop] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnoseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [geoEnabled, setGeoEnabled] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // History state
  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setShowHeatmap(false)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  // ── Geolocation ─────────────────────────────────────────────────────────────

  const requestGeo = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoEnabled(true)
      },
      () => setGeoEnabled(false),
    )
  }

  // ── Diagnose ────────────────────────────────────────────────────────────────

  const handleDiagnose = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await diagnoseImage(
        file,
        crop || undefined,
        coords?.lat,
        coords?.lng,
      )
      setResult(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setPreview(null)
    setFile(null)
    setResult(null)
    setError(null)
    setShowHeatmap(false)
    setCrop('')
  }

  // ── History ─────────────────────────────────────────────────────────────────

  const loadHistory = async () => {
    if (history !== null) return
    setHistLoading(true)
    try {
      const items = await fetchHistory()
      setHistory(items)
    } catch {
      setHistory([])
    } finally {
      setHistLoading(false)
    }
  }

  const switchTab = (next: Tab) => {
    setTab(next)
    if (next === 'history') loadHistory()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="font-semibold text-gray-900 text-base">
          {t('பயிர் காவலன் 🌿', 'Crop Sentinel 🌿')}
        </h1>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
        {(['scan', 'history'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => switchTab(tb)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === tb
                ? 'text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tb === 'scan'
              ? t('நோய் கண்டறிதல்', 'Scan Leaf')
              : t('வரலாறு', 'History')}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-5 pb-28 space-y-4">

        {/* ── SCAN TAB ─────────────────────────────────────────────────────── */}
        {tab === 'scan' && (
          <>
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />

            {/* Image capture / upload buttons (shown when no image selected) */}
            {!preview && (
              <div className="card p-5 space-y-3">
                <p className="text-sm font-semibold text-gray-700 text-center">
                  {t('இலையின் படம் எடுக்கவும் அல்லது தேர்வு செய்யவும்', 'Take or upload a leaf photo')}
                </p>
                <p className="text-xs text-gray-400 text-center">
                  {t('நோயுற்ற இலையை நெருக்கமாக, நல்ல வெளிச்சத்தில் படம் எடுக்கவும்.',
                     'Close-up of the affected leaf in good daylight gives best results.')}
                </p>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-primary w-full"
                >
                  📸 {t('படம் எடு', 'Take Photo')}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full"
                >
                  🖼️ {t('கோப்பிலிருந்து தேர்வு', 'Choose from Gallery')}
                </button>
              </div>
            )}

            {/* Image preview */}
            {preview && !result && (
              <div className="card overflow-hidden">
                <img
                  src={preview}
                  alt="leaf preview"
                  className="w-full h-52 object-cover"
                />
                <div className="p-4 space-y-3">
                  {/* Optional crop label */}
                  <div>
                    <label className="label">
                      {t('பயிர் வகை (விருப்பமானது)', 'Crop type (optional)')}
                    </label>
                    <input
                      className="input"
                      placeholder={t('எ.கா. நெல், தக்காளி', 'e.g. rice, tomato')}
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                    />
                  </div>

                  {/* Geo toggle */}
                  <button
                    onClick={requestGeo}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors w-full ${
                      geoEnabled
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}
                  >
                    📍 {geoEnabled
                      ? t('இடம் பதிவு செய்யப்பட்டது ✓', `Location recorded ✓`)
                      : t('இடத்தை சேர்க்க (நோய் வெடிப்பு கண்காணிப்பிற்கு)', 'Add location (for outbreak tracking)')}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="btn-secondary flex-1"
                    >
                      {t('மீண்டும் எடு', 'Retake')}
                    </button>
                    <button
                      onClick={handleDiagnose}
                      disabled={loading}
                      className="btn-primary flex-1"
                    >
                      {loading
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            {t('பகுப்பாய்வு...', 'Analysing...')}
                          </span>
                        : t('நோய் கண்டறி', 'Diagnose')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="card border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {t('பிழை ஏற்பட்டது', 'Something went wrong')}
                </p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <button onClick={handleReset} className="mt-3 btn-secondary text-xs py-2 px-4">
                  {t('மீண்டும் முயற்சி', 'Try again')}
                </button>
              </div>
            )}

            {/* ── Result ─────────────────────────────────────────────────── */}
            {result && (
              <div className="space-y-3">

                {/* Low confidence */}
                {result.confidence_level === 'low' && (
                  <div className="card border border-saffron-200 bg-saffron-50 p-4">
                    <p className="text-sm font-bold text-saffron-800">
                      {t('படம் தெளிவாக இல்லை', 'Image unclear')}
                    </p>
                    <p className="text-xs text-saffron-700 mt-1">
                      {lang === 'ta'
                        ? result.low_confidence_prompt_ta
                        : result.low_confidence_prompt_en}
                    </p>
                    <button onClick={handleReset} className="mt-3 btn-primary text-xs py-2 px-4">
                      {t('மீண்டும் படம் எடு', 'Retake photo')}
                    </button>
                  </div>
                )}

                {/* Disease result card */}
                {result.disease && (
                  <>
                    <div className="card p-4 space-y-3">
                      {/* Disease name */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-bold text-gray-900">
                            {lang === 'ta' ? result.disease.name_ta : result.disease.name_en}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {lang === 'ta' ? result.disease.name_en : result.disease.name_ta}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap ${
                          result.confidence_level === 'high' ? 'bg-green-500' :
                          result.confidence_level === 'medium' ? 'bg-saffron' : 'bg-red-400'
                        }`}>
                          {confidenceBadge(result.confidence_level, t)}
                        </span>
                      </div>

                      {/* Confidence bar */}
                      {result.confidence != null && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500">{t('நம்பகத்தன்மை', 'Confidence')}</span>
                            <span className="text-xs font-bold text-gray-700">
                              {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${confidenceColor(result.confidence_level)}`}
                              style={{ width: `${(result.confidence * 100).toFixed(1)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Preview + heatmap toggle */}
                      {preview && (
                        <div>
                          <div className="relative rounded-xl overflow-hidden">
                            <img
                              src={showHeatmap && result.heatmap_url ? result.heatmap_url : preview}
                              alt="diagnosis"
                              className="w-full h-44 object-cover"
                            />
                          </div>
                          {result.heatmap_url && (
                            <button
                              onClick={() => setShowHeatmap(!showHeatmap)}
                              className="mt-2 text-xs text-primary-600 font-semibold underline underline-offset-2"
                            >
                              {showHeatmap
                                ? t('அசல் படம் காட்டு', 'Show original')
                                : t('AI கண்டறிதல் காட்டு (SHAP)', 'Show AI explanation (SHAP)')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Treatment */}
                    {result.treatment && (
                      <div className="space-y-2">

                        {/* Modern treatment */}
                        {result.treatment.modern?.chemical && (
                          <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">💊</span>
                              <p className="text-sm font-bold text-gray-800">
                                {t('நவீன சிகிச்சை', 'Modern Treatment')}
                              </p>
                            </div>
                            <p className="text-sm text-gray-700">{result.treatment.modern.chemical}</p>
                            {result.treatment.modern.dosage && (
                              <p className="text-xs text-gray-500 mt-1">
                                {t('அளவு: ', 'Dosage: ')}{result.treatment.modern.dosage}
                              </p>
                            )}
                            {result.treatment.modern.cost_per_acre != null && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {t('ஒரு ஏக்கர் செலவு: ₹', 'Cost/acre: ₹')}
                                {result.treatment.modern.cost_per_acre}
                              </p>
                            )}
                            {result.treatment.modern.supply_note && (
                              <p className="text-xs text-primary-700 bg-primary-50 rounded-lg px-3 py-1.5 mt-2">
                                📦 {result.treatment.modern.supply_note}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Indigenous remedy */}
                        {result.treatment.indigenous?.method && (
                          <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">🌿</span>
                              <p className="text-sm font-bold text-gray-800">
                                {t('நாட்டு மருத்துவம்', 'Indigenous Remedy')}
                              </p>
                            </div>
                            {result.treatment.indigenous.name && (
                              <p className="text-xs font-semibold text-primary-700 mb-1">
                                {result.treatment.indigenous.name}
                              </p>
                            )}
                            <p className="text-sm text-gray-700">
                              {lang === 'ta' && result.treatment.indigenous.preparation_ta
                                ? result.treatment.indigenous.preparation_ta
                                : result.treatment.indigenous.method}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scan again */}
                    <button onClick={handleReset} className="btn-secondary w-full">
                      {t('மற்றொரு இலை பரிசோதிக்கவும்', 'Scan another leaf')}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <>
            {histLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"/>
                    <div className="h-3 bg-gray-100 rounded w-1/3"/>
                  </div>
                ))}
              </div>
            )}

            {!histLoading && history?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-5xl mb-4">🌿</span>
                <p className="text-gray-500 text-sm font-medium">
                  {t('இதுவரை பரிசோதனை இல்லை', 'No diagnoses yet')}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {t('முதல் இலையை பரிசோதிக்கவும்', 'Scan your first leaf to get started')}
                </p>
                <button onClick={() => switchTab('scan')} className="btn-primary mt-4 text-sm px-5 py-2.5">
                  {t('இப்போது பரிசோதிக்கவும்', 'Scan now')}
                </button>
              </div>
            )}

            {!histLoading && history && history.length > 0 && (
              <div className="space-y-2.5">
                {history.map((item) => (
                  <div key={item.diagnosis_id} className="card p-4 flex items-center gap-3">
                    {item.heatmap_url ? (
                      <img
                        src={item.heatmap_url}
                        alt="heatmap"
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🌿</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {lang === 'ta'
                          ? (item.disease_name_ta ?? item.disease_name_en ?? t('அறியப்படாத நோய்', 'Unknown'))
                          : (item.disease_name_en ?? item.disease_name_ta ?? t('அறியப்படாத நோய்', 'Unknown'))}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(item.created_at)}
                        {item.confidence != null && (
                          <span className="ml-2 text-gray-400">
                            · {(item.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
