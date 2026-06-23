import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Pencil, RefreshCw } from 'lucide-react'
import { useProfileStore } from '@/store/profileStore'
import { useFarmerStore } from '@/store/farmerStore'
import { syncProfileToBackend } from '@/api/farmer'
import { TN_CROPS } from '@/data/tn-options'
import { BottomNav } from '@/components/layout/BottomNav'

const FIELD_LABELS: Record<string, { ta: string; en: string }> = {
  name:            { ta: 'பெயர்',          en: 'Name' },
  district:        { ta: 'மாவட்டம்',       en: 'District' },
  primaryCrop:     { ta: 'முதன்மை பயிர்', en: 'Primary Crop' },
  landSizeAcres:   { ta: 'நில அளவு',      en: 'Land Size' },
  irrigationType:  { ta: 'நீர்பாசன முறை', en: 'Irrigation' },
  season:          { ta: 'பருவம்',          en: 'Season' },
  age:             { ta: 'வயது',            en: 'Age' },
  incomeBand:      { ta: 'வருமான வகை',     en: 'Income Band' },
  aadhaarLinked:   { ta: 'ஆதார் இணைப்பு', en: 'Aadhaar Linked' },
  bankAccountLinked:{ ta: 'வங்கி கணக்கு', en: 'Bank Account' },
  landOwnership:   { ta: 'நில உரிமை',      en: 'Land Ownership' },
  village:         { ta: 'கிராமம்',         en: 'Village' },
}

const IRRIGATION_LABEL: Record<string, Record<'ta' | 'en', string>> = {
  borewell: { ta: 'ஆழ்துளை', en: 'Borewell' },
  canal:    { ta: 'கால்வாய்', en: 'Canal' },
  tank:     { ta: 'குளம்',   en: 'Tank' },
  rainfed:  { ta: 'மழை நீர்', en: 'Rain-fed' },
  drip:     { ta: 'சொட்டு நீர்', en: 'Drip' },
}
const SEASON_LABEL: Record<string, Record<'ta' | 'en', string>> = {
  wet_season: { ta: 'ஆடி/குறுவை', en: 'Wet Season' },
  dry_season: { ta: 'சம்பா/கார்', en: 'Dry Season' },
  summer:     { ta: 'கோடை',      en: 'Summer' },
}
const OWNERSHIP_LABEL: Record<string, Record<'ta' | 'en', string>> = {
  own:    { ta: 'சொந்த நிலம்',          en: 'Own Land' },
  tenant: { ta: 'குத்தகை விவசாயி',    en: 'Tenant Farmer' },
  lease:  { ta: 'குத்தகை ஒப்பந்தம்', en: 'Lease Farmer' },
}

