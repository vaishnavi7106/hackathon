import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useFarmerStore } from '@/store/farmerStore'
import { syncProfileToBackend } from '@/api/farmer'
import { PILLAR_REQUIREMENTS, PILLAR_LABELS, computeCompletion } from '@/types/profile'
import { TN_CROPS } from '@/data/tn-options'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils'

const FIELD_LABELS: Record<string, { ta: string; en: string }> = {
  name: { ta: 'பெயர்', en: 'Name' },
  district: { ta: 'மாவட்டம்', en: 'District' },
  primaryCrop: { ta: 'முதன்மை பயிர்', en: 'Primary Crop' },
  landSizeAcres: { ta: 'நில அளவு', en: 'Land Size' },
  irrigationType: { ta: 'நீர்பாசன முறை', en: 'Irrigation Method' },
  season: { ta: 'பருவம்', en: 'Season' },
  age: { ta: 'வயது', en: 'Age' },
  incomeBand: { ta: 'வருமான வகை', en: 'Income Band' },
  aadhaarLinked: { ta: 'ஆதார் இணைப்பு', en: 'Aadhaar Linked' },
  bankAccountLinked: { ta: 'வங்கி கணக்கு', en: 'Bank Account' },
  landOwnership: { ta: 'நில உரிமை', en: 'Land Ownership' },
  village: { ta: 'கிராமம்', en: 'Village' },
}

function fieldLabel(key: string, lang: 'ta' | 'en') {
  return FIELD_LABELS[key]?.[lang] ?? key
}

// ── Completion Ring ────────────────────────────────────────────────────────────
function CompletionRing({ pct }: { pct: number }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const stroke = circ * (1 - pct / 100)
  const color = pct >= 75 ? '#2D6A4F' : pct >= 50 ? '#E8820C' : '#EF4444'

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circ}
        strokeDashoffset={stroke}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Pillar Badge ───────────────────────────────────────────────────────────────
