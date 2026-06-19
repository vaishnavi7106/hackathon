import { useNavigate, Link } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { ProfileCompletionWidget } from '@/components/profile/ProfileCompletionWidget'
import { BottomNav } from '@/components/layout/BottomNav'
import { TN_CROPS, INCOME_BANDS } from '@/data/tn-options'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, completionPct } = useProfileStore()
  const { lang, toggleLang } = useSchemeStore()

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  function cropLabel(value: string) {
    const crop = TN_CROPS.find((c) => c.value === value)
    if (!crop) return value
    return lang === 'ta' ? crop.ta : crop.en
  }

  function incomeLabel(value: string) {
    const band = INCOME_BANDS.find((b) => b.value === value)
    if (!band) return value
    return lang === 'ta' ? band.ta : band.en
  }

  const landOwnershipLabel: Record<string, Record<'ta' | 'en', string>> = {
    own: { ta: 'சொந்த நிலம்', en: 'Own Land' },
    tenant: { ta: 'குத்தகை விவசாயி', en: 'Tenant Farmer' },
    lease: { ta: 'குத்தகை ஒப்பந்தம்', en: 'Lease Farmer' },
  }

  const irrigationLabel: Record<string, Record<'ta' | 'en', string>> = {
    rain_fed: { ta: 'மழை நீர்', en: 'Rain-fed' },
    irrigated: { ta: 'பாசன நீர்', en: 'Irrigated' },
    mixed: { ta: 'கலப்பு', en: 'Mixed' },
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
          {t('திருத்து', 'Edit')}
        </Link>
      </header>

      <div className="px-4 py-4 pb-28 space-y-4">
        {/* Completion widget */}
        <ProfileCompletionWidget pct={completionPct} lang={lang} />

        {/* Personal */}
        <ProfileSection title={t('தனிப்பட்ட தகவல்', 'Personal Info')} icon="👤">
          <Row label={t('பெயர்', 'Name')} value={profile.name} />
          <Row label={t('வயது', 'Age')} value={profile.age} />
          <Row label={t('மொபைல்', 'Mobile')} value={profile.phone} />
          <Row label={t('மொழி', 'Language')} value={profile.language === 'ta' ? 'தமிழ்' : 'English'} />
        </ProfileSection>

        {/* Location */}
        <ProfileSection title={t('இடம்', 'Location')} icon="📍">
          <Row label={t('மாவட்டம்', 'District')} value={profile.district} />
          <Row label={t('வட்டம்', 'Taluk')} value={profile.taluk} />
          <Row label={t('கிராமம்', 'Village')} value={profile.village} />
        </ProfileSection>

        {/* Farm */}
        <ProfileSection title={t('பண்ணை விவரங்கள்', 'Farm Details')} icon="🌾">
          <Row label={t('முதன்மை பயிர்', 'Primary Crop')} value={cropLabel(profile.primaryCrop)} />
          <Row label={t('இரண்டாம் பயிர்', 'Secondary Crop')} value={cropLabel(profile.secondaryCrop)} />
          <Row label={t('நில அளவு', 'Land Size')} value={profile.landSizeAcres ? `${profile.landSizeAcres} ${t('ஏக்கர்', 'acres')}` : ''} />
          <Row
            label={t('நில உரிமை', 'Land Ownership')}
            value={profile.landOwnership ? landOwnershipLabel[profile.landOwnership]?.[lang] || profile.landOwnership : ''}
          />
          <Row
            label={t('நீர்பாசனம்', 'Irrigation')}
            value={profile.irrigationType ? irrigationLabel[profile.irrigationType]?.[lang] || profile.irrigationType : ''}
          />
        </ProfileSection>

        {/* Eligibility */}
        <ProfileSection title={t('தகுதி தகவல்', 'Eligibility Info')} icon="🪪">
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
          <Row
            label={t('வருமான வகை', 'Income Band')}
            value={incomeLabel(profile.incomeBand)}
          />
        </ProfileSection>

        {/* Optional */}
        {(profile.soilType || profile.waterSource || profile.livestockType) && (
          <ProfileSection title={t('மேலும் தகவல்கள்', 'Additional Info')} icon="🔬">
            <Row label={t('மண் வகை', 'Soil Type')} value={profile.soilType} />
            <Row label={t('நீர் ஆதாரம்', 'Water Source')} value={profile.waterSource} />
            <Row label={t('கால்நடை', 'Livestock')} value={profile.livestockType} />
          </ProfileSection>
        )}

        {/* CTA to edit */}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">
        {children}
      </div>
    </div>
  )
}

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
