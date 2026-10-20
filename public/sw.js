// KMMS service worker - offline-first app shell (v4).
//
// Guarantees:
//  1. A cold offline start can BOOT: every cached HTML shell is stored together
//     with the JS/CSS chunks it references, so the app can hydrate without a
//     network. (Caching the HTML alone leaves the server-rendered spinner on
//     screen forever, because the bundle that would replace it never loads.)
//  2. Nothing hangs: every network attempt has a hard timeout, so a dead
//     network can never leave a screen spinning indefinitely.
//  3. Nothing fails silently: a missing asset returns an explicit error
//     response instead of an empty body that breaks hydration without a trace.
//  4. A friendly, branded offline page is the last resort for navigations.
const VERSION = 'v4'
// Keep in sync with SW_VERSION in src/components/ServiceWorkerRegistrar.tsx.
const CACHE = 'khendeq-medresah-v4'
const OFFLINE_URL = '/offline.html'
const NAV_TIMEOUT_MS = 3500
const ASSET_TIMEOUT_MS = 8000

// Routes (App Router pages) that must be available offline.
const PRECACHE_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/teacher',
  '/teacher/attendance',
  '/teacher/classes',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]
// Static documents that are not App Router routes.
const PRECACHE_DOCS = [OFFLINE_URL]

/** True for files that live in /public rather than App Router routes. */
function isStaticFile(path) {
  return path.startsWith('/icons/') || path.endsWith('.html') || /\.[a-z0-9]+$/i.test(path)
}

/** Fetches with a hard timeout so a dead network can never hang a request. */
async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(function () {
    controller.abort()
  }, timeoutMs)
  try {
    return await fetch(request, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Caches one build asset (content-hashed, so it is safe to keep forever). */
async function cacheAsset(cache, url) {
  try {
    const response = await fetchWithTimeout(new Request(url, { cache: 'reload' }), ASSET_TIMEOUT_MS)
    if (response && response.ok) await cache.put(url, response)
  } catch (err) {
    // A build asset that cannot be fetched now is simply not cached.
  }
}

/**
 * Caches the build assets an HTML document references.
 *
 * Without this step the app can never hydrate offline: the cached page loads,
 * but the bundle that would replace its server-rendered spinner never does.
 */
async function cacheShellAssets(cache, response) {
  try {
    const html = await response.text()
    const assets = new Set()
    const pattern = /(?:src|href)="(\/_next\/static\/[^"]+)"/g
    let match = pattern.exec(html)
    while (match !== null) {
      assets.add(match[1])
      match = pattern.exec(html)
    }
    await Promise.all(
      Array.from(assets).map(function (asset) {
        return cacheAsset(cache, asset)
      })
    )
  } catch (err) {
    // Not a document, or the body was already consumed: nothing to cache.
  }
}

/**
 * Caches an HTML shell together with the /_next/static assets it references.
 * Without the second step the app can never hydrate offline.
 */
async function precacheRoute(cache, route) {
  try {
    const response = await fetchWithTimeout(new Request(route, { cache: 'reload' }), ASSET_TIMEOUT_MS)
    if (!response || !response.ok) return
    const copy = response.clone()
    await cache.put(route, copy)
    await cacheShellAssets(cache, response)
  } catch (err) {
    // Offline during install: the route stays uncached, the runtime cache
    // below still fills it on the next successful visit.
  }
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    (async function () {
      const cache = await caches.open(CACHE)
      const documents = PRECACHE_DOCS.concat(
        PRECACHE_SHELL.filter(function (entry) {
          return isStaticFile(entry)
        })
      )
      await Promise.all(
        documents.map(function (url) {
          return cache.add(url).catch(function () {})
        })
      )
      const routes = PRECACHE_SHELL.filter(function (entry) {
        return !isStaticFile(entry)
      })
      await Promise.all(
        routes.map(function (route) {
          return precacheRoute(cache, route)
        })
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(function (k) {
            return k !== CACHE
          })
          .map(function (k) {
            return caches.delete(k)
          })
      )
      await self.clients.claim()
    })()
  )
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
  event.waitUntil(event.registration.showNotification(title, options))
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

// The page asks the waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return

  // Immutable, content-hashed build assets: cache first, they never change.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleBuildAsset(request, url))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url))
    return
  }

  // React Server Component payloads: fresh when online, cached when offline.
  if (url.searchParams.has('_rsc')) {
    event.respondWith(handleRscPayload(request))
    return
  }

  event.respondWith(handleAsset(request))
})

/** Navigations: network first (with a timeout), then the closest cached shell. */
async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS)
    if (response && response.ok) {
      const copy = response.clone()
      cache.put(request, copy.clone())
      // Keep the build assets of this page in the cache, so the next offline
      // start can hydrate it.
      cacheShellAssets(cache, copy)
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (url.pathname.startsWith('/teacher')) {
      const attendance = await cache.match('/teacher/attendance')
      if (attendance) return attendance
      const teacher = await cache.match('/teacher')
      if (teacher) return teacher
    }
    const dashboard = await cache.match('/dashboard')
    if (dashboard) return dashboard
    const root = await cache.match('/')
    if (root) return root
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Offline': '1' },
    })
  }
}

/** Build assets: cache first, and never an empty body that breaks hydration. */
async function handleBuildAsset(request, url) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    if (response && response.ok) await cache.put(request, response.clone())
    return response
  } catch (err) {
    return new Response('/* offline: ' + url.pathname + ' unavailable */', {
      status: 504,
      statusText: 'Offline',
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'X-Offline': '1' },
    })
  }
}

/** RSC payloads: network first, then the cached copy, then an offline marker. */
async function handleRscPayload(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS)
    if (response && response.ok) await cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-Offline': '1' },
    })
  }
}

/** Everything else: serve the cached copy at once and refresh it in the background. */
async function handleAsset(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) {
    fetchWithTimeout(request, ASSET_TIMEOUT_MS)
      .then(function (response) {
        if (response && response.ok) cache.put(request, response.clone())
      })
      .catch(function () {})
    return cached
  }
  try {
    const response = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    if (response && response.ok) await cache.put(request, response.clone())
    return response
  } catch (err) {
    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Offline': '1' },
    })
  }
}
