import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { farmerApi, syncProfileToBackend } from '@/api/farmer'
import { TN_DISTRICTS, TN_CROPS, INCOME_BANDS } from '@/data/tn-options'
import type { FarmerCrop, IrrigationType, Season } from '@/types/profile'
import { syncCropCompat } from '@/types/profile'
import { cn } from '@/lib/utils'

type Step = 0 | 1 | 2 | 3 | 4
const STEP_TITLES = {
  ta: ['தனிப்பட்ட தகவல்', 'இடம்', 'பண்ணை விவரங்கள்', 'தகுதி தகவல்', 'மண் & ஆவணங்கள்'],
  en: ['Personal Info', 'Location', 'Farm Details', 'Eligibility Info', 'Soil & Documents'],
}
const TOTAL_STEPS = 5

export default function ProfileOnboarding() {
  const navigate = useNavigate()
  const { profile, setField, markOnboardingComplete, markServerSynced } = useProfileStore()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn())
  const { lang } = useSchemeStore()

  const [step, setStep] = useState<Step>(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  function next() {
    if (step < TOTAL_STEPS - 1) setStep((s) => (s + 1) as Step)
    else finish()
  }

  function back() {
    if (step > 0) setStep((s) => (s - 1) as Step)
  }

  async function finish() {
    markOnboardingComplete()
    // Sync to server if logged in
    if (isLoggedIn) {
      setSaving(true)
      setSaveError(null)
      try {
        await syncProfileToBackend(useProfileStore.getState().profile)
        markServerSynced()
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Sync failed')
      } finally {
        setSaving(false)
      }
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F9FAFB', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-4" style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)' }}>
        <div className="flex items-center gap-3 mb-3">
          {step > 0 ? (
            <button onClick={back} className="text-white/70 text-xl leading-none">←</button>
          ) : (
            <div className="w-6" />
          )}
          <h1 className="flex-1 font-semibold text-base text-white">
            {t('சுயவிவர அமைப்பு', 'Profile Setup')}
          </h1>
          {step < TOTAL_STEPS - 1 && (
            <button onClick={finish} className="text-white/60 text-xs">
              {t('தவிர்', 'Skip')}
            </button>
          )}
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ backgroundColor: i <= step ? 'white' : 'rgba(255,255,255,0.3)' }}
            />
          ))}
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t(`படி ${step + 1} / ${TOTAL_STEPS}`, `Step ${step + 1} of ${TOTAL_STEPS}`)} — {STEP_TITLES[lang][step]}
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1 px-4 py-5 overflow-y-auto pb-32">
        {step === 0 && <StepPersonal lang={lang} profile={profile} setField={setField} />}
        {step === 1 && <StepLocation lang={lang} profile={profile} setField={setField} />}
        {step === 2 && <StepFarm lang={lang} profile={profile} setField={setField} />}
        {step === 3 && <StepEligibility lang={lang} profile={profile} setField={setField} />}
        {step === 4 && <StepSoilDocs lang={lang} profile={profile} setField={setField} />}
      </div>

      {/* Error */}
      {saveError && (
        <div className="mx-4 mb-2 rounded-xl px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200">
          {saveError}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={next}
          disabled={saving}
          className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-60"
        >
          {saving
            ? t('சேமிக்கிறது…', 'Saving…')
            : step < TOTAL_STEPS - 1
            ? t('அடுத்து →', 'Next →')
            : t('சேமி & முடி ✓', 'Save & Finish ✓')}
        </button>
        {step === TOTAL_STEPS - 1 && (
          <p className="text-center text-xs text-gray-400 mt-2">
            {isLoggedIn
              ? t('தகவல்கள் சேவையகத்தில் சேமிக்கப்படும்', 'Data will be saved to server')
              : t('கணக்கு இல்லை — உள்நுழைந்த பிறகு ஒத்திசைக்கப்படும்', 'No account — will sync after login')
            }
          </p>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface StepProps {
  lang: 'ta' | 'en'
  profile: ReturnType<typeof useProfileStore.getState>['profile']
  setField: ReturnType<typeof useProfileStore.getState>['setField']
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', readOnly }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  readOnly?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={cn(
        'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent',
        readOnly && 'bg-gray-50 text-gray-500',
      )}
    />
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 appearance-none"
    >
      <option value="">— தேர்ந்தெடு —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function YesNoToggle({ value, onChange, yesLabel, noLabel }: {
  value: boolean | null
  onChange: (v: boolean) => void
  yesLabel: string
  noLabel: string
}) {
  return (
    <div className="flex gap-3">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors"
          style={value === v
            ? { backgroundColor: '#0A5C47', color: 'white', borderColor: '#0A5C47' }
            : { backgroundColor: 'white', color: '#374151', borderColor: '#D1D5DB' }}
        >
          {v ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  )
}

function OptionGroup<T extends string>({ value, onChange, options, cols = 2 }: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<{ value: T; ta: string; en: string }>
  cols?: number
}) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="py-2.5 rounded-xl border text-sm font-medium text-center transition-colors"
          style={value === o.value
            ? { backgroundColor: '#0A5C47', color: 'white', borderColor: '#0A5C47' }
            : { backgroundColor: 'white', color: '#374151', borderColor: '#D1D5DB' }}
        >
          {o.ta}
          <span className="block text-xs opacity-70 mt-0.5">{o.en}</span>
        </button>
      ))}
    </div>
  )
}