function PillarBadge({
  pillar,
  missing,
  lang,
}: {
  pillar: keyof typeof PILLAR_REQUIREMENTS
  missing: string[]
  lang: 'ta' | 'en'
}) {
  const label = PILLAR_LABELS[pillar][lang]
  const ready = missing.length === 0

  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2.5 border',
        ready
          ? 'border-green-200 bg-green-50'
          : 'border-orange-200 bg-orange-50',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {ready ? (
          <span className="text-xs font-bold text-green-700">✓ {lang === 'ta' ? 'தயார்' : 'Ready'}</span>
        ) : (
          <span className="text-xs text-orange-600">
            {missing.length} {lang === 'ta' ? 'இல்லை' : 'missing'}
          </span>
        )}
      </div>
      {!ready && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {missing.map((f) => (
            <span
              key={f}
              className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700"
            >
              {fieldLabel(f, lang)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────────
function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'warn' }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2 gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={cn(
        'text-sm font-medium text-right',
        highlight === 'ok' ? 'text-primary-700' : highlight === 'warn' ? 'text-orange-600' : 'text-gray-900',
      )}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">{children}</div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, completionPct, getMissingForPillar, markServerSynced } = useProfileStore()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn())
  const { lang, toggleLang } = useSchemeStore()

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  async function handleSync() {
    if (!isLoggedIn) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      await syncProfileToBackend(profile)
      markServerSynced()
      setSyncMsg(t('சேவையகத்தில் சேமிக்கப்பட்டது ✓', 'Saved to server ✓'))
    } catch {
      setSyncMsg(t('ஒத்திசைவு தோல்வி', 'Sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const IRRIGATION_LABEL: Record<string, Record<'ta' | 'en', string>> = {
    borewell: { ta: 'ஆழ்துளை', en: 'Borewell' },
    canal: { ta: 'கால்வாய்', en: 'Canal' },
    tank: { ta: 'குளம்', en: 'Tank' },
    rainfed: { ta: 'மழை நீர்', en: 'Rain-fed' },
    drip: { ta: 'சொட்டு நீர்', en: 'Drip' },
  }
  const SEASON_LABEL: Record<string, Record<'ta' | 'en', string>> = {
    wet_season: { ta: 'ஆடி/குறுவை', en: 'Wet Season' },
    dry_season: { ta: 'சம்பா/கார்', en: 'Dry Season' },
    summer: { ta: 'கோடை', en: 'Summer' },
  }
  const OWNERSHIP_LABEL: Record<string, Record<'ta' | 'en', string>> = {
    own: { ta: 'சொந்த நிலம்', en: 'Own Land' },
    tenant: { ta: 'குத்தகை விவசாயி', en: 'Tenant Farmer' },
    lease: { ta: 'குத்தகை ஒப்பந்தம்', en: 'Lease Farmer' },
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-primary-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-300 text-xl">←</button>
        <h1 className="flex-1 font-semibold text-sm">{t('என் சுயவிவரம்', 'My Profile')}</h1>
        <button onClick={toggleLang} className="text-xs border border-primary-400 text-primary-100 rounded-full px-3 py-1 bg-primary-800">
          {lang === 'ta' ? 'En' : 'த'}
        </button>
        <Link
          to="/profile/onboarding"
          className="text-xs bg-primary-700 hover:bg-primary-600 rounded-full px-3 py-1.5 font-semibold"
        >
          {t('திருத்து ✏️', 'Edit ✏️')}
        </Link>
      </header>

      <div className="px-4 py-4 pb-28 space-y-4">

        {/* ── Completion hero ─────────────────────────────────────────────── */}
        <div className="card p-4 flex items-center gap-4">
          <div className="relative shrink-0">
            <CompletionRing pct={completionPct} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-extrabold text-gray-800">{completionPct}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">
              {t('சுயவிவர முழுமை', 'Profile Completion')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {completionPct < 50
                ? t('மேலும் தகவல்கள் சேர்க்கவும்', 'Add more information')
                : completionPct < 80
                ? t('நீங்கள் சரியான பாதையில் உள்ளீர்கள்!', "You're on the right track!")
                : t('சுயவிவரம் கிட்டத்தட்ட முழுமையானது', 'Profile is nearly complete')}
            </p>
            {isLoggedIn && (
              <div className="mt-2">
                {profile.serverSyncedAt ? (
                  <p className="text-xs text-green-600">
                    ✓ {t('சர்வரில் சேமிக்கப்பட்டது', 'Saved to server')}
                  </p>
                ) : (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="text-xs text-primary-600 underline disabled:opacity-50"
                  >
                    {syncing ? t('சேமிக்கிறது…', 'Saving…') : t('சர்வரில் சேமி', 'Save to server')}
                  </button>
                )}
                {syncMsg && (
                  <p className={cn('text-xs mt-0.5', syncMsg.includes('✓') ? 'text-green-600' : 'text-red-600')}>
                    {syncMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Per-pillar readiness ─────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
            {t('பிளார் தயார்நிலை', 'Pillar Readiness')}
          </p>
          <div className="space-y-2">
            {(Object.keys(PILLAR_REQUIREMENTS) as (keyof typeof PILLAR_REQUIREMENTS)[]).map((p) => (
              <PillarBadge
                key={p}
                pillar={p}
                missing={getMissingForPillar(p)}
                lang={lang}
              />
            ))}
          </div>
        </div>

        {/* ── Personal ────────────────────────────────────────────────────── */}
        <Section title={t('தனிப்பட்ட தகவல்', 'Personal Info')} icon="👤">
          <Row label={t('பெயர்', 'Name')} value={profile.name} />
          <Row label={t('வயது', 'Age')} value={profile.age} />
          <Row label={t('மொபைல்', 'Mobile')} value={profile.phone} />
          <Row label={t('பாலினம்', 'Gender')} value={profile.gender} />
          <Row label={t('மொழி', 'Language')} value={profile.language === 'ta' ? 'தமிழ்' : 'English'} />
        </Section>

        {/* ── Location ────────────────────────────────────────────────────── */}
        <Section title={t('இடம்', 'Location')} icon="📍">
          <Row label={t('மாவட்டம்', 'District')} value={profile.district} />
          <Row label={t('வட்டம்', 'Taluk')} value={profile.taluk} />
          <Row label={t('கிராமம்', 'Village')} value={profile.village} />
        </Section>

        {/* ── Farm ────────────────────────────────────────────────────────── */}
        <Section title={t('பண்ணை விவரங்கள்', 'Farm Details')} icon="🌾">
          {/* Multi-crop list */}
          {profile.crops.length > 0 ? (
            profile.crops.map((crop, i) => {
              const found = TN_CROPS.find((c) => c.value === crop.name)
              const cropName = found ? (lang === 'ta' ? found.ta : found.en) : crop.name
              return (
                <div key={crop.id} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 shrink-0">
                      {t('பயிர்', 'Crop')} {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {cropName} · {crop.acres} {t('ஏ', 'ac')}
                    </span>
                  </div>
                  {crop.plantingDate && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-400">{t('நடவு தேதி', 'Planted')}</span>
                      <span className="text-xs text-gray-600">{crop.plantingDate}</span>
                    </div>
                  )}
                  {crop.season && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-400">{t('பருவம்', 'Season')}</span>
                      <span className="text-xs text-gray-600">
                        {SEASON_LABEL[crop.season]?.[lang] || crop.season}
                        {crop.irrigationType
                          ? ` · ${IRRIGATION_LABEL[crop.irrigationType]?.[lang] || crop.irrigationType}`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <>
              <Row label={t('முதன்மை பயிர்', 'Primary Crop')} value={profile.primaryCrop} />
              <Row label={t('இரண்டாம் பயிர்', 'Secondary Crop')} value={profile.secondaryCrop} />
              <Row
                label={t('நில அளவு', 'Land Size')}
                value={profile.landSizeAcres ? `${profile.landSizeAcres} ${t('ஏக்கர்', 'acres')}` : ''}
              />
              <Row
                label={t('பருவம்', 'Season')}
                value={profile.season ? SEASON_LABEL[profile.season]?.[lang] || profile.season : ''}
              />
              <Row
                label={t('நீர்பாசனம்', 'Irrigation')}
                value={profile.irrigationType ? IRRIGATION_LABEL[profile.irrigationType]?.[lang] || profile.irrigationType : ''}
              />
            </>
          )}
          <Row
            label={t('நில உரிமை', 'Land Ownership')}
            value={profile.landOwnership ? OWNERSHIP_LABEL[profile.landOwnership]?.[lang] || profile.landOwnership : ''}
          />
          <Row
            label={t('மண் வகை', 'Soil Type')}
            value={profile.soilType}
          />
        </Section>

        {/* ── Eligibility ──────────────────────────────────────────────────── */}
        <Section title={t('தகுதி தகவல்', 'Eligibility Info')} icon="🪪">
          <Row
            label={t('ஆதார் இணைப்பு', 'Aadhaar Linked')}
            value={profile.aadhaarLinked === null ? '' : profile.aadhaarLinked ? t('ஆம் ✓', 'Yes ✓') : t('இல்லை', 'No')}
            highlight={profile.aadhaarLinked === false ? 'warn' : profile.aadhaarLinked ? 'ok' : undefined}
          />
          <Row
            label={t('வங்கி கணக்கு', 'Bank Account')}
            value={profile.bankAccountLinked === null ? '' : profile.bankAccountLinked ? t('ஆம் ✓', 'Yes ✓') : t('இல்லை', 'No')}
            highlight={profile.bankAccountLinked === false ? 'warn' : profile.bankAccountLinked ? 'ok' : undefined}
          />
          <Row label={t('வருமான வகை', 'Income Band')} value={profile.incomeBand} />
        </Section>

        {/* ── Documents ────────────────────────────────────────────────────── */}
        <Section title={t('ஆவணங்கள்', 'Documents')} icon="📄">
          <div className="py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">{t('மண் ஆரோக்கிய அட்டை', 'Soil Health Card')}</span>
            {profile.soilHealthCardUploaded ? (
              <span className="text-xs font-semibold text-green-700">✓ {t('பதிவேற்றப்பட்டது', 'Uploaded')}</span>
            ) : (
              <Link
                to="/profile/onboarding"
                className="text-xs text-primary-600 underline"
              >
                {t('பதிவேற்று', 'Upload')}
              </Link>
            )}
          </div>
        </Section>

        {/* ── Edit CTA ─────────────────────────────────────────────────────── */}
        <Link
          to="/profile/onboarding"
          className="block w-full btn-primary text-center py-3 mt-2"
        >
          {t('சுயவிவரம் திருத்து ✏️', 'Edit Profile ✏️')}
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
