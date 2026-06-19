import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { farmerApi } from '@/api/farmer'
import { useFarmerStore } from '@/store/farmerStore'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { seedProfileFromBackend } from '@/lib/profileSync'
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
      // Pre-populate local profile from whatever the backend already has
      try {
        const backendProfile = await farmerApi.getProfile()
        setProfile(seedProfileFromBackend(backendProfile))
      } catch { /* non-fatal — profile will be filled in later */ }
      navigate('/', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'உள்நுழைவு தோல்வி'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-bold text-primary-900">உழவர் AI</h1>
          <p className="text-primary-700 text-sm mt-1">உங்கள் கைபேசி எண்ணை உள்ளிடவும்</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              கைபேசி எண்
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              className="input"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <Button type="submit" fullWidth loading={loading}>
            உள்நுழை
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          புதிய கணக்கு?{' '}
          <Link to="/register" className="text-primary-600 font-medium">
            பதிவு செய்க
          </Link>
        </p>
      </div>
    </div>
  )
}
