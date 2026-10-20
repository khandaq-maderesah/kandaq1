// Minimal service worker for offline / app-like behavior.
// Strategy: network-first for same-origin GET requests (excluding /api),
// falling back to a cached copy only when offline. Cross-origin (Firebase)
// and API requests are left untouched to avoid serving stale data.
const CACHE = 'khendeq-medresah-v2'
const PRECACHE_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/teacher/attendance',
  '/teacher/classes',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE_SHELL) {
        try {
          await cache.add(url)
        } catch {
          // Ignore individual asset fetch failures during initial install
        }
      }
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'KMMS Notification'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url || '/admin/attendance',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data || '/admin/attendance'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response && response.ok) {
          cache.put(request, response.clone())
        }
        return response
      } catch {
        const cached = await cache.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await cache.match('/dashboard')
          if (shell) return shell
        }
        return new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      }
    })()
  )
})