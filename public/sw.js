// Minimal service worker for offline / app-like behavior.
// Strategy: network-first for same-origin GET requests (excluding /api),
// falling back to a cached copy only when offline. Cross-origin (Firebase)
// and API requests are left untouched to avoid serving stale data.
const CACHE = 'khendeq-medresah-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  event.waitUntil(self.clients.claim())
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