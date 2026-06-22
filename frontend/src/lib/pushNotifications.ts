/**
 * Web Push subscription management.
 * Registers the service worker, requests notification permission,
 * and subscribes with the VAPID public key from the backend.
 */

import { useFarmerStore } from '@/store/farmerStore'

const SW_PATH = '/sw.js'
const SUBSCRIBE_API = '/v1/push/subscribe'
const VAPID_KEY_API = '/v1/push/vapid-public-key'

// ---------------------------------------------------------------------------
// Service worker registration (call once on app init)
// ---------------------------------------------------------------------------

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    return reg
  } catch (e) {
    console.warn('[SW] Registration failed:', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Permission + subscription
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(VAPID_KEY_API)
    if (!res.ok) return null
    const data = await res.json()
    return data.vapid_public_key || null
  } catch {
    return null
  }
}

async function sendSubscriptionToBackend(
  sub: PushSubscription,
  lang: string,
): Promise<void> {
  const token = useFarmerStore.getState().token
  const json = sub.toJSON()
  await fetch(SUBSCRIBE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      lang,
    }),
  })
}

/**
 * Request notification permission and subscribe to push.
 * Returns 'granted' | 'denied' | 'unsupported' | 'error'.
 */
export async function subscribeToPush(lang = 'ta'): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  try {
    const vapidKey = await fetchVapidPublicKey()
    if (!vapidKey) return 'error'

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await sendSubscriptionToBackend(sub, lang)
    return 'granted'
  } catch (e) {
    console.warn('[Push] Subscription failed:', e)
    return 'error'
  }
}

/**
 * Check current notification permission without prompting.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Unsubscribe from push (cleanup).
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      const token = useFarmerStore.getState().token
      await fetch(`/v1/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    }
  } catch (e) {
    console.warn('[Push] Unsubscribe failed:', e)
  }
}
