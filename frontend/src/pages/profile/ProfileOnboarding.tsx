import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { TN_DISTRICTS, TN_CROPS, INCOME_BANDS } from '@/data/tn-options'
import { cn } from '@/lib/utils'

type Step = 0 | 1 | 2 | 3 | 4
const STEP_TITLES = {
  ta: ['தனிப்பட்ட தகவல்', 'இடம்', 'பண்ணை விவரங்கள்', 'தகுதி தகவல்', 'மேலும் தகவல்கள் (விருப்பம்)'],
  en: ['Personal Info', 'Location', 'Farm Details', 'Eligibility Info', 'Additional (Optional)'],
}
const TOTAL_STEPS = 5

export default function ProfileOnboarding() {
  const navigate = useNavigate()
  const { profile, setField, markOnboardingComplete } = useProfileStore()
  const { lang } = useSchemeStore()

  const [step, setStep] = useState<Step>(0)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  function next() {
    if (step < TOTAL_STEPS - 1) setStep((s) => (s + 1) as Step)
    else finish()
  }

  function back() {
    if (step > 0) setStep((s) => (s - 1) as Step)
  }

  function finish() {
    markOnboardingComplete()
    navigate('/', { replace: true })
  }

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary-900 text-white px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          {step > 0 ? (
            <button onClick={back} className="text-primary-300 text-xl">←</button>
          ) : (
            <div className="w-6" />
          )}
          <h1 className="flex-1 font-bold text-base">
            {t('சுயவிவர அமைப்பு', 'Profile Setup')}
          </h1>
          {step < TOTAL_STEPS - 1 && (
            <button onClick={finish} className="text-primary-300 text-xs">
              {t('தவிர்', 'Skip')}
            </button>
          )}
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-1 rounded-full transition-all duration-300',
                i <= step ? 'bg-white' : 'bg-primary-700',
              )}
            />
          ))}
        </div>
        <p className="text-primary-300 text-xs">
          {t(`படி ${step + 1} / ${TOTAL_STEPS}`, `Step ${step + 1} of ${TOTAL_STEPS}`)} — {STEP_TITLES[lang][step]}
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1 px-4 py-5 overflow-y-auto pb-32">
        {step === 0 && <StepPersonal lang={lang} profile={profile} setField={setField} />}
        {step === 1 && <StepLocation lang={lang} profile={profile} setField={setField} />}
        {step === 2 && <StepFarm lang={lang} profile={profile} setField={setField} />}
        {step === 3 && <StepEligibility lang={lang} profile={profile} setField={setField} />}
        {step === 4 && <StepOptional lang={lang} profile={profile} setField={setField} />}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-4 py-3">
        <button
          onClick={next}
          className="w-full btn-primary py-3 text-base font-semibold"
        >
          {step < TOTAL_STEPS - 1
            ? t('அடுத்து →', 'Next →')
            : t('முடிக்க ✓', 'Finish ✓')}
        </button>
        {step === TOTAL_STEPS - 1 && (
          <p className="text-center text-xs text-gray-400 mt-2">
            {t('இந்த தகவல்கள் விருப்பமானவை', 'These fields are optional')}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Step Components ───────────────────────────────────────────────────────────

interface StepProps {
  lang: 'ta' | 'en'
  profile: ReturnType<typeof useProfileStore.getState>['profile']
  setField: ReturnType<typeof useProfileStore.getState>['setField']
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
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
          className={cn(
            'flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors',
            value === v
              ? 'bg-primary-700 text-white border-primary-700'
              : 'bg-white text-gray-700 border-gray-300',
          )}
        >
          {v ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  )
}

function OptionGroup<T extends string>({ value, onChange, options }: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<{ value: T; ta: string; en: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'py-2.5 rounded-xl border text-sm font-medium text-center transition-colors',
            value === o.value
              ? 'bg-primary-700 text-white border-primary-700'
              : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300',
          )}
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
      <div className="text-4xl text-center mb-2">👤</div>
      <Field label={t('முழு பெயர்', 'Full Name')}>
        <Input value={profile.name} onChange={(v) => setField('name', v)} placeholder={t('உங்கள் பெயர் உள்ளிடுக', 'Enter your full name')} />
      </Field>
      <Field label={t('வயது', 'Age')}>
        <Input value={profile.age} onChange={(v) => setField('age', v)} placeholder={t('உங்கள் வயது', 'Your age')} type="number" />
      </Field>
      <Field label={t('மொபைல் எண்', 'Mobile Number')}>
        <Input value={profile.phone} onChange={(v) => setField('phone', v)} placeholder="10-digit mobile number" type="tel" />
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
      <div className="text-4xl text-center mb-2">📍</div>
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

// ── Step 3: Farm ──────────────────────────────────────────────────────────────
function StepFarm({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <div className="text-4xl text-center mb-2">🌾</div>
      <Field label={t('முதன்மை பயிர்', 'Primary Crop')}>
        <Select
          value={profile.primaryCrop}
          onChange={(v) => setField('primaryCrop', v)}
          options={TN_CROPS.map((c) => ({ value: c.value, label: lang === 'ta' ? `${c.ta} (${c.en})` : `${c.en} / ${c.ta}` }))}
        />
      </Field>
      <Field label={t('இரண்டாம் பயிர் (விருப்பம்)', 'Secondary Crop (optional)')}>
        <Select
          value={profile.secondaryCrop}
          onChange={(v) => setField('secondaryCrop', v)}
          options={TN_CROPS.map((c) => ({ value: c.value, label: lang === 'ta' ? `${c.ta} (${c.en})` : `${c.en} / ${c.ta}` }))}
        />
      </Field>
      <Field label={t('நில அளவு (ஏக்கரில்)', 'Land Size (acres)')}>
        <Input value={profile.landSizeAcres} onChange={(v) => setField('landSizeAcres', v)} placeholder="e.g. 2.5" type="number" />
      </Field>
      <Field label={t('நில உரிமை', 'Land Ownership')}>
        <OptionGroup
          value={profile.landOwnership}
          onChange={(v) => setField('landOwnership', v)}
          options={[
            { value: 'own', ta: 'சொந்த நிலம்', en: 'Own Land' },
            { value: 'tenant', ta: 'குத்தகை', en: 'Tenant' },
            { value: 'lease', ta: 'குத்தகை ஒப்பந்தம்', en: 'Lease' },
          ]}
        />
      </Field>
      <Field label={t('நீர்பாசன வகை', 'Irrigation Type')}>
        <OptionGroup
          value={profile.irrigationType}
          onChange={(v) => setField('irrigationType', v)}
          options={[
            { value: 'rain_fed', ta: 'மழை நீர்', en: 'Rain-fed' },
            { value: 'irrigated', ta: 'பாசன நீர்', en: 'Irrigated' },
            { value: 'mixed', ta: 'கலப்பு', en: 'Mixed' },
          ]}
        />
      </Field>
    </div>
  )
}

// ── Step 4: Eligibility ───────────────────────────────────────────────────────
function StepEligibility({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <div className="text-4xl text-center mb-2">🪪</div>
      <div className="card p-3 bg-primary-50 border-primary-100 text-xs text-primary-800">
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

// ── Step 5: Optional ──────────────────────────────────────────────────────────
function StepOptional({ lang, profile, setField }: StepProps) {
  const t = (ta: string, en: string) => lang === 'ta' ? ta : en
  return (
    <div className="space-y-4">
      <div className="text-4xl text-center mb-2">🔬</div>
      <p className="text-center text-xs text-gray-500">
        {t('இந்த விவரங்கள் எதிர்காலத்தில் மேம்படுத்தப்பட்ட பரிந்துரைகளுக்கு உதவும்.', 'These details enable better recommendations in future features.')}
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
      <Field label={t('நீர் ஆதாரம்', 'Water Source')}>
        <Input
          value={profile.waterSource}
          onChange={(v) => setField('waterSource', v)}
          placeholder={t('கிணறு, ஆறு, குளம்…', 'Well, river, tank…')}
        />
      </Field>
      <Field label={t('கால்நடை வகை', 'Livestock Type')}>
        <Input
          value={profile.livestockType}
          onChange={(v) => setField('livestockType', v)}
          placeholder={t('மாடு, ஆடு, கோழி…', 'Cow, goat, poultry…')}
        />
      </Field>
    </div>
  )
}
