// Uzhavar AI — Service Worker
// Handles Web Push notifications for 6am daily farm task alerts.

const CACHE_NAME = 'uzhavar-ai-v1'

// ---------------------------------------------------------------------------
// Install + activate (minimal caching — app is Vite SPA, not fully offline)
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ---------------------------------------------------------------------------
// Push event — show notification
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'உழவர் AI', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'உழவர் AI 🌾'
  const options = {
    body: data.body || 'இன்றைய பண்ணை பணி காண திறக்கவும்.',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    tag: 'daily-farm-task',        // replaces previous notification if still pending
    renotify: false,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'திற / Open' },
      { action: 'dismiss', title: 'மூடு / Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ---------------------------------------------------------------------------
// Notification click — navigate to the right page
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: targetUrl })
          return client.focus()
        }
      }
      // Otherwise open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }),
  )
})