// ── Step 1: Personal ──────────────────────────────────────────────────────────
function StepPersonal({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <Field label={t('முழு பெயர்', 'Full Name')}>
        <Input value={profile.name} onChange={(v) => setField('name', v)} placeholder={t('உங்கள் பெயர் உள்ளிடுக', 'Enter your full name')} />
      </Field>
      <Field label={t('வயது', 'Age')}>
        <Input value={profile.age} onChange={(v) => setField('age', v)} placeholder={t('உங்கள் வயது', 'Your age')} type="number" />
      </Field>
      <Field
        label={t('மொபைல் எண்', 'Mobile Number')}
        hint={t('பதிவின் போது சேர்க்கப்படும்', 'Auto-filled from registration')}
      >
        <Input
          value={profile.phone}
          onChange={(v) => setField('phone', v)}
          placeholder="9876543210"
          type="tel"
          readOnly={!!profile.phone}
        />
      </Field>
      <Field label={t('பாலினம் (விருப்பம்)', 'Gender (optional)')}>
        <OptionGroup
          value={profile.gender}
          onChange={(v) => setField('gender', v)}
          options={[
            { value: 'male', ta: 'ஆண்', en: 'Male' },
            { value: 'female', ta: 'பெண்', en: 'Female' },
            { value: 'other', ta: 'மற்றவை', en: 'Other' },
          ]}
          cols={3}
        />
      </Field>
      <Field label={t('விருப்ப மொழி', 'Preferred Language')}>
        <OptionGroup
          value={profile.language}
          onChange={(v) => setField('language', v)}
          options={[
            { value: 'ta', ta: 'தமிழ்', en: 'Tamil' },
            { value: 'en', ta: 'ஆங்கிலம்', en: 'English' },
          ]}
        />
      </Field>
    </div>
  )
}

// ── Step 2: Location ──────────────────────────────────────────────────────────
function StepLocation({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <Field label={t('மாவட்டம்', 'District')}>
        <Select
          value={profile.district}
          onChange={(v) => setField('district', v)}
          options={TN_DISTRICTS.map((d) => ({ value: d, label: d }))}
        />
      </Field>
      <Field label={t('வட்டம் (தாலுக்கா)', 'Taluk')}>
        <Input value={profile.taluk} onChange={(v) => setField('taluk', v)} placeholder={t('வட்டம் பெயர்', 'Enter taluk name')} />
      </Field>
      <Field label={t('கிராமம்', 'Village')}>
        <Input value={profile.village} onChange={(v) => setField('village', v)} placeholder={t('கிராம பெயர்', 'Enter village name')} />
      </Field>
    </div>
  )
}

