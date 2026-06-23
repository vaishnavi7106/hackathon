import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CreditCard, Shield, Sprout, Landmark, CheckCircle2,
  Clock, ChevronRight, Leaf, Tractor, ArrowRight,
} from 'lucide-react'
import { schemesApi } from '@/api/schemes'
import { syncProfileToBackend } from '@/api/farmer'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { useProfileStore } from '@/store/profileStore'
import { BottomNav } from '@/components/layout/BottomNav'
import type { EligibleSchemeOut } from '@/types/api'

// ─── Icon mapping ──────────────────────────────────────────────────────────────

function schemeIconProps(name: string): { Icon: React.FC<{ size?: number; color?: string }>; bg: string; color: string } {
  const n = (name ?? '').toLowerCase()
  if (n.includes('credit') || n.includes('kcc') || n.includes('loan'))
    return { Icon: CreditCard, bg: '#EFF8FF', color: '#2563EB' }
  if (n.includes('insurance') || n.includes('fasal') || n.includes('bima'))
    return { Icon: Shield, bg: '#F5F3FF', color: '#6366F1' }
  if (n.includes('kisan') || n.includes('pm-') || n.includes('samman'))
    return { Icon: Sprout, bg: '#F0FDF4', color: '#16A34A' }
  if (n.includes('soil') || n.includes('fertilizer') || n.includes('nutrition') || n.includes('organic'))
    return { Icon: Leaf, bg: '#FEF3C7', color: '#D97706' }
  if (n.includes('equipment') || n.includes('machinery') || n.includes('tractor') || n.includes('mechaniz'))
    return { Icon: Tractor, bg: '#FCE7F3', color: '#DB2777' }
  return { Icon: Landmark, bg: '#F1F5F9', color: '#475569' }
}

// ─── Compact scheme card ───────────────────────────────────────────────────────

function SchemeRow({
  scheme,
  lang,
  isApplied,
  onNavigate,
}: {
  scheme: EligibleSchemeOut
  lang: 'ta' | 'en'
  isApplied: boolean
  onNavigate: () => void
}) {
  const { Icon, bg, color } = schemeIconProps(scheme.name_en ?? scheme.name_ta)
  const name    = lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)
  const benefit = lang === 'ta'
    ? (scheme.benefit_amount_ta ?? scheme.benefit_amount ?? '')
    : (scheme.benefit_amount ?? '')

  return (
    <div
      onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'white', borderRadius: 14, padding: '13px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 22, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>{name}</p>
        {benefit && (
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {benefit}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isApplied && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#0A5C47', background: '#DCFCE7', padding: '2px 8px', borderRadius: 5 }}>
            {lang === 'ta' ? 'விண்ணப்பித்தது' : 'Applied'}
          </span>
        )}
        <ChevronRight size={16} color="#CBD5E1" />
      </div>
    </div>
  )
}

// ─── Applied scheme row ────────────────────────────────────────────────────────

