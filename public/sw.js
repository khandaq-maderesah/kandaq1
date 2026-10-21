// KMMS service worker - offline-first app shell (v5).
//
// Guarantees:
//  1. A cold offline start can BOOT: every cached HTML shell is stored together
//     with the JS/CSS chunks it references, so the app can hydrate without a
//     network. (Caching the HTML alone leaves the server-rendered spinner on
//     screen forever, because the bundle that would replace it never loads.)
//  2. The installed app opens straight on the user's home screen. The page
//     tells the worker where that is (SET_HOME) and the worker answers the
//     start URL ('/', '/login', '/dashboard', '/m/{slug}') with a redirect to
//     it, like the server middleware does online, so the landing/sign-in page
//     never flashes first. It then precaches every page of that area, so
//     screens never opened on this device still work offline.
//  3. Offline is instant: when the device reports no connection, nothing waits
//     for a network timeout; the cache answers at once. Online, navigations are
//     network-first with a hard timeout, so a dead network cannot hang a screen.
//  4. In-app navigation keeps working offline: React Server Component payloads
//     are cached under the page path (their per-request ?_rsc key and Vary
//     headers never match twice), so a tap in the sidebar renders from the
//     cache instead of forcing a full reload.
//  5. Nothing fails silently: a missing asset returns an explicit error
//     response instead of an empty body that breaks hydration without a trace.
//  6. A friendly, branded offline page is the last resort for navigations.
// Keep in sync with SW_VERSION in src/components/ServiceWorkerRegistrar.tsx.
const CACHE = 'khendeq-medresah-v5'
// RSC payloads live apart from documents: both are looked up by page path.
const RSC_CACHE = 'khendeq-medresah-rsc-v5'
// Tiny key/value state (the home screen path) that must survive worker restarts.
const STATE_CACHE = 'khendeq-medresah-state-v5'
const HOME_KEY = '/__kmms/home'
const OFFLINE_URL = '/offline.html'
const NAV_TIMEOUT_MS = 3000
const ASSET_TIMEOUT_MS = 8000

// Public routes (App Router pages) cached at install, before anyone signs in.
const PRECACHE_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]
// Static documents that are not App Router routes.
const PRECACHE_DOCS = [OFFLINE_URL]

// Every page of an area, precached once the page tells us the user's home.
// Protected routes cannot be cached at install: without a session the server
// answers them with a redirect to the sign-in page.
const AREA_ROUTES = {
  '/teacher': [
    '/teacher',
    '/teacher/attendance',
    '/teacher/classes',
    '/teacher/students',
    '/teacher/exams',
    '/teacher/exams/create',
    '/teacher/exams/overall',
    '/teacher/history',
    '/teacher/reports',
    '/teacher/requests',
    '/profile',
  ],
  '/admin': [
    '/admin',
    '/admin/students',
    '/admin/teachers',
    '/admin/requests',
    '/admin/classes',
    '/admin/attendance',
    '/admin/exams',
    '/admin/weekly-reports',
    '/admin/reports',
    '/admin/settings',
    '/profile',
  ],
  '/superadmin': ['/superadmin', '/profile'],
}

// Where the installed app starts, or where the server sends a signed-out user.
const ENTRY_PATHS = ['/', '/login', '/dashboard']

/** True for the start pages that should go straight to the user's home screen. */
function isEntryPath(pathname) {
  if (ENTRY_PATHS.indexOf(pathname) !== -1) return true
  // The madrasa's own sign-in link, e.g. /m/khendeq (not its manifest).
  return /^\/m\/[^/]+\/?$/.test(pathname)
}

/** '/teacher/exams/abc' -> '/teacher/exams' -> '/teacher' -> null (never '/'). */
function parentPath(pathname) {
  const idx = pathname.lastIndexOf('/')
  if (idx <= 0) return null
  return pathname.slice(0, idx)
}

