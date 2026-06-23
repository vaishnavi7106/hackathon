import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { farmerApi } from '@/api/farmer'
import { useFarmerStore } from '@/store/farmerStore'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useFarmerStore((s) => s.setAuth)
  const resetProfile = useProfileStore((s) => s.resetProfile)
  const setProfile = useProfileStore((s) => s.setProfile)
  const resetUserData = useSchemeStore((s) => s.resetUserData)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.match(/^\d{10}$/)) {
      setError('சரியான 10 இலக்க கைபேசி எண் உள்ளிடவும்')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.login({ phone })
      resetProfile()
      resetUserData()
      setAuth(res.farmer_id, res.token, res.expires_at)
      try {
        const backendProfile = await farmerApi.getProfile()
        setProfile({ phone })
        useFarmerStore.getState().setProfile(backendProfile)
        useProfileStore.getState().seedFromServer(backendProfile)
      } catch { /* non-fatal */ }
      navigate('/', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'உள்நுழைவு தோல்வி'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#F9FAFB' }}>
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#0A5C47' }}
          >
            <span className="text-white text-2xl font-bold">உ</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#0A5C47' }}>உழவர் AI</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>உங்கள் கைபேசி எண்ணை உள்ளிடவும்</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="label">கைபேசி எண்</label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              className="input w-full"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#991B1B' }}>{error}</p>
          )}

          <Button type="submit" fullWidth loading={loading}>
            உள்நுழை
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#6B7280' }}>
          புதிய கணக்கு?{' '}
          <Link to="/register" className="font-medium" style={{ color: '#0A5C47' }}>
            பதிவு செய்க
          </Link>
        </p>
      </div>
    </div>
  )
}