function AppliedRow({
  scheme,
  lang,
  onNavigate,
}: {
  scheme: EligibleSchemeOut
  lang: 'ta' | 'en'
  onNavigate: () => void
}) {
  const { Icon, bg, color } = schemeIconProps(scheme.name_en ?? scheme.name_ta)
  const name = lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)

  return (
    <div
      onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'white', borderRadius: 14, padding: '13px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 22, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>{name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <CheckCircle2 size={12} color="#0A5C47" />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0A5C47' }}>
            {lang === 'ta' ? 'விண்ணப்பிக்கப்பட்டது' : 'Applied'}
          </span>
        </div>
      </div>
      <ChevronRight size={16} color="#CBD5E1" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NavigatorHome() {
  const navigate    = useNavigate()
  const isLoggedIn  = useFarmerStore((s) => s.isLoggedIn)
  const clearAuth   = useFarmerStore((s) => s.clearAuth)
  const profile     = useFarmerStore((s) => s.profile)
  const { lang, toggleLang, savedIds, appliedIds } = useSchemeStore()
  const localProfile = useProfileStore((s) => s.profile)
  const resetProfile = useProfileStore((s) => s.resetProfile)

  const [allSchemes, setAllSchemes]         = useState<EligibleSchemeOut[]>([])
  const [eligibleSchemes, setEligibleSchemes] = useState<EligibleSchemeOut[]>([])
  const [nmiSchemes, setNmiSchemes]         = useState<EligibleSchemeOut[]>([])
  const [loading, setLoading]               = useState(true)
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [showAll, setShowAll]               = useState(false)
  const [showExplore, setShowExplore]       = useState(false)
  const [search, setSearch]                 = useState('')

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    loadAll()
    if (profile) loadEligible()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const res = await schemesApi.list()
      setAllSchemes(res.schemes)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  async function loadEligible() {
    setEligibleLoading(true)
    try {
      try { await syncProfileToBackend(localProfile) } catch { /* best-effort */ }
      const res = await schemesApi.eligible()
      setEligibleSchemes(res.schemes)
      setNmiSchemes(res.needs_more_info_schemes ?? [])
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 401) { resetProfile(); clearAuth(); navigate('/login', { replace: true }) }
    } finally { setEligibleLoading(false) }
  }

  const appliedSchemes  = allSchemes.filter((s) => appliedIds.includes(s.scheme_id))
  const pendingCount    = savedIds.filter((id) => !appliedIds.includes(id)).length
  const topEligible     = eligibleSchemes.slice(0, showAll ? eligibleSchemes.length : 4)
  const primaryCrop     = profile?.crops?.[0]?.crop ?? localProfile.crops[0]?.name ?? ''

  const filteredExplore = allSchemes.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.name_ta?.includes(q) || (s.name_en ?? '').toLowerCase().includes(q))
  })

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '16px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>
              {t('அரசு நலன்கள்', 'Government Benefits')}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {t('உங்கள் பண்ணைக்கான நலன்கள்', 'Benefits available for your farm profile')}
            </p>
          </div>
          <button
            onClick={toggleLang}
            style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}
          >
            {lang === 'ta' ? 'En' : 'த'}
          </button>
        </div>

      </header>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>

        {/* ── SUMMARY STATS ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatCard
            value={eligibleLoading ? '…' : String(eligibleSchemes.length)}
            label={t('தகுதி', 'Eligible')}
            bg="#F0FDF4" color="#0A5C47"
            Icon={CheckCircle2}
          />
          <StatCard
            value={String(appliedIds.length)}
            label={t('விண்ணப்பம்', 'Applied')}
            bg="#EFF8FF" color="#2563EB"
            Icon={CheckCircle2}
          />
          <StatCard
            value={String(nmiSchemes.length)}
            label={t('தகவல் வேண்டும்', 'Need Info')}
            bg="#FFFBF0" color="#D97706"
            Icon={Clock}
          />
        </div>

        {/* ── NO PROFILE NUDGE ───────────────────────────────────────────────── */}
        {!profile && (
          <Link to="/navigator/eligible" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', borderRadius: 16, padding: '18px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px dashed #A7F3D0' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                {t('தகுதியான திட்டங்கள் கண்டுபிடிக்கவும்', 'Find schemes you qualify for')}
              </p>
              <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#64748B' }}>
                {t('சில கேள்விகளுக்கு பதிலளிக்கவும்', 'Answer a few questions to see personalised schemes')}
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0A5C47', color: 'white', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
                {t('தகுதி சரிபார்க்க', 'Check My Eligibility')} <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        )}

        {/* ── RECOMMENDED FOR YOU ─────────────────────────────────────────────── */}
        {(eligibleLoading || eligibleSchemes.length > 0) && (
          <section>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('உங்களுக்கு பரிந்துரை', 'Recommended For You')}
            </p>

            {eligibleLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 64, background: 'white', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topEligible.map((scheme) => (
                  <SchemeRow
                    key={scheme.scheme_id}
                    scheme={scheme}
                    lang={lang}
                    isApplied={appliedIds.includes(scheme.scheme_id)}
                    onNavigate={() => navigate(`/navigator/${scheme.scheme_id}`)}
                  />
                ))}

                {eligibleSchemes.length > 4 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    style={{ width: '100%', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, padding: '10px', fontSize: 13, fontWeight: 700, color: '#0A5C47', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {t(`மேலும் ${eligibleSchemes.length - 4} திட்டங்கள் காண`, `Show ${eligibleSchemes.length - 4} more`)} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Needs more info nudge */}
        {nmiSchemes.length > 0 && (
          <Link to="/navigator/eligible" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#FFFBF0', borderRadius: 14, padding: '12px 16px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={20} color="#D97706" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                  {t(`${nmiSchemes.length} திட்டங்களுக்கு தகவல் தேவை`, `${nmiSchemes.length} schemes need more info`)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#92400E' }}>
                  {t('சுயவிவரம் பூர்த்தி செய்யவும்', 'Complete your profile to check eligibility')}
                </p>
              </div>
              <ChevronRight size={16} color="#FCD34D" />
            </div>
          </Link>
        )}

        {/* ── APPLIED SCHEMES ─────────────────────────────────────────────────── */}
        {appliedSchemes.length > 0 && (
          <section>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('விண்ணப்பித்த திட்டங்கள்', 'Applied Schemes')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {appliedSchemes.map((scheme) => (
                <AppliedRow
                  key={scheme.scheme_id}
                  scheme={scheme}
                  lang={lang}
                  onNavigate={() => navigate(`/navigator/${scheme.scheme_id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── EXPLORE ALL ─────────────────────────────────────────────────────── */}
        <section>
          <button
            onClick={() => setShowExplore(!showExplore)}
            style={{ width: '100%', background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '13px 16px', fontSize: 14, fontWeight: 700, color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <span>{t('அனைத்து திட்டங்களும்', 'View All Schemes')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 12 }}>
              <span>{allSchemes.length}</span>
              <ChevronRight size={16} style={{ transform: showExplore ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
          </button>

          {showExplore && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="search"
                placeholder={t('திட்டங்களை தேடுங்கள்…', 'Search schemes…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', borderRadius: 12, border: '1px solid #E2E8F0', padding: '10px 14px', fontSize: 13, background: 'white', outline: 'none', boxSizing: 'border-box' }}
              />
              {loading && (
                <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', padding: '12px 0' }}>
                  {t('ஏற்றுகிறது…', 'Loading…')}
                </p>
              )}
              {filteredExplore.map((scheme) => (
                <SchemeRow
                  key={scheme.scheme_id}
                  scheme={scheme}
                  lang={lang}
                  isApplied={appliedIds.includes(scheme.scheme_id)}
                  onNavigate={() => navigate(`/navigator/${scheme.scheme_id}`)}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      <BottomNav />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value, label, bg, color, Icon,
}: {
  value: string; label: string; bg: string; color: string
  Icon: React.FC<{ size?: number; color?: string }>
}) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</span>
        <Icon size={16} color={color} />
      </div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color, opacity: 0.75 }}>{label}</p>
    </div>
  )
}