/** The area ('/teacher', '/admin', '/superadmin') a path belongs to, if any. */
function areaOf(pathname) {
  const areas = Object.keys(AREA_ROUTES)
  for (let i = 0; i < areas.length; i += 1) {
    const area = areas[i]
    if (pathname === area || pathname.indexOf(area + '/') === 0) return area
  }
  return null
}

/** The cache key of a page's RSC payload: origin + path, without ?_rsc. */
function rscKey(url) {
  return url.origin + url.pathname
}

/** True when the device itself reports that it has no connection. */
function isOffline() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false
  } catch {
    return false
  }
}

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

/** True when a response is the page that was asked for (not a sign-in bounce). */
function isSamePage(response, pathname) {
  if (!response || !response.ok || response.redirected) return false
  try {
    return new URL(response.url).pathname === pathname
  } catch {
    return true
  }
}

/** True for a React Server Component payload. */
function isFlightResponse(response) {
  const type = response.headers.get('content-type') || ''
  return type.indexOf('text/x-component') === 0
}

/** Caches one build asset (content-hashed, so it is safe to keep forever). */
async function cacheAsset(cache, url) {
  try {
    if (await cache.match(url)) return
    const response = await fetchWithTimeout(new Request(url, { cache: 'reload' }), ASSET_TIMEOUT_MS)
    if (response && response.ok) await cache.put(url, response)
  } catch {
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
  } catch {
    // Not a document, or the body was already consumed: nothing to cache.
  }
}

/**
 * Caches an HTML shell together with the /_next/static assets it references.
 * A protected route answered with a sign-in redirect is never stored.
 */
async function precacheRoute(cache, route) {
  try {
    const response = await fetchWithTimeout(new Request(route, { cache: 'reload' }), ASSET_TIMEOUT_MS)
    if (!isSamePage(response, route)) return
    await cache.put(route, response.clone())
    await cacheShellAssets(cache, response)
  } catch {
    // Offline during install: the route stays uncached, the runtime cache
    // below still fills it on the next successful visit.
  }
}

/** Caches a page's RSC payload, so an in-app navigation to it works offline. */
async function precacheRsc(route) {
  try {
    const rsc = await caches.open(RSC_CACHE)
    const request = new Request(route, { cache: 'reload', headers: { RSC: '1' } })
    const response = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    if (!isSamePage(response, route) || !isFlightResponse(response)) return
    await rsc.put(self.location.origin + route, response)
  } catch {
    // Not available now: the runtime handler fills it on the next visit.
  }
}

/** Precaches every page (document + RSC payload) of the user's area. */
async function precacheArea(home) {
  if (isOffline()) return
  const area = areaOf(home)
  const routes = area ? AREA_ROUTES[area] : []
  const cache = await caches.open(CACHE)
  await Promise.all(
    routes.map(function (route) {
      return Promise.all([precacheRoute(cache, route), precacheRsc(route)])
    })
  )
}

async function readHome() {
  try {
    const state = await caches.open(STATE_CACHE)
    const stored = await state.match(HOME_KEY)
    if (!stored) return null
    const path = (await stored.text()).trim()
    return path && path.charAt(0) === '/' ? path : null
  } catch {
    return null
  }
}