// ── Step 3: Farm (multi-crop) ─────────────────────────────────────────────────
function StepFarm({ lang, profile, setField }: StepProps) {
  const { addCrop, updateCrop, removeCrop } = useProfileStore()
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  const today = new Date().toISOString().slice(0, 10)
  const minDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const SEASON_OPTS = [
    { value: 'wet_season' as Season, ta: 'ஆடி/குறுவை', en: 'Wet Season' },
    { value: 'dry_season' as Season, ta: 'சம்பா/கார்', en: 'Dry Season' },
    { value: 'summer' as Season, ta: 'கோடை', en: 'Summer' },
  ]
  const IRR_OPTS = [
    { value: 'borewell' as IrrigationType, ta: 'ஆழ்துளை', en: 'Borewell' },
    { value: 'canal' as IrrigationType, ta: 'கால்வாய்', en: 'Canal' },
    { value: 'tank' as IrrigationType, ta: 'குளம்', en: 'Tank' },
    { value: 'rainfed' as IrrigationType, ta: 'மழை நீர்', en: 'Rain-fed' },
    { value: 'drip' as IrrigationType, ta: 'சொட்டு நீர்', en: 'Drip' },
  ]

  // Inline add/edit form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formAcres, setFormAcres] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formSeason, setFormSeason] = useState<Season | ''>('')
  const [formIrr, setFormIrr] = useState<IrrigationType | ''>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const crops = profile.crops ?? []

  function openAdd() {
    setEditingId(null)
    setFormName('')
    setFormAcres('')
    setFormDate('')
    setFormSeason('')
    setFormIrr('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(crop: FarmerCrop) {
    setEditingId(crop.id)
    setFormName(crop.name)
    setFormAcres(String(crop.acres))
    setFormDate(crop.plantingDate)
    setFormSeason(crop.season)
    setFormIrr(crop.irrigationType)
    setFormError(null)
    setShowForm(true)
  }

  function saveCrop() {
    if (!formName) { setFormError(t('பயிர் தேர்ந்தெடுக்கவும்', 'Select a crop')); return }
    const acres = parseFloat(formAcres)
    if (isNaN(acres) || acres <= 0) { setFormError(t('சரியான ஏக்கர் அளவு உள்ளிடுக', 'Enter valid acres')); return }
    if (formDate) {
      if (formDate > today) { setFormError(t('நடவு தேதி இன்றைக்கு பிறகு இருக்க முடியாது', 'Date cannot be in the future')); return }
      if (formDate < minDate) { setFormError(t('தேதி 180 நாட்களுக்கு மேல் பழையதாக இருக்க முடியாது', 'Date too far back — over 180 days')); return }
    }
    // Unique crop name (among other crops, not the one being edited)
    const others = crops.filter((c) => c.id !== editingId)
    if (others.some((c) => c.name === formName)) {
      setFormError(t('இந்த பயிர் ஏற்கனவே சேர்க்கப்பட்டுள்ளது', 'This crop is already added'))
      return
    }

    const payload = {
      name: formName,
      acres,
      plantingDate: formDate,
      season: formSeason,
      irrigationType: formIrr,
    }

    if (editingId) {
      updateCrop(editingId, payload)
    } else {
      addCrop(payload)
    }
    setShowForm(false)
  }

  const cropLabel = (value: string) => {
    const found = TN_CROPS.find((c) => c.value === value)
    return found ? (lang === 'ta' ? `${found.ta} (${found.en})` : `${found.en} / ${found.ta}`) : value
  }

  return (
    <div className="space-y-4">

      {/* Crop cards */}
      {crops.length > 0 && (
        <div className="space-y-2">
          {crops.map((crop) => {
            const label = TN_CROPS.find((c) => c.value === crop.name)
            const displayName = label ? (lang === 'ta' ? label.ta : label.en) : crop.name
            return (
              <div
                key={crop.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{displayName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {crop.acres} {t('ஏக்கர்', 'acres')}
                    {crop.plantingDate && ` · ${crop.plantingDate}`}
                  </p>
                  {crop.season && (
                    <p className="text-xs text-gray-400">
                      {SEASON_OPTS.find((s) => s.value === crop.season)?.[lang] ?? crop.season}
                      {crop.irrigationType && ` · ${IRR_OPTS.find((i) => i.value === crop.irrigationType)?.[lang] ?? crop.irrigationType}`}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(crop)}
                    className="text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ color: '#0A5C47' }}
                  >
                    {t('திருத்து', 'Edit')}
                  </button>
                  {crops.length > 1 && (
                    <button
                      onClick={() => setConfirmRemoveId(crop.id)}
                      className="text-xs text-red-500 font-semibold px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      {t('நீக்கு', 'Remove')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {crops.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <p className="text-gray-500 text-sm">{t('பயிர் சேர்க்கவும்', 'Add at least one crop')}</p>
        </div>
      )}

      {/* Add crop button */}
      {crops.length < 5 && !showForm && (
        <button
          onClick={openAdd}
          className="w-full rounded-xl border-2 border-dashed py-3 text-sm font-semibold transition-colors"
          style={{ borderColor: '#12A07A', color: '#0A5C47' }}
        >
          + {t('பயிர் சேர்க்கவும்', 'Add crop')}
        </button>
      )}

      {/* Inline add/edit form */}
      {showForm && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: '#C5E8DC', backgroundColor: '#E8F5F1' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0A5C47' }}>
            {editingId ? t('பயிர் திருத்து', 'Edit Crop') : t('புதிய பயிர்', 'New Crop')}
          </p>

          <Field label={t('பயிர்', 'Crop')}>
            <Select
              value={formName}
              onChange={setFormName}
              options={TN_CROPS.map((c) => ({ value: c.value, label: cropLabel(c.value) }))}
            />
          </Field>

          <Field label={t('ஏக்கர் அளவு', 'Acres')}>
            <Input
              value={formAcres}
              onChange={setFormAcres}
              placeholder="e.g. 2.5"
              type="number"
            />
          </Field>

          <Field
            label={t('நடவு தேதி', 'Planting Date')}
            hint={t('நீர் & உர அட்டவணைக்கு தேவை', 'Used for water & fertilizer schedule')}
          >
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              max={today}
              min={minDate}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </Field>

          <Field label={t('பருவம்', 'Season')}>
            <OptionGroup
              value={formSeason}
              onChange={(v) => setFormSeason(v)}
              options={SEASON_OPTS}
              cols={3}
            />
          </Field>

          <Field label={t('நீர்பாசன முறை', 'Irrigation')}>
            <OptionGroup
              value={formIrr}
              onChange={(v) => setFormIrr(v)}
              options={IRR_OPTS}
            />
          </Field>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <button
              onClick={saveCrop}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#0A5C47' }}
            >
              {t('சேமி', 'Save')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600"
            >
              {t('ரத்து', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemoveId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            {t('நீக்க உறுதிப்படுத்தல்', 'Confirm removal')}
          </p>
          <p className="text-xs text-red-700">
            {(() => {
              const crop = crops.find((c) => c.id === confirmRemoveId)
              const label = crop ? TN_CROPS.find((c) => c.value === crop.name) : null
              const name = label ? (lang === 'ta' ? label.ta : label.en) : crop?.name ?? ''
              return t(
                `"${name}" பயிரை நீக்கினால் அதன் பண்ணை நாட்குறிப்பு தரவும் அழிக்கப்படும். தொடரவும்?`,
                `Removing "${name}" will delete its farm diary history. Continue?`,
              )
            })()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { removeCrop(confirmRemoveId); setConfirmRemoveId(null) }}
              className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
            >
              {t('நீக்கு', 'Remove')}
            </button>
            <button
              onClick={() => setConfirmRemoveId(null)}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600"
            >
              {t('ரத்து', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Land ownership — profile-level (not per crop) */}
      <div className="pt-2 border-t border-gray-100">
        <Field label={t('நில உரிமை', 'Land Ownership')}>
          <OptionGroup
            value={profile.landOwnership}
            onChange={(v) => setField('landOwnership', v)}
            options={[
              { value: 'own', ta: 'சொந்த நிலம்', en: 'Own Land' },
              { value: 'tenant', ta: 'குத்தகை', en: 'Tenant' },
              { value: 'lease', ta: 'குத்தகை ஒப்பந்தம்', en: 'Lease' },
            ]}
            cols={3}
          />
        </Field>
      </div>
    </div>
  )
}

// ── Step 4: Eligibility ───────────────────────────────────────────────────────
function StepEligibility({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#E8F5F1', border: '1px solid #C5E8DC', color: '#0A5C47' }}>
        {t(
          'இந்த தகவல்கள் PM-KISAN, KCC போன்ற திட்டங்களில் தகுதி சரிபார்க்க பயன்படுகின்றன.',
          'This information is used to check eligibility for schemes like PM-KISAN, KCC etc.',
        )}
      </div>
      <Field label={t('ஆதார் இணைக்கப்பட்டுள்ளதா?', 'Is Aadhaar linked to bank?')}>
        <YesNoToggle
          value={profile.aadhaarLinked}
          onChange={(v) => setField('aadhaarLinked', v)}
          yesLabel={t('ஆம்', 'Yes')}
          noLabel={t('இல்லை', 'No')}
        />
        {profile.aadhaarLinked === false && (
          <p className="text-xs text-orange-600 mt-1">
            ⚠️ {t('PM-KISAN திட்டத்திற்கு ஆதார் இணைப்பு அவசியம்.', 'Aadhaar linkage is required for PM-KISAN.')}
          </p>
        )}
      </Field>
      <Field label={t('வங்கி கணக்கு உள்ளதா?', 'Bank account linked?')}>
        <YesNoToggle
          value={profile.bankAccountLinked}
          onChange={(v) => setField('bankAccountLinked', v)}
          yesLabel={t('ஆம்', 'Yes')}
          noLabel={t('இல்லை', 'No')}
        />
      </Field>
      <Field label={t('வருடாந்திர வருமானம்', 'Annual Income Band')}>
        <Select
          value={profile.incomeBand}
          onChange={(v) => setField('incomeBand', v as typeof profile.incomeBand)}
          options={INCOME_BANDS.map((b) => ({
            value: b.value,
            label: lang === 'ta' ? b.ta : b.en,
          }))}
        />
      </Field>
    </div>
  )
}

// ── Step 5: Soil & Documents ──────────────────────────────────────────────────
function StepSoilDocs({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      await farmerApi.uploadSoilHealthCard(file)
      setField('soilHealthCardUploaded', true)
      setUploadMsg(t('வெற்றிகரமாக பதிவேற்றப்பட்டது ✓', 'Uploaded successfully ✓'))
    } catch {
      setUploadMsg(t('பதிவேற்றம் தோல்வி — மீண்டும் முயற்சி', 'Upload failed — please retry'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-gray-500">
        {t('இந்த விவரங்கள் மண் & நீர் மேலாளர் (Pillar 2) க்கு தானாக பயன்படும்.', 'These details are used automatically by the Soil Optimizer.')}
      </p>

      <Field label={t('மண் வகை', 'Soil Type')}>
        <OptionGroup
          value={profile.soilType}
          onChange={(v) => setField('soilType', v)}
          options={[
            { value: 'clay', ta: 'களிமண்', en: 'Clay' },
            { value: 'loamy', ta: 'வண்டல் மண்', en: 'Loamy' },
            { value: 'sandy', ta: 'மணல் மண்', en: 'Sandy' },
            { value: 'red', ta: 'செம்மண்', en: 'Red Soil' },
            { value: 'black', ta: 'கரிசல் மண்', en: 'Black Soil' },
            { value: 'other', ta: 'மற்றவை', en: 'Other' },
          ]}
        />
      </Field>

      <Field
        label={t('மண் ஆரோக்கிய அட்டை', 'Soil Health Card')}
        hint={t('PDF அல்லது படம் (JPEG/PNG) — அதிகபட்சம் 10MB', 'PDF or image (JPEG/PNG) — max 10MB')}
      >
        {profile.soilHealthCardUploaded ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
            <span className="text-green-600 font-semibold text-sm">✓</span>
            <span className="text-sm text-green-700">
              {t('அட்டை பதிவேற்றப்பட்டது', 'Card uploaded')}
            </span>
            <button
              className="ml-auto text-xs text-gray-500 underline"
              onClick={() => {
                setField('soilHealthCardUploaded', false)
                setUploadMsg(null)
              }}
            >
              {t('மாற்று', 'Replace')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-60"
          >
            {uploading
              ? t('பதிவேற்றுகிறது…', 'Uploading…')
              : t('📎 கோப்பை தேர்ந்தெடு', '📎 Choose file')
            }
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleUpload}
        />
        {uploadMsg && (
          <p className={cn('text-xs mt-1', uploadMsg.includes('✓') ? 'text-green-600' : 'text-red-600')}>
            {uploadMsg}
          </p>
        )}
      </Field>
    </div>
  )
}