// ── Info row ───────────────────────────────────────────────────────────────────
function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'warn' }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2.5 gap-2 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
      <span className="text-xs" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{
        color: highlight === 'ok' ? '#0A5C47' : highlight === 'warn' ? '#92400E' : '#111827'
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: '#D1D5DB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="px-4 py-2.5 border-b" style={{ borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, completionPct, markServerSynced } = useProfileStore()
  const isLoggedIn = useFarmerStore((s) => s.isLoggedIn())

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const lang: 'ta' | 'en' = 'ta'
  const t = (ta: string, _en: string) => ta

  async function handleSync() {
    if (!isLoggedIn) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      await syncProfileToBackend(profile)
      markServerSynced()
      setSyncMsg(t('சர்வரில் சேமிக்கப்பட்டது', 'Saved to server'))
    } catch {
      setSyncMsg(t('ஒத்திசைவு தோல்வி', 'Sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const progressColor = completionPct >= 75 ? '#0A5C47' : completionPct >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#F9FAFB', maxWidth: 480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: '#D1D5DB' }}>
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 rounded-lg"
          style={{ color: '#6B7280' }}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 font-semibold text-sm" style={{ color: '#0A5C47' }}>
          {t('என் சுயவிவரம்', 'My Profile')}
        </h1>
        <Link
          to="/profile/onboarding"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: '#0A5C47' }}
        >
          <Pencil size={12} /> {t('திருத்து', 'Edit')}
        </Link>
      </header>

      <div className="px-4 py-4 pb-28 space-y-4">

        {/* ── Progress bar summary ──────────────────────────────────────────── */}
        <div className="rounded-xl bg-white border p-4" style={{ borderColor: '#D1D5DB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: '#111827' }}>
              {t('சுயவிவர முழுமை', 'Profile Completion')}
            </p>
            <span className="text-sm font-bold" style={{ color: progressColor }}>{completionPct}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full rounded-full h-2" style={{ backgroundColor: '#E5E7EB' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%`, backgroundColor: progressColor }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
            {completionPct < 50
              ? t('மேலும் தகவல்கள் சேர்க்கவும்', 'Add more information')
              : completionPct < 80
              ? t('நீங்கள் சரியான பாதையில் உள்ளீர்கள்!', "You're on the right track!")
              : t('சுயவிவரம் கிட்டத்தட்ட முழுமையானது', 'Profile is nearly complete')}
          </p>
          {isLoggedIn && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
              {profile.serverSyncedAt ? (
                <p className="text-xs flex items-center gap-1" style={{ color: '#0A5C47' }}>
                  <CheckCircle2 size={12} />
                  {t('சர்வரில் சேமிக்கப்பட்டது', 'Saved to server')}
                </p>
              ) : (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                  style={{ color: '#0A5C47' }}
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? t('சேமிக்கிறது…', 'Saving…') : t('சர்வரில் சேமி', 'Save to server')}
                </button>
              )}
              {syncMsg && (
                <p className="text-xs mt-0.5" style={{ color: syncMsg.includes('தோல்வி') || syncMsg.includes('failed') ? '#991B1B' : '#0A5C47' }}>
                  {syncMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Personal ──────────────────────────────────────────────────────── */}
        <Section title={t('தனிப்பட்ட தகவல்', 'Personal Info')}>
          <Row label={t('பெயர்', 'Name')}     value={profile.name} />
          <Row label={t('வயது', 'Age')}        value={profile.age} />
          <Row label={t('மொபைல்', 'Mobile')}   value={profile.phone} />
          <Row label={t('பாலினம்', 'Gender')}  value={profile.gender} />
          <Row label={t('மொழி', 'Language')}   value={profile.language === 'ta' ? 'தமிழ்' : 'English'} />
        </Section>

        {/* ── Location ──────────────────────────────────────────────────────── */}
        <Section title={t('இடம்', 'Location')}>
          <Row label={t('மாவட்டம்', 'District')} value={profile.district} />
          <Row label={t('வட்டம்', 'Taluk')}       value={profile.taluk} />
          <Row label={t('கிராமம்', 'Village')}    value={profile.village} />
        </Section>

        {/* ── Farm ──────────────────────────────────────────────────────────── */}
        <Section title={t('பண்ணை விவரங்கள்', 'Farm Details')}>
          {profile.crops.length > 0 ? (
            profile.crops.map((crop, i) => {
              const found = TN_CROPS.find((c) => c.value === crop.name)
              const cropName = found ? (lang === 'ta' ? found.ta : found.en) : crop.name
              return (
                <div key={crop.id} className="py-2.5 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#6B7280' }}>{t('பயிர்', 'Crop')} {i + 1}</span>
                    <span className="text-sm font-medium" style={{ color: '#111827' }}>
                      {cropName} · {crop.acres} {t('ஏ', 'ac')}
                    </span>
                  </div>
                  {crop.plantingDate && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{t('நடவு தேதி', 'Planted')}</span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>{crop.plantingDate}</span>
                    </div>
                  )}
                  {crop.season && (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{t('பருவம்', 'Season')}</span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {SEASON_LABEL[crop.season]?.[lang] || crop.season}
                        {crop.irrigationType ? ` · ${IRRIGATION_LABEL[crop.irrigationType]?.[lang] || crop.irrigationType}` : ''}
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
              <Row label={t('நில அளவு', 'Land Size')} value={profile.landSizeAcres ? `${profile.landSizeAcres} ${t('ஏக்கர்', 'acres')}` : ''} />
              <Row label={t('பருவம்', 'Season')} value={profile.season ? SEASON_LABEL[profile.season]?.[lang] || profile.season : ''} />
              <Row label={t('நீர்பாசனம்', 'Irrigation')} value={profile.irrigationType ? IRRIGATION_LABEL[profile.irrigationType]?.[lang] || profile.irrigationType : ''} />
            </>
          )}
          <Row label={t('நில உரிமை', 'Land Ownership')} value={profile.landOwnership ? OWNERSHIP_LABEL[profile.landOwnership]?.[lang] || profile.landOwnership : ''} />
          <Row label={t('மண் வகை', 'Soil Type')} value={profile.soilType} />
        </Section>

        {/* ── Eligibility ───────────────────────────────────────────────────── */}
        <Section title={t('தகுதி தகவல்', 'Eligibility Info')}>
          <Row
            label={t('ஆதார் இணைப்பு', 'Aadhaar Linked')}
            value={profile.aadhaarLinked === null ? '' : profile.aadhaarLinked ? t('ஆம்', 'Yes') : t('இல்லை', 'No')}
            highlight={profile.aadhaarLinked === false ? 'warn' : profile.aadhaarLinked ? 'ok' : undefined}
          />
          <Row
            label={t('வங்கி கணக்கு', 'Bank Account')}
            value={profile.bankAccountLinked === null ? '' : profile.bankAccountLinked ? t('ஆம்', 'Yes') : t('இல்லை', 'No')}
            highlight={profile.bankAccountLinked === false ? 'warn' : profile.bankAccountLinked ? 'ok' : undefined}
          />
          <Row label={t('வருமான வகை', 'Income Band')} value={profile.incomeBand} />
        </Section>

        {/* ── Documents ─────────────────────────────────────────────────────── */}
        <Section title={t('ஆவணங்கள்', 'Documents')}>
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-xs" style={{ color: '#6B7280' }}>{t('மண் ஆரோக்கிய அட்டை', 'Soil Health Card')}</span>
            {profile.soilHealthCardUploaded ? (
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#0A5C47' }}>
                <CheckCircle2 size={12} /> {t('பதிவேற்றப்பட்டது', 'Uploaded')}
              </span>
            ) : (
              <Link to="/profile/onboarding" className="text-xs font-medium underline" style={{ color: '#0A5C47' }}>
                {t('பதிவேற்று', 'Upload')}
              </Link>
            )}
          </div>
        </Section>

        {/* ── Edit CTA ──────────────────────────────────────────────────────── */}
        <Link
          to="/profile/onboarding"
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white"
          style={{ backgroundColor: '#0A5C47', minHeight: 48 }}
        >
          <Pencil size={16} />
          {t('சுயவிவரம் திருத்து', 'Edit Profile')}
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