async function setHome(path) {
  if (typeof path !== 'string' || path.charAt(0) !== '/' || !areaOf(path)) return
  const state = await caches.open(STATE_CACHE)
  await state.put(HOME_KEY, new Response(path, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
  await precacheArea(path)
}

async function clearHome() {
  const state = await caches.open(STATE_CACHE)
  await state.delete(HOME_KEY)
  // The previous account's pages must not linger on a shared device.
  await caches.delete(RSC_CACHE)
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
      const keep = [CACHE, RSC_CACHE, STATE_CACHE]
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(function (k) {
            return keep.indexOf(k) === -1
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

// Messages from the page: take over now, or remember/forget the home screen.
self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') self.skipWaiting()
  if (data.type === 'SET_HOME') event.waitUntil(setHome(data.path))
  if (data.type === 'CLEAR_HOME') event.waitUntil(clearHome())
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

  // React Server Component payloads (in-app navigations and prefetches).
  if (url.searchParams.has('_rsc') || (request.headers && request.headers.get('RSC') === '1')) {
    event.respondWith(handleRscPayload(request, url))
    return
  }

  event.respondWith(handleAsset(request))
})

/**
 * Navigations. The start pages go straight to the user's home screen; other
 * pages are network first (with a timeout) when online and cache first when
 * the device is offline, falling back to the closest cached page.
 */
async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE)
  const home = await readHome()

  // A signed-in user never sees the landing/sign-in page first. A sign-in
  // page the server bounced to (?from=...) is left alone, so an expired
  // session can never loop between the two.
  if (home && isEntryPath(url.pathname) && !url.searchParams.has('from')) {
    return Response.redirect(new URL(home, self.location.origin).href, 302)
  }

  if (!isOffline()) {
    try {
      const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS)
      if (isSamePage(response, url.pathname)) {
        const copy = response.clone()
        cache.put(url.origin + url.pathname, copy.clone())
        // Keep the build assets of this page in the cache, so the next offline
        // start can hydrate it.
        cacheShellAssets(cache, copy)
      }
      return response
    } catch {
      // No network: fall through to the cache.
    }
  }
  return offlineNavigation(cache, url, home)
}

/** The closest cached page for a navigation that cannot reach the server. */
async function offlineNavigation(cache, url, home) {
  const exact = await cache.match(url.origin + url.pathname, { ignoreSearch: true })
  if (exact) return exact
  // The nearest cached parent page, as a redirect so URL and page agree
  // (e.g. an exam sheet that was never opened falls back to the exam list).
  let parent = parentPath(url.pathname)
  while (parent) {
    if (await cache.match(url.origin + parent, { ignoreSearch: true })) {
      return Response.redirect(new URL(parent, url.origin).href, 302)
    }
    parent = parentPath(parent)
  }
  if (home && url.pathname !== home && (await cache.match(url.origin + home))) {
    return Response.redirect(new URL(home, url.origin).href, 302)
  }
  const offline = await cache.match(OFFLINE_URL)
  if (offline) return offline
  return new Response('You are offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Offline': '1' },
  })
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
  } catch {
    return new Response('/* offline: ' + url.pathname + ' unavailable */', {
      status: 504,
      statusText: 'Offline',
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'X-Offline': '1' },
    })
  }
}

/**
 * RSC payloads: network first when online (stored under the page path), the
 * cached payload when offline. With nothing cached the router gets an error
 * and falls back to a full navigation, which the cached document answers.
 */
async function handleRscPayload(request, url) {
  const rsc = await caches.open(RSC_CACHE)
  const key = rscKey(url)
  if (!isOffline()) {
    try {
      const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS)
      if (isSamePage(response, url.pathname) && isFlightResponse(response)) {
        // A prefetch may be a partial tree: never let it replace a full one.
        const isPrefetch = request.headers.get('Next-Router-Prefetch') === '1'
        if (!isPrefetch || !(await rsc.match(key, { ignoreVary: true }))) {
          rsc.put(key, response.clone())
        }
      }
      return response
    } catch {
      // No network: fall through to the cache.
    }
  }
  const cached = await rsc.match(key, { ignoreVary: true })
  if (cached) return cached
  return new Response('', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Offline': '1' },
  })
}

/** Everything else: serve the cached copy at once and refresh it in the background. */
async function handleAsset(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) {
    if (!isOffline()) {
      fetchWithTimeout(request, ASSET_TIMEOUT_MS)
        .then(function (response) {
          if (response && response.ok) cache.put(request, response.clone())
        })
        .catch(function () {})
    }
    return cached
  }
  try {
    const response = await fetchWithTimeout(request, ASSET_TIMEOUT_MS)
    if (response && response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Offline': '1' },
    })
  }
}
