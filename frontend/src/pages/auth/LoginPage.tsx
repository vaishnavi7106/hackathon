import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useFarmerStore } from '@/store/farmerStore'
import { useProfileStore } from '@/store/profileStore'
import { useSchemeStore } from '@/store/schemeStore'
import { farmerApi } from '@/api/farmer'
import { Button } from '@/components/ui/Button'

const OTP_LENGTH = 5
const DEV_OTP = '56742'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useFarmerStore((s) => s.setAuth)
  const resetProfile = useProfileStore((s) => s.resetProfile)
  const resetUserData = useSchemeStore((s) => s.resetUserData)

  const [phone, setPhone] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [timerExpired, setTimerExpired] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))

  useEffect(() => {
    if (step !== 'otp') return
    if (secondsLeft <= 0) { setTimerExpired(true); return }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [step, secondsLeft])

  useEffect(() => {
    if (step === 'otp') setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }, [step])

  const timerDisplay = () => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const s = (secondsLeft % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.match(/^\d{10}$/)) { setSendError('சரியான கைபேசி எண் உள்ளிடவும்'); return }
    setSendLoading(true); setSendError(null)
    try { await authApi.sendOtp({ phone }) } catch { /* dev mode */ }
    setStep('otp')
    setDigits(Array(OTP_LENGTH).fill(''))
    setSecondsLeft(300)
    setTimerExpired(false)
    setSendLoading(false)
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const submitOtp = useCallback(async (otp: string) => {
    if (otpLoading) return
    setOtpLoading(true); setOtpError(null)

    if (otp === DEV_OTP) {
      try {
        // Try existing farmer login first
        const res = await authApi.login({ phone })
        resetProfile(); resetUserData()
        setAuth(res.farmer_id, res.token, res.expires_at)
        try {
          const sp = await farmerApi.getProfile()
          useFarmerStore.getState().setProfile(sp)
          useProfileStore.getState().seedFromServer(sp)
        } catch { /* non-fatal */ }
        navigate('/', { replace: true })
      } catch {
        // New user — go to registration
        navigate('/register', { replace: true, state: { phone } })
      } finally {
        setOtpLoading(false)
      }
      return
    }

    try {
      const res = await authApi.verifyOtp({ phone, otp })
      if (!res.is_new_user && res.token && res.farmer_id && res.expires_at) {
        resetProfile(); resetUserData()
        setAuth(res.farmer_id, res.token, res.expires_at)
        try {
          const sp = await farmerApi.getProfile()
          useFarmerStore.getState().setProfile(sp)
          useProfileStore.getState().seedFromServer(sp)
        } catch { /* non-fatal */ }
        navigate('/', { replace: true })
      } else if (res.is_new_user && res.registration_token) {
        navigate('/register', { replace: true, state: { phone, registrationToken: res.registration_token } })
      }
    } catch {
      triggerShake()
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
      setOtpError('தவறான OTP. மீண்டும் முயற்சிக்கவும்')
    } finally {
      setOtpLoading(false)
    }
  }, [otpLoading, phone, navigate, resetProfile, resetUserData, setAuth])

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[index] = digit
    setDigits(next); setOtpError(null)
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    if (digit && index === OTP_LENGTH - 1 && next.every(Boolean)) submitOtp(next.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next); setOtpError(null)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
    if (pasted.length === OTP_LENGTH) submitOtp(pasted)
  }

  const handleResend = async () => {
    if (!timerExpired) return
    try { await authApi.sendOtp({ phone }) } catch { /* dev mode */ }
    setDigits(Array(OTP_LENGTH).fill(''))
    setSecondsLeft(300); setTimerExpired(false); setOtpError(null)
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

  const formatted = phone.replace(/(\d{5})(\d{5})/, '+91 $1 $2')

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(8px)}
          45%{transform:translateX(-6px)}60%{transform:translateX(6px)}75%{transform:translateX(-4px)}90%{transform:translateX(4px)}
        }
        .otp-shake{animation:shake 0.6s ease}
      `}</style>

      {/* Full-screen centred layout */}
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4F2', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

          {/* Card header — green gradient */}
          <div style={{ background: 'linear-gradient(135deg, #0A5C47 0%, #12A07A 100%)', padding: '36px 32px 28px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ color: 'white', fontSize: 28, fontWeight: 700 }}>உ</span>
            </div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>உழவர் AI</h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
              {step === 'phone'
                ? 'உங்கள் கைபேசி எண்ணை உள்ளிடவும்'
                : `${formatted} க்கு OTP அனுப்பப்பட்டது`}
            </p>
          </div>

          {/* Card body */}
          <div style={{ padding: '28px 32px 32px' }}>

            {/* ── STEP 1: Phone ── */}
            {step === 'phone' && (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    கைபேசி எண்
                  </label>
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', padding: '0 12px',
                      backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB',
                      borderRight: 'none', borderRadius: '8px 0 0 8px',
                      fontSize: 14, color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap',
                    }}>+91</span>
                    <input
                      type="tel" inputMode="numeric" autoFocus autoComplete="tel"
                      placeholder="9876543210" value={phone} maxLength={10}
                      onChange={(e) => { setSendError(null); setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)) }}
                      style={{
                        flex: 1, height: 48, padding: '0 14px',
                        border: '1px solid #D1D5DB', borderRadius: '0 8px 8px 0',
                        fontSize: 15, outline: 'none', color: '#111827',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0A5C47'}
                      onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                    />
                  </div>
                  {sendError && <p style={{ color: '#991B1B', fontSize: 12, marginTop: 4 }}>{sendError}</p>}
                </div>

                <Button type="submit" fullWidth loading={sendLoading} disabled={phone.length !== 10}>
                  OTP அனுப்பு
                </Button>

                <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
                  புதிய கணக்கு?{' '}
                  <button
                    type="button"
                    style={{ color: '#0A5C47', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => {
                      if (phone.length === 10) handleSendOtp({ preventDefault: () => {} } as React.FormEvent)
                      else setSendError('முதலில் கைபேசி எண் உள்ளிடவும்')
                    }}
                  >
                    பதிவு செய்க
                  </button>
                </p>
              </form>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 'otp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  className={shake ? 'otp-shake' : ''}
                  onPaste={handlePaste}
                  style={{ display: 'flex', gap: 8, width: '100%' }}
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el }}
                      type="tel" inputMode="numeric" maxLength={1} value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      disabled={otpLoading}
                      style={{
                        flex: '1 1 0', minWidth: 0, width: 0,
                        height: 44, textAlign: 'center',
                        fontSize: 18, fontWeight: 700,
                        border: `2px solid ${d ? '#0A5C47' : otpError ? '#DC2626' : '#D1D5DB'}`,
                        borderRadius: 8, outline: 'none', boxSizing: 'border-box',
                        backgroundColor: d ? '#E8F5F1' : 'white',
                        color: '#111827', transition: 'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>

                {otpError && (
                  <p style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', margin: 0 }}>{otpError}</p>
                )}

                {!timerExpired ? (
                  <p style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', margin: 0 }}>
                    OTP{' '}
                    <span style={{ color: '#111827', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{timerDisplay()}</span>
                    {' '}நிமிடத்தில் காலாவதியாகும்
                  </p>
                ) : (
                  <p style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', fontWeight: 500, margin: 0 }}>
                    OTP காலாவதியானது
                  </p>
                )}

                <p style={{ textAlign: 'center', fontSize: 13, color: '#6B7280', margin: 0 }}>
                  <button
                    onClick={handleResend} disabled={!timerExpired}
                    style={{
                      fontWeight: 600, background: 'none', border: 'none', cursor: timerExpired ? 'pointer' : 'default', padding: 0,
                      color: timerExpired ? '#0A5C47' : '#9CA3AF',
                    }}
                  >
                    மீண்டும் OTP அனுப்பு
                  </button>
                </p>

                <button
                  onClick={() => { setStep('phone'); setDigits(Array(OTP_LENGTH).fill('')); setOtpError(null) }}
                  style={{ fontSize: 13, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
                >
                  ← வேறு எண் பயன்படுத்து
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
