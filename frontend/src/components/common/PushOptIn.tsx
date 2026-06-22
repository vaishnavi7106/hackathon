/**
 * Small opt-in banner for push notifications.
 * Shows once if permission is default (not yet asked).
 * Disappears after grant or dismiss.
 */
import { useEffect, useState } from 'react'
import { subscribeToPush, getNotificationPermission } from '@/lib/pushNotifications'

type Lang = 'ta' | 'en'

const L = {
  ta: {
    title: 'காலை 6 மணி அறிவிப்பு',
    body: 'இன்றைய நீர் மற்றும் உர பணிகள் குறித்து அறிவிப்பு பெறவும்.',
    allow: 'அனுமதி',
    dismiss: 'வேண்டாம்',
    granted: '✅ அறிவிப்பு இயக்கப்பட்டது',
  },
  en: {
    title: '6am daily farm alerts',
    body: "Get notified about today's water and fertilizer tasks.",
    allow: 'Allow',
    dismiss: 'Not now',
    granted: '✅ Notifications enabled',
  },
}

const DISMISS_KEY = 'push-opt-in-dismissed'

export function PushOptIn({ lang }: { lang: Lang }) {
  const t = L[lang]
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')

  useEffect(() => {
    const perm = getNotificationPermission()
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    if (perm === 'default' && !dismissed) {
      setVisible(true)
    } else if (perm === 'granted') {
      setStatus('granted')
    }
  }, [])

  async function handleAllow() {
    setStatus('loading')
    const result = await subscribeToPush(lang)
    if (result === 'granted') {
      setStatus('granted')
      setTimeout(() => setVisible(false), 2000)
    } else {
      setStatus('denied')
      setVisible(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
      <span className="text-xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-900">{t.title}</p>
        <p className="text-xs text-green-700 mt-0.5">{t.body}</p>
        {status === 'granted' && (
          <p className="text-xs font-semibold text-green-700 mt-1">{t.granted}</p>
        )}
      </div>
      {status === 'idle' && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={handleAllow}
            className="text-xs px-3 py-1.5 rounded-full bg-green-700 text-white font-semibold"
          >
            {t.allow}
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs px-3 py-1.5 rounded-full text-green-600 font-medium"
          >
            {t.dismiss}
          </button>
        </div>
      )}
      {status === 'loading' && (
        <span className="text-xs text-green-600 shrink-0">…</span>
      )}
    </div>
  )
}
