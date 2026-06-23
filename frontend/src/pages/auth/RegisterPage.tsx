import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useFarmerStore } from '@/store/farmerStore'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { Button } from '@/components/ui/Button'

const DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy', 'Tirunelveli',
  'Vellore', 'Erode', 'Thanjavur', 'Dindigul', 'Cuddalore', 'Villupuram',
  'Tiruvannamalai', 'Namakkal', 'Karur', 'Nilgiris', 'Dharmapuri',
  'Krishnagiri', 'Perambalur', 'Ariyalur', 'Nagapattinam', 'Tiruvarur',
  'Pudukkottai', 'Sivaganga', 'Ramanathapuram', 'Virudhunagar', 'Thoothukudi',
  'Kanyakumari', 'Theni', 'Tiruppur', 'Ranipet', 'Chengalpattu',
  'Kallakurichi', 'Tenkasi',
]

const LANGUAGES = [
  { value: 'ta', label: 'தமிழ்' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
] as const

type Lang = 'ta' | 'en' | 'hi'

const L: Record<Lang, Record<string, string>> = {
  ta: { title: 'பதிவு செய்க', name: 'பெயர் (விருப்பத்தேர்வு)', namePh: 'உங்கள் பெயர்', district: 'மாவட்டம் *', districtPh: 'மாவட்டம் தேர்ந்தெடுக்கவும்', village: 'கிராமம் (விருப்பத்தேர்வு)', villagePh: 'உங்கள் கிராமம்', lang: 'மொழி', submit: 'பதிவு செய்க', haveAccount: 'ஏற்கனவே கணக்கு உள்ளதா?', login: 'உள்நுழை' },
  en: { title: 'Register', name: 'Name (optional)', namePh: 'Your name', district: 'District *', districtPh: 'Select district', village: 'Village (optional)', villagePh: 'Your village', lang: 'Language', submit: 'Register', haveAccount: 'Already have an account?', login: 'Login' },
  hi: { title: 'पंजीकरण', name: 'नाम (वैकल्पिक)', namePh: 'आपका नाम', district: 'जिला *', districtPh: 'जिला चुनें', village: 'गाँव (वैकल्पिक)', villagePh: 'आपका गाँव', lang: 'भाषा', submit: 'पंजीकरण', haveAccount: 'पहले से खाता है?', login: 'लॉगिन' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 12px', boxSizing: 'border-box',
  border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14,
  outline: 'none', color: '#111827', backgroundColor: 'white',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5,
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const phone: string = location.state?.phone ?? ''
  const registrationToken: string = location.state?.registrationToken ?? ''

  const setAuth = useFarmerStore((s) => s.setAuth)
  const resetProfile = useProfileStore((s) => s.resetProfile)
  const setProfile = useProfileStore((s) => s.setProfile)
  const resetUserData = useSchemeStore((s) => s.resetUserData)

  const [lang, setLang] = useState<Lang>('ta')
  const [name, setName] = useState('')
  const [district, setDistrict] = useState('')
  const [village, setVillage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = L[lang]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!district) { setError(lang === 'ta' ? 'மாவட்டத்தை தேர்ந்தெடுக்கவும்' : 'Please select a district'); return }
    setLoading(true); setError(null)
    try {
      const res = await authApi.register(
        {
          name: name || undefined,
          phone: registrationToken ? (phone || undefined) : undefined,
          district,
          village: village || undefined,
          language: lang,
        },
        registrationToken || undefined,
      )
      resetProfile(); resetUserData()
      setAuth(res.farmer_id, res.token, res.expires_at)
      setProfile({ name, phone, district, village, language: lang })
      navigate('/', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'பதிவு தோல்வி')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F2', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '28px 32px 24px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <span style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>உ</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>{t.title}</h1>
          {phone && (
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              +91 {phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 32px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Language picker — compact chips */}
          <div>
            <label style={labelStyle}>{t.lang}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {LANGUAGES.map((lng) => (
                <button
                  key={lng.value}
                  type="button"
                  onClick={() => setLang(lng.value)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${lang === lng.value ? '#0A5C47' : '#D1D5DB'}`,
                    backgroundColor: lang === lng.value ? '#0A5C47' : 'white',
                    color: lang === lng.value ? 'white' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {lng.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t.name}</label>
            <input type="text" placeholder={t.namePh} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>{t.district}</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} required style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">{t.districtPh}</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{t.village}</label>
            <input type="text" placeholder={t.villagePh} value={village} onChange={(e) => setVillage(e.target.value)} style={inputStyle} />
          </div>

          {error && <p style={{ color: '#991B1B', fontSize: 12, margin: 0 }}>{error}</p>}

          <Button type="submit" fullWidth loading={loading}>{t.submit}</Button>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
            {t.haveAccount}{' '}
            <Link to="/login" style={{ color: '#0A5C47', fontWeight: 600 }}>{t.login}</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
