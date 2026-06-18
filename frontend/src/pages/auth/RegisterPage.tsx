import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useFarmerStore((s) => s.setAuth)
  const resetProfile = useProfileStore((s) => s.resetProfile)
  const setProfile = useProfileStore((s) => s.setProfile)
  const resetUserData = useSchemeStore((s) => s.resetUserData)
  const [form, setForm] = useState({ name: '', phone: '', district: '', village: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.phone.match(/^\d{10}$/)) {
      setError('சரியான 10 இலக்க கைபேசி எண் உள்ளிடவும்')
      return
    }
    if (!form.district) {
      setError('மாவட்டத்தை தேர்ந்தெடுக்கவும்')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.register({
        name: form.name || undefined,
        phone: form.phone,
        district: form.district,
        village: form.village || undefined,
        language: 'ta',
      })
      resetProfile()
      resetUserData()
      setAuth(res.farmer_id, res.token, res.expires_at)
      // Seed local profile with the registration data the user just entered
      setProfile({ name: form.name, district: form.district, village: form.village })
      navigate('/', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'பதிவு தோல்வி'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-50 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-bold text-primary-900">பதிவு செய்க</h1>
          <p className="text-primary-700 text-sm mt-1">உங்கள் விவரங்களை உள்ளிடவும்</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              பெயர் (விருப்பத்தேர்வு)
            </label>
            <input id="name" type="text" className="input" placeholder="உங்கள் பெயர்" value={form.name} onChange={set('name')} />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              கைபேசி எண் *
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              className="input"
              placeholder="9876543210"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              maxLength={10}
              required
            />
          </div>

          <div>
            <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1">
              மாவட்டம் *
            </label>
            <select id="district" className="input" value={form.district} onChange={set('district')} required>
              <option value="">மாவட்டம் தேர்ந்தெடுக்கவும்</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-1">
              கிராமம் (விருப்பத்தேர்வு)
            </label>
            <input id="village" type="text" className="input" placeholder="உங்கள் கிராமம்" value={form.village} onChange={set('village')} />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <Button type="submit" fullWidth loading={loading}>
            பதிவு செய்க
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          ஏற்கனவே கணக்கு உள்ளதா?{' '}
          <Link to="/login" className="text-primary-600 font-medium">
            உள்நுழை
          </Link>
        </p>
      </div>
    </div>
  )
}
