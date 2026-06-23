import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useFarmerStore } from '@/store/farmerStore'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { farmerApi } from '@/api/farmer'

const OTP_LENGTH = 6
const TIMER_SECONDS = 300

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const phone: string = location.state?.phone ?? ''

  const setAuth = useFarmerStore((s) => s.setAuth)
  const resetProfile = useProfileStore((s) => s.resetProfile)
  const setProfile = useProfileStore((s) => s.setProfile)
  const resetUserData = useSchemeStore((s) => s.resetUserData)

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
  const [timerExpired, setTimerExpired] = useState(false)
  const [resending, setResending] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))

  // Redirect if no phone in state
  useEffect(() => {
    if (!phone) navigate('/login', { replace: true })
  }, [phone, navigate])

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) { setTimerExpired(true); return }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const timerDisplay = () => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const s = (secondsLeft % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const submitOtp = useCallback(async (otp: string) => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.verifyOtp({ phone, otp })
      if (!res.is_new_user && res.token && res.farmer_id && res.expires_at) {
        resetProfile()
        resetUserData()
        setAuth(res.farmer_id, res.token, res.expires_at)
        try {
          const serverProfile = await farmerApi.getProfile()
          useFarmerStore.getState().setProfile(serverProfile)
          useProfileStore.getState().seedFromServer(serverProfile)
        } catch { /* non-fatal */ }
        navigate('/', { replace: true })
      } else if (res.is_new_user && res.registration_token) {
        navigate('/register', {
          replace: true,
          state: { phone, registrationToken: res.registration_token },
        })
      }
    } catch {
      triggerShake()
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      setError('தவறான OTP')
    } finally {
      setLoading(false)
    }
  }, [loading, phone, navigate, resetProfile, resetUserData, setAuth, setProfile])

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError(null)

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
    if (digit && index === OTP_LENGTH - 1) {
      const otp = next.join('')
      if (otp.length === OTP_LENGTH) submitOtp(otp)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next)
    setError(null)
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
    if (pasted.length === OTP_LENGTH) submitOtp(pasted)
  }

  const handleResend = async () => {
    if (!timerExpired || resending) return
    setResending(true)
    setError(null)
    setDigits(Array(OTP_LENGTH).fill(''))
    try {
      await authApi.sendOtp({ phone })
      setSecondsLeft(TIMER_SECONDS)
      setTimerExpired(false)
      inputRefs.current[0]?.focus()
    } catch {
      setError('SMS அனுப்ப இயலவில்லை. மீண்டும் முயற்சிக்கவும்')
    } finally {
      setResending(false)
    }
  }

  const formatted = phone.replace(/(\d{5})(\d{5})/, '$1 $2')
  const isFilled = digits.every(Boolean)

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
        .otp-shake { animation: shake 0.6s ease; }
      `}</style>

      <div className="min-h-screen flex flex-col px-6 pt-8" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="w-full max-w-sm mx-auto">
          {/* Back */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1 mb-8"
            style={{ color: '#6B7280' }}
          >
            <ArrowLeft size={20} />
            <span className="text-sm">திரும்பு</span>
          </button>

          {/* Heading */}
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#111827' }}>OTP சரிபார்க்கவும்</h1>
          <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
            +91 {formatted} க்கு OTP அனுப்பப்பட்டது
          </p>

          {/* 6 OTP boxes */}
          <div
            className={`flex gap-2 mb-6 ${shake ? 'otp-shake' : ''}`}
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="flex-1 text-center text-xl font-bold rounded-lg border outline-none transition-colors"
                style={{
                  height: 56,
                  borderColor: d ? '#0A5C47' : error ? '#DC2626' : '#D1D5DB',
                  backgroundColor: loading && i === OTP_LENGTH - 1 && isFilled ? '#E8F5F1' : 'white',
                  color: '#111827',
                  fontSize: 22,
                }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm mb-4 text-center" style={{ color: '#DC2626' }}>{error}</p>
          )}

          {/* Timer */}
          {!timerExpired ? (
            <p className="text-sm text-center mb-4" style={{ color: '#6B7280' }}>
              OTP{' '}
              <span className="font-semibold tabular-nums" style={{ color: '#111827' }}>
                {timerDisplay()}
              </span>{' '}
              நிமிடத்தில் காலாவதியாகும்
            </p>
          ) : (
            <p className="text-sm text-center mb-4 font-medium" style={{ color: '#DC2626' }}>
              OTP காலாவதியானது
            </p>
          )}

          {/* Resend */}
          <p className="text-sm text-center" style={{ color: '#6B7280' }}>
            OTP கிடைக்கவில்லையா?{' '}
            <button
              onClick={handleResend}
              disabled={!timerExpired || resending}
              className="font-semibold transition-colors"
              style={{ color: timerExpired ? '#0A5C47' : '#9CA3AF' }}
            >
              {resending ? 'அனுப்புகிறது...' : 'மீண்டும் OTP அனுப்பு'}
            </button>
          </p>
        </div>
      </div>
    </>
  )
}
