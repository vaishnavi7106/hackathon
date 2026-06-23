import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Globe, Building2, Calendar } from 'lucide-react'
import { schemesApi } from '@/api/schemes'
import { useFarmerStore } from '@/store/farmerStore'
import { useSchemeStore } from '@/store/schemeStore'
import { ChatFAB } from '@/components/chat/ChatFAB'
import { BottomNav } from '@/components/layout/BottomNav'
import type { GovernmentSchemeOut, EligibilityResultOut } from '@/types/api'

export default function SchemeDetail() {
  const { schemeId } = useParams<{ schemeId: string }>()
  const navigate     = useNavigate()
  const isLoggedIn   = useFarmerStore((s) => s.isLoggedIn)
  const { lang, toggleLang, isApplied, markApplied, toggleDoc, isDocChecked, getCheckedDocs } = useSchemeStore()

  const [detail, setDetail]           = useState<GovernmentSchemeOut | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<EligibilityResultOut | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)

  const t = (ta: string, en: string) => lang === 'ta' ? ta : en

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login', { replace: true }); return }
    if (!schemeId) return
    load()
  }, [schemeId])

  async function load() {
    setLoading(true); setError(null)
    try { setDetail(await schemesApi.getById(schemeId!)) }
    catch { setError(t('திட்ட விவரங்கள் ஏற்றுவதில் பிழை.', 'Failed to load scheme details.')) }
    finally { setLoading(false) }
  }

  async function runCheck() {
    if (!schemeId) return
    setCheckLoading(true)
    try { setCheckResult(await schemesApi.check(schemeId, lang)) }
    catch { setCheckResult(null) }
    finally { setCheckLoading(false) }
  }

  const applied     = schemeId ? isApplied(schemeId) : false
  const docs        = detail
    ? (lang === 'ta' ? detail.documents_ta || detail.documents_required : detail.documents_required) || []
    : []
  const checkedDocs = schemeId ? getCheckedDocs(schemeId) : []
  const docsChecked = docs.filter((d) => checkedDocs.includes(d)).length

  const name    = detail ? (lang === 'ta' ? detail.name_ta : (detail.name_en || detail.name_ta)) : ''
  const benefit = detail
    ? (lang === 'ta' ? (detail.benefit_amount_ta ?? detail.benefit_amount) : detail.benefit_amount)
    : ''

  return (
    <div style={{ backgroundColor: '#F5F6F5', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <p style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || t('திட்ட விவரங்கள்', 'Scheme Details')}
          </p>
          <button
            onClick={toggleLang}
            style={{ fontSize: 11, border: '1px solid rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.15)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}
          >
            {lang === 'ta' ? 'En' : 'த'}
          </button>
        </div>

        {/* Level chip + Applied banner inside header */}
        {detail && (
          <div style={{ paddingBottom: 16 }}>
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: detail.level === 'central' ? 'rgba(199,210,254,0.3)' : 'rgba(167,243,208,0.3)',
              color: detail.level === 'central' ? '#C7D2FE' : '#A7F3D0',
              border: `1px solid ${detail.level === 'central' ? 'rgba(199,210,254,0.4)' : 'rgba(167,243,208,0.4)'}`,
            }}>
              {detail.level === 'central' ? t('மத்திய திட்டம்', 'Central Scheme') : t('மாநில திட்டம்', 'State Scheme')}
            </span>
            {applied && (
              <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} color="#A7F3D0" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A7F3D0' }}>
                  {t('நீங்கள் விண்ணப்பித்துள்ளீர்கள்', 'You have applied')}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── LOADING / ERROR ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[80, 120, 100, 90].map((h, i) => (
            <div key={i} style={{ height: h, background: 'white', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', opacity: 0.6 }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '24px 16px' }}>
          <div style={{ background: '#FEF2F2', borderRadius: 14, padding: '16px', border: '1px solid #FECACA', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#B91C1C' }}>{error}</p>
            <button onClick={load} style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#0A5C47', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              {t('மீண்டும் முயற்சி', 'Try again')}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && detail && (
        <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── What this gives you ──────────────────────────────────────────── */}
          {benefit && (
            <div style={{ background: '#FFFBF0', borderRadius: 16, padding: '16px', border: '1px solid #FDE68A' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('இந்த திட்டம் தரும் நலன்', 'What this scheme gives you')}
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#78350F', lineHeight: 1.35 }}>{benefit}</p>
            </div>
          )}

          {/* ── Why you qualify ──────────────────────────────────────────────── */}
          {(detail.eligibility_ta || detail.eligibility_en) && (
            <InfoCard
              title={t('நீங்கள் ஏன் தகுதியுடையவர்', 'Why you qualify')}
              body={lang === 'ta' ? detail.eligibility_ta ?? '' : (detail.eligibility_en || detail.eligibility_ta) ?? ''}
              bg="#F0FDF4" labelColor="#0A5C47" bodyColor="#14532D"
              borderColor="#A7F3D0"
            />
          )}

          {/* ── Description ───────────────────────────────────────────────────── */}
          {(detail.description_ta || detail.description_en) && (
            <InfoCard
              title={t('விளக்கம்', 'About this scheme')}
              body={lang === 'ta' ? detail.description_ta ?? '' : (detail.description_en || detail.description_ta) ?? ''}
              bg="#EFF8FF" labelColor="#1D4ED8" bodyColor="#1E3A5F"
              borderColor="#BFDBFE"
            />
          )}

          {/* ── Eligibility check ─────────────────────────────────────────────── */}
          <div style={{ background: '#F5F3FF', borderRadius: 16, padding: '16px', border: '1px solid #DDD6FE' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('தகுதி சரிபார்ப்பு', 'Eligibility Check')}
            </p>
            {!checkResult ? (
              <button
                onClick={runCheck}
                disabled={checkLoading}
                style={{ width: '100%', background: '#0A5C47', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: checkLoading ? 'not-allowed' : 'pointer', opacity: checkLoading ? 0.7 : 1 }}
              >
                {checkLoading ? t('சரிபார்க்கிறது…', 'Checking…') : t('இப்போது சரிபார்', 'Check My Eligibility')}
              </button>
            ) : (
              <div>
                <div style={{
                  background: checkResult.is_eligible ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${checkResult.is_eligible ? '#A7F3D0' : '#FECACA'}`,
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: checkResult.llm_response ? 8 : 0 }}>
                    <CheckCircle2 size={16} color={checkResult.is_eligible ? '#0A5C47' : '#DC2626'} />
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: checkResult.is_eligible ? '#0A5C47' : '#DC2626' }}>
                      {checkResult.is_eligible ? t('நீங்கள் தகுதியுடையவர்!', 'You are eligible!') : t('தகுதியில்லை', 'Not eligible')}
                    </p>
                  </div>
                  {checkResult.llm_response && (
                    <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{checkResult.llm_response}</p>
                  )}
                </div>
                <button onClick={() => setCheckResult(null)} style={{ marginTop: 8, fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {t('மீண்டும் சரிபார்', 'Check again')}
                </button>
              </div>
            )}
          </div>

          {/* ── Required Documents ────────────────────────────────────────────── */}
          {docs.length > 0 && (
            <div style={{ background: '#FFFBF0', borderRadius: 16, padding: '16px', border: '1px solid #FDE68A' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="#D97706" />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('தேவையான ஆவணங்கள்', 'Required Documents')}
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: docsChecked === docs.length ? '#0A5C47' : '#D97706' }}>
                  {docsChecked}/{docs.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map((doc) => {
                  const checked = isDocChecked(detail.scheme_id, doc)
                  return (
                    <button
                      key={doc}
                      onClick={() => toggleDoc(detail.scheme_id, doc)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: checked ? '#F0FDF4' : '#F8FAFC',
                        border: `1px solid ${checked ? '#A7F3D0' : '#E2E8F0'}`,
                        borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: checked ? '#0A5C47' : 'transparent',
                        border: `2px solid ${checked ? '#0A5C47' : '#CBD5E1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <CheckCircle2 size={12} color="white" />}
                      </div>
                      <span style={{ fontSize: 13, color: checked ? '#0A5C47' : '#374151', fontWeight: checked ? 600 : 400 }}>{doc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── How to Apply ──────────────────────────────────────────────────── */}
          {(detail.application_mode || detail.application_portal_name || detail.application_process_summary) && (
            <div style={{ background: 'white', borderRadius: 16, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('விண்ணப்பிக்கும் முறை', 'How to Apply')}
              </p>
              {detail.application_mode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {detail.application_mode === 'HYBRID' ? <Globe size={15} color="#0A5C47" /> : <Building2 size={15} color="#475569" />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: detail.application_mode === 'HYBRID' ? '#0A5C47' : '#475569' }}>
                    {detail.application_mode === 'HYBRID'
                      ? t('ஆன்லைன் அல்லது நேரில்', 'Online or In-person')
                      : t('நேரில் மட்டும்', 'In-person only')}
                  </span>
                </div>
              )}
              {detail.application_portal_name && (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748B' }}>
                  <span style={{ fontWeight: 600 }}>{t('போர்டல்: ', 'Portal: ')}</span>{detail.application_portal_name}
                </p>
              )}
              {detail.application_process_summary && (
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{detail.application_process_summary}</p>
              )}
            </div>
          )}

          {/* ── Deadline ──────────────────────────────────────────────────────── */}
          {detail.application_deadline && (
            <div style={{
              background: detail.deadline_urgent ? '#FFF7ED' : 'white',
              border: `1px solid ${detail.deadline_urgent ? '#FED7AA' : '#E2E8F0'}`,
              borderRadius: 14, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: detail.deadline_urgent ? '#FEF3C7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={20} color={detail.deadline_urgent ? '#EA580C' : '#94A3B8'} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('கடைசி தேதி', 'Application Deadline')}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: detail.deadline_urgent ? '#C2410C' : '#1E293B' }}>
                  {detail.application_deadline}
                </p>
              </div>
            </div>
          )}

          {/* Source */}
          {detail.source_url && (
            <p style={{ fontSize: 11, color: '#CBD5E1', textAlign: 'center' }}>
              {t('ஆதாரம்: ', 'Source: ')}
              <a href={detail.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#94A3B8' }}>
                {detail.source_url}
              </a>
            </p>
          )}
        </div>
      )}

      <ChatFAB bottomOffset={130} />

      {/* ── STICKY BOTTOM BAR ──────────────────────────────────────────────── */}
      {!loading && !error && detail && (
        <div style={{
          position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, background: 'white',
          borderTop: '1px solid #F1F5F9', padding: '12px 16px',
          display: 'flex', gap: 10, zIndex: 40,
        }}>
          {detail.application_url ? (
            <a
              href={detail.application_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, background: '#0A5C47', color: 'white', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, textAlign: 'center', textDecoration: 'none', display: 'block' }}
            >
              {t('இப்போது விண்ணப்பிக்கவும்', 'Apply Now')} →
            </a>
          ) : (
            <button disabled style={{ flex: 1, background: '#0A5C47', color: 'white', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, border: 'none', opacity: 0.6, cursor: 'not-allowed' }}>
              {t('மாவட்ட அலுவலகத்தில் விண்ணப்பிக்கவும்', 'Apply at District Office')}
            </button>
          )}
          {!applied && (
            <button
              onClick={() => markApplied(detail.scheme_id)}
              style={{ flex: 1, background: '#F0FDF4', color: '#0A5C47', borderRadius: 14, padding: '14px', fontSize: 13, fontWeight: 700, border: '1px solid #A7F3D0', cursor: 'pointer' }}
            >
              {t('விண்ணப்பித்தது என்று குறி', 'Mark as Applied')}
            </button>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

// ─── Info card ────────────────────────────────────────────────────────────────

function InfoCard({
  title, body,
  bg = 'white', labelColor = '#94A3B8', bodyColor = '#374151', borderColor,
}: {
  title: string; body: string
  bg?: string; labelColor?: string; bodyColor?: string; borderColor?: string
}) {
  return (
    <div style={{
      background: bg, borderRadius: 16, padding: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      border: borderColor ? `1px solid ${borderColor}` : 'none',
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, color: bodyColor, lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}
