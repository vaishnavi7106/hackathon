import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, ChevronRight, Landmark } from 'lucide-react'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { BottomNav } from '@/components/layout/BottomNav'
import type { EligibleSchemeOut } from '@/types/api'

export default function SavedSchemes() {
  const navigate    = useNavigate()
  const isLoggedIn  = useFarmerStore((s) => s.isLoggedIn)
  const { lang, toggleLang, savedIds, appliedIds } = useSchemeStore()

  const [schemes, setSchemes] = useState<EligibleSchemeOut[]>([])
  const [loading, setLoading] = useState(false)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    load()
  }, [savedIds.length, appliedIds.length])

  async function load() {
    setLoading(true)
    try {
      const res = await schemesApi.list()
      // Show applied schemes + saved schemes
      const relevantIds = [...new Set([...appliedIds, ...savedIds])]
      setSchemes(res.schemes.filter((s) => relevantIds.includes(s.scheme_id)))
    } catch { setSchemes([]) }
    finally { setLoading(false) }
  }

  const appliedSchemes = schemes.filter((s) => appliedIds.includes(s.scheme_id))
  const savedOnly      = schemes.filter((s) => savedIds.includes(s.scheme_id) && !appliedIds.includes(s.scheme_id))
  const hasAny         = appliedSchemes.length > 0 || savedOnly.length > 0

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 90 }}>

      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '14px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'white' }}>{t('எனது திட்டங்கள்', 'My Schemes')}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {appliedSchemes.length} {t('விண்ணப்பித்தது', 'applied')} · {savedOnly.length} {t('நிலுவை', 'pending')}
            </p>
          </div>
          <button
            onClick={toggleLang}
            style={{ fontSize: 11, border: '1px solid rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}
          >
            {lang === 'ta' ? 'En' : 'த'}
          </button>
        </div>
      </header>

      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Empty state */}
        {!loading && !hasAny && (
          <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={24} color="#0A5C47" />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
              {t('திட்டங்கள் இல்லை', 'No schemes yet')}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
              {t('திட்ட விவரத்தில் "விண்ணப்பித்தது என்று குறி" தட்டவும்', 'Open a scheme and tap "Mark as Applied" to track it here')}
            </p>
            <Link
              to="/navigator"
              style={{ marginTop: 4, background: '#0A5C47', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
            >
              {t('திட்டங்கள் பார்க்க', 'Browse Schemes')}
            </Link>
          </div>
        )}

        {/* Applied schemes */}
        {appliedSchemes.length > 0 && (
          <section>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('விண்ணப்பித்த திட்டங்கள்', 'Applied Schemes')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {appliedSchemes.map((s) => (
                <SchemeStatusRow
                  key={s.scheme_id}
                  scheme={s}
                  lang={lang}
                  status="applied"
                  onNavigate={() => navigate(`/navigator/${s.scheme_id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Saved but not applied */}
        {savedOnly.length > 0 && (
          <section>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('விண்ணப்பிக்க காத்திருக்கும் திட்டங்கள்', 'Pending Application')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedOnly.map((s) => (
                <SchemeStatusRow
                  key={s.scheme_id}
                  scheme={s}
                  lang={lang}
                  status="pending"
                  onNavigate={() => navigate(`/navigator/${s.scheme_id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 64, background: 'white', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', opacity: 0.5 }} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// ─── Scheme status row ────────────────────────────────────────────────────────

function SchemeStatusRow({
  scheme, lang, status, onNavigate,
}: {
  scheme: EligibleSchemeOut
  lang: 'ta' | 'en'
  status: 'applied' | 'pending'
  onNavigate: () => void
}) {
  const name    = lang === 'ta' ? scheme.name_ta : (scheme.name_en || scheme.name_ta)
  const benefit = lang === 'ta' ? (scheme.benefit_amount_ta ?? scheme.benefit_amount) : scheme.benefit_amount

  return (
    <div
      onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'white', borderRadius: 14, padding: '13px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer',
        borderLeft: `3px solid ${status === 'applied' ? '#0A5C47' : '#FCD34D'}`,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 22, flexShrink: 0,
        background: status === 'applied' ? '#DCFCE7' : '#FEF3C7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {status === 'applied'
          ? <CheckCircle2 size={20} color="#0A5C47" />
          : <Clock size={20} color="#D97706" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B', lineHeight: 1.3 }}>{name}</p>
        {benefit && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {benefit}
          </p>
        )}
        <span style={{
          display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700,
          color: status === 'applied' ? '#0A5C47' : '#D97706',
          background: status === 'applied' ? '#DCFCE7' : '#FEF3C7',
          padding: '2px 8px', borderRadius: 5,
        }}>
          {status === 'applied'
            ? (lang === 'ta' ? 'விண்ணப்பிக்கப்பட்டது' : 'Applied')
            : (lang === 'ta' ? 'விண்ணப்பம் நிலுவை' : 'Pending Application')}
        </span>
      </div>
      <ChevronRight size={16} color="#CBD5E1" />
    </div>
  )
}
