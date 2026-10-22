import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const {
  getOfflineAttendanceQueue,
  enqueueOfflineAttendance,
  clearOfflineAttendanceQueue,
  syncOfflineAttendance,
  isBrowserOnline,
  withTimeout,
} = await import('../src/lib/offlineAttendance.ts')

const { DEFAULT_APP_FULL_NAME, DEFAULT_APP_NAME, BRAND_COOKIE } = await import(
  '../src/lib/branding.ts'
)

/**
 * Task 5.5 - Multi-Device PWA Smoke Verification & Ustaz Offline Sync Edge Testing.
 *
 * Real devices cannot be driven from CI, so the smoke verification is performed
 * at the contract level: every precached route must exist in the App Router,
 * every precached asset must exist in /public, the manifest must be a valid
 * standalone PWA manifest, and the persistent-auth/offline-sync contracts are
 * asserted directly.
 */

const ROOT = path.resolve('.')
const APP_DIR = path.join(ROOT, 'src', 'app')
const PUBLIC_DIR = path.join(ROOT, 'public')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function routeToPageFile(route) {
  const clean = route.replace(/^\//, '').replace(/\/$/, '')
  return clean ? path.join('src', 'app', ...clean.split('/'), 'page.tsx') : path.join('src', 'app', 'page.tsx')
}

// ==================== PWA manifest smoke verification ====================

describe('Dynamic PWA manifest smoke verification', () => {
  const manifestSource = read(path.join('src', 'app', 'manifest.ts'))

  test('the manifest route is an async default export', () => {
    assert.match(manifestSource, /export default async function manifest\(\)/)
  })

  test('the manifest declares a standalone, portrait PWA with a root scope', () => {
    assert.match(manifestSource, /display:\s*'standalone'/)
    assert.match(manifestSource, /orientation:\s*'portrait'/)
    assert.match(manifestSource, /scope:\s*'\/'/)
    assert.match(manifestSource, /start_url/)
    assert.match(manifestSource, /id\s*=\s*'\/'/)
    assert.match(manifestSource, /\n\s*id,\n/)
    assert.match(manifestSource, /short_name/)
  })

  test('the manifest always ships a 192, a 512 and a maskable icon', () => {
    const sizes = [...manifestSource.matchAll(/sizes:\s*'([^']+)'/g)].map((match) => match[1])
    const purposes = [...manifestSource.matchAll(/purpose:\s*'([^']+)'/g)].map((match) => match[1])

    assert.deepEqual(sizes, ['192x192', '512x512', '512x512', '192x192', '512x512', '512x512'])
    assert.deepEqual(purposes, ['any', 'any', 'maskable', 'any', 'any', 'maskable'])
  })

  test('every manifest icon points at a file that ships in /public/icons', () => {
    const iconFiles = [...manifestSource.matchAll(/src:\s*'\/icons\/([^']+)'/g)].map((m) => m[1])
    assert.ok(iconFiles.length > 0, 'Expected static icon references in the manifest')
    for (const file of new Set(iconFiles)) {
      assert.ok(
        fs.existsSync(path.join(PUBLIC_DIR, 'icons', file)),
        `Manifest references /icons/${file} which is missing from public/icons`
      )
    }
  })

  test('the default identity falls back to the shared branding constants', () => {
    assert.ok(manifestSource.includes(DEFAULT_APP_FULL_NAME), 'Default manifest name must match DEFAULT_APP_FULL_NAME')
    assert.ok(manifestSource.includes(`'${DEFAULT_APP_NAME}'`), 'Default short name must match DEFAULT_APP_NAME')
  })

  test('branding is resolved from the branded-link cookie', () => {
    assert.ok(manifestSource.includes(BRAND_COOKIE))
    assert.match(manifestSource, /cookies\(\)/)
  })

  test('the generic icon is only replaced when the madrasa uploaded a custom logo', () => {
    assert.match(
      manifestSource,
      /if\s*\(branding\.logoVersion\)\s*\{[\s\S]*?icons\s*=\s*\[/,
      'Custom icons must be gated behind branding.logoVersion'
    )
    assert.match(manifestSource, /brandingAssetUrl\(schoolId,\s*branding,\s*'icon192'\)/)
    assert.match(manifestSource, /brandingAssetUrl\(schoolId,\s*branding,\s*'icon512'\)/)
    assert.match(manifestSource, /brandingAssetUrl\(schoolId,\s*branding,\s*'maskable512'\)/)
  })
})

// ==================== Service worker smoke verification ====================

describe('Service worker pre-caching smoke verification', () => {
  const sw = read(path.join('public', 'sw.js'))

  function precacheShell() {
    const block = sw.match(/const PRECACHE_SHELL\s*=\s*\[([\s\S]*?)\]/)
    assert.ok(block, 'PRECACHE_SHELL array not found in public/sw.js')
    return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  }

  test('the service worker registers every required lifecycle handler', () => {
    for (const event of ['install', 'activate', 'fetch', 'push', 'notificationclick']) {
      assert.match(sw, new RegExp(`addEventListener\\('${event}'`))
    }
  })

  test('the service worker activates immediately and claims open clients', () => {
    assert.match(sw, /self\.skipWaiting\(\)/)
    assert.match(sw, /self\.clients\.claim\(\)/)
  })

  test('the cache name is versioned so stale caches can be purged', () => {
    const cache = sw.match(/const CACHE\s*=\s*'([^']+)'/)?.[1]
    assert.ok(cache, 'CACHE constant not found')
    assert.match(cache, /\d/, 'Cache name must carry a version number')
    assert.match(sw, /caches\.delete\(k\)/)
  })

  test('every precached route exists in the App Router', () => {
    const routes = precacheShell().filter((entry) => entry.startsWith('/') && !entry.startsWith('/icons/'))
    assert.ok(routes.length >= 3, 'Expected the public app shell routes to be precached')

    for (const route of routes) {
      const pageFile = routeToPageFile(route)
      assert.ok(
        fs.existsSync(path.join(ROOT, pageFile)),
        `Service worker precaches "${route}" but ${pageFile} does not exist`
      )
    }
  })

  test('every precached asset exists in /public', () => {
    const assets = precacheShell().filter((entry) => entry.startsWith('/icons/'))
    assert.ok(assets.length >= 3, 'Expected the PWA icon set to be precached')

    for (const asset of assets) {
      const relative = asset.replace(/^\//, '')
      assert.ok(
        fs.existsSync(path.join(PUBLIC_DIR, relative)),
        `Service worker precaches "${asset}" but public/${relative} is missing`
      )
    }
  })

  test('API and cross-origin requests are never served from the cache', () => {
    assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/)
    assert.match(sw, /url\.origin !== location\.origin/)
  })

  test('the offline navigation fallback ends on the precached offline page', () => {
    const fallback = sw.match(/async function offlineNavigation[\s\S]*?cache\.match\((\w+)\)/)?.[1]
    assert.equal(fallback, 'OFFLINE_URL', 'offlineNavigation must fall back to the offline document')
    const offlineUrl = sw.match(/const OFFLINE_URL = '([^']+)'/)?.[1]
    assert.equal(offlineUrl, '/offline.html')
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'offline.html')))
  })

  test('the start URL of a signed-in user is redirected to their home screen', () => {
    assert.match(sw, /if \(home && isEntryPath\(url\.pathname\) && !url\.searchParams\.has\('from'\)\)/)
    assert.match(sw, /data\.type === 'SET_HOME'/)
    assert.match(sw, /data\.type === 'CLEAR_HOME'/)
  })

  test('an offline request without a cached copy returns a 503 response', () => {
    assert.match(sw, /new Response\('You are offline\.'[\s\S]*?status:\s*503/)
  })
})

// ==================== Persistent auth verification ====================

describe('Persistent auth & offline profile cache verification', () => {
  test('firebase auth persists beyond a single browser session', () => {
    const config = read(path.join('src', 'lib', 'firebase', 'config.ts'))
    assert.match(config, /browserLocalPersistence/)
    assert.doesNotMatch(config, /browserSessionPersistence/)
  })

  test('the session cookie survives an app restart', () => {
    const auth = read(path.join('src', 'context', 'AuthContext.tsx'))
    assert.match(auth, /Max-Age=31536000/)
  })

  test('the user profile and madrasa are cached locally for offline opens', () => {
    const auth = read(path.join('src', 'context', 'AuthContext.tsx'))
    assert.ok(auth.includes('kmms_cached_user_'))
    assert.ok(auth.includes('kmms_cached_school_'))
  })

  test('a network failure restores the cached profile instead of signing the Ustaz out', () => {
    const auth = read(path.join('src', 'context', 'AuthContext.tsx'))
    const catchIndex = auth.indexOf('kmms_cached_user_')
    const clearIndex = auth.indexOf('await clearSession()', catchIndex)
    assert.ok(catchIndex > -1, 'Cached profile restore branch not found')
    assert.ok(clearIndex > catchIndex, 'Sign-out must only happen when no cached profile exists')
  })
})

// ==================== Ustaz offline sync edge testing ====================

function createStorage() {
  const map = new Map()
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
    clear: () => map.clear(),
  }
}

function installBrowser(storage) {
  globalThis.window = globalThis.window ?? {}
  globalThis.localStorage = storage
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
  })
}

function uninstallBrowser() {
  delete globalThis.window
  delete globalThis.localStorage
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
  })
}

function makeRecord(index, overrides = {}) {
  return {
    id: `class1_2026-10-20_student${index}`,
    studentId: `student${index}`,
    classId: 'class1',
    date: '2026-10-20',
    status: 'present',
    studentName: `Student ${index}`,
    className: 'Fiqh',
    teacherId: 'ustaz-uid',
    markedBy: 'ustaz-uid',
    timestamp: 1792480000000 + index,
    retryCount: 0,
    ...overrides,
  }
}

describe('Ustaz offline sync edge cases', () => {
  let storage

  beforeEach(() => {
    storage = createStorage()
    installBrowser(storage)
    clearOfflineAttendanceQueue()
  })

  afterEach(() => {
    uninstallBrowser()
  })

  test('the queue survives a simulated app restart', () => {
    enqueueOfflineAttendance([makeRecord(1)])

    // Simulate a page reload: the browser context is rebuilt, the storage persists.
    uninstallBrowser()
    installBrowser(storage)

    assert.equal(getOfflineAttendanceQueue().length, 1)
    assert.equal(getOfflineAttendanceQueue()[0].studentId, 'student1')
  })

  test('a storage quota failure never breaks the attendance marking flow', () => {
    const originalSetItem = globalThis.localStorage.setItem
    globalThis.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    const originalError = console.error
    console.error = () => {}

    try {
      assert.doesNotThrow(() => enqueueOfflineAttendance([makeRecord(1)]))
    } finally {
      console.error = originalError
      globalThis.localStorage.setItem = originalSetItem
    }

    assert.deepEqual(getOfflineAttendanceQueue(), [])
  })

  test('records taken on different dates all sync, oldest first', async () => {
    enqueueOfflineAttendance([
      makeRecord(1, { id: 'c_2026-10-19_s1', date: '2026-10-19' }),
      makeRecord(2, { id: 'c_2026-10-20_s2', date: '2026-10-20' }),
    ])

    const order = []
    const result = await syncOfflineAttendance(async (record) => {
      order.push(record.date)
    })

    assert.equal(result.synced, 2)
    assert.deepEqual(order, ['2026-10-19', '2026-10-20'])
    assert.equal(getOfflineAttendanceQueue().length, 0)
  })

  test('a failed record is retried first and keeps its position in the queue', async () => {
    enqueueOfflineAttendance([makeRecord(1), makeRecord(2), makeRecord(3)])

    const firstAttempt = await syncOfflineAttendance(async (record) => {
      if (record.studentId === 'student2') throw new Error('PERMISSION_DENIED')
    })

    assert.equal(firstAttempt.synced, 2)
    assert.equal(firstAttempt.failed, 1)

    const remaining = getOfflineAttendanceQueue()
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].studentId, 'student2')

    const secondAttempt = await syncOfflineAttendance(async () => {})
    assert.equal(secondAttempt.synced, 1)
    assert.equal(secondAttempt.failed, 0)
    assert.equal(getOfflineAttendanceQueue().length, 0)
  })

  test('a corrupted queue does not break the automatic sync', async () => {
    storage.map.set('kmms_offline_attendance_queue', 'not-json-at-all')

    const result = await syncOfflineAttendance(async () => {
      throw new Error('should never be called')
    })

    assert.equal(result.total, 0)
    assert.equal(result.synced, 0)
    assert.equal(result.failed, 0)
  })

  test('a full class roster syncs in one pass', async () => {
    const roster = Array.from({ length: 500 }, (_, index) => makeRecord(index))
    enqueueOfflineAttendance(roster)

    let syncedCount = 0
    const started = Date.now()
    const result = await syncOfflineAttendance(async () => {
      syncedCount += 1
    })

    assert.equal(syncedCount, 500)
    assert.equal(result.synced, 500)
    assert.equal(getOfflineAttendanceQueue().length, 0)
    assert.ok(Date.now() - started < 5000, 'Syncing a full roster must stay fast')
  })

  test('the queue reports offline only when the browser says so', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    })
    assert.equal(isBrowserOnline(), false)

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    })
    assert.equal(isBrowserOnline(), true)
  })

  test('the offline queue key is the one documented by the attendance pages', () => {
    const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))
    const hook = read(path.join('src', 'hooks', 'useOfflineAttendanceSync.ts'))
    assert.ok(page.includes('enqueueOfflineAttendance'))
    assert.ok(hook.includes('getOfflineAttendanceQueue'))
    assert.match(read(path.join('src', 'lib', 'offlineAttendance.ts')), /kmms_offline_attendance_queue/)
  })

  test('the Ustaz roster and class list come from the on-device live store', () => {
    const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))
    assert.ok(page.includes('useMyClasses()'), 'Class list must come from the shared offline-first store')
    assert.ok(page.includes('useStudentsOfClass('), 'Student roster must come from the shared offline-first store')
    const store = read(path.join('src', 'lib', 'dataStore.ts'))
    assert.ok(store.includes('readSnapshot<T>(key)'), 'The store must hydrate from the device snapshot')
    assert.ok(store.includes('writeSnapshot('), 'The store must persist every snapshot to the device')
  })

  test('an offline save falls back to the device queue when the cloud write fails', () => {
    const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))
    const catchIndex = page.indexOf('catch {')
    const enqueueIndex = page.indexOf('enqueueOfflineAttendance(recordsToEnqueue)', catchIndex)
    assert.ok(catchIndex > -1 && enqueueIndex > catchIndex, 'Network failure must fall back to the offline queue')
  })
})

// ==================== Async timeout & anti-hang guarantees ====================

describe('Async timeout & anti-hang offline guarantees', () => {
  test('withTimeout resolves immediately when the operation succeeds', async () => {
    const res = await withTimeout(Promise.resolve('ok'), 1000)
    assert.equal(res, 'ok')
  })

  test('withTimeout rejects when operation exceeds timeoutMs', async () => {
    const hanging = new Promise((resolve) => setTimeout(resolve, 500))
    await assert.rejects(
      () => withTimeout(hanging, 50),
      /Operation timed out after 50ms/
    )
  })

  test('withTimeout returns fallback value if provided when timed out', async () => {
    const hanging = new Promise((resolve) => setTimeout(resolve, 500))
    const res = await withTimeout(hanging, 50, 'fallback_val')
    assert.equal(res, 'fallback_val')
  })

  test('AuthContext contains synchronous localStorage hydration and safetyTimer', () => {
    const auth = read(path.join('src', 'context', 'AuthContext.tsx'))
    assert.ok(auth.includes('kmms_last_active_user'), 'Must hydrate last active user')
    assert.ok(auth.includes('kmms_last_active_school'), 'Must hydrate last active school')
    assert.ok(auth.includes('safetyTimer'), 'Must declare anti-hang safety timer')
    assert.ok(auth.includes('withTimeout'), 'Must wrap RTDB calls with withTimeout')
  })

  test('DashboardPage redirects unauthenticated users without hanging on the spinner', () => {
    const dashboard = read(path.join('src', 'app', 'dashboard', 'page.tsx'))
    assert.ok(dashboard.includes("router.replace('/login')"), 'Must redirect to login if !loading && !user')
  })

  test('service worker serves _next/static assets cache-first', () => {
    const sw = read(path.join('public', 'sw.js'))
    assert.ok(sw.includes("url.pathname.startsWith('/_next/static/')"), 'Must handle static assets')
    assert.ok(sw.includes('PRECACHE_SHELL'), 'Must precache shell')
    assert.ok(sw.includes("'/teacher'"), 'Must precache /teacher in shell')
  })
})

// ==================== Task 5.7: offline boot repair ====================
// The owner reported the installed app getting stuck on the loading spinner
// when it is opened again without a network. The tests below pin the three
// things that made that possible: the service worker must serve a bootable
// page offline, no request may hang, and the UI must never show an endless
// spinner.

describe('Offline boot repair: the service worker can serve a bootable page offline', () => {
  const swSource = read(path.join('public', 'sw.js'))
  const ORIGIN = 'https://app.test'

  const keyOf = (request) => {
    const raw = typeof request === 'string' ? request : request.url
    return raw.startsWith('/') ? ORIGIN + raw : raw
  }

  /**
   * Runs public/sw.js in a sandbox with a fake Cache API and a fake network,
   * so the real fetch handler can be exercised.
   */
  function runServiceWorker({ online = false, seed = {}, html, deviceOffline = false } = {}) {
    const listeners = {}
    const store = new Map(
      Object.entries(seed).map(([key, body]) => [key.startsWith('/') ? ORIGIN + key : key, new Response(body)])
    )
    const fetchCalls = []

    // One store per cache name (documents, RSC payloads, worker state), like
    // the real Cache API; `store` is the documents/assets cache.
    const stores = new Map()
    function cacheFor(name) {
      if (!stores.has(name)) {
        const map = name === 'khendeq-medresah-v5' ? store : new Map()
        stores.set(name, {
          map,
          async put(request, response) {
            map.set(keyOf(request), response)
          },
          // Like the real Cache API: every match is a fresh, unread response.
          async match(request) {
            const stored = map.get(keyOf(request))
            return stored ? stored.clone() : undefined
          },
          async add(url) {
            map.set(keyOf(url), new Response('cached:' + url))
          },
          async delete(request) {
            return map.delete(keyOf(request))
          },
        })
      }
      return stores.get(name)
    }
    const caches = {
      async open(name) {
        return cacheFor(name)
      },
      async keys() {
        return ['khendeq-medresah-v4']
      },
      async delete(name) {
        stores.delete(name)
        return true
      },
    }
    const fakeFetch = async (request) => {
      const url = typeof request === 'string' ? request : request.url
      fetchCalls.push(url)
      if (!online) throw new TypeError('Failed to fetch')
      const isRsc = typeof request !== 'string' && request.headers && request.headers.get('RSC') === '1'
      if (isRsc) {
        return new Response('flight:' + url, { status: 200, headers: { 'Content-Type': 'text/x-component' } })
      }
      const body = html ?? 'network:' + url
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } })
    }
    const clients = { claim() {}, matchAll: async () => [] }
    const self = {
      addEventListener(type, handler) {
        listeners[type] = listeners[type] || []
        listeners[type].push(handler)
      },
      skipWaiting() {},
      clients,
      location: { origin: ORIGIN },
      registration: { showNotification: async () => {} },
    }
    const context = vm.createContext({
      self,
      caches,
      fetch: fakeFetch,
      Response,
      // In a browser a relative URL resolves against the worker's scope.
      Request: class TestRequest extends Request {
        constructor(input, init) {
          super(typeof input === 'string' && input.startsWith('/') ? ORIGIN + input : input, init)
        }
      },
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
      console,
      location: { origin: ORIGIN },
      clients,
      navigator: { onLine: !deviceOffline },
    })
    vm.runInContext(swSource, context)

    async function dispatch(type, event) {
      const waits = []
      const enriched = { ...event, waitUntil: (promise) => waits.push(promise) }
      for (const handler of listeners[type] || []) handler(enriched)
      await Promise.all(waits)
      return enriched
    }

    async function fetchEvent(request) {
      let responded = null
      await dispatch('fetch', {
        request,
        respondWith(promise) {
          responded = promise
        },
      })
      return responded ? await responded : null
    }

    return { store, cacheFor, fetchCalls, dispatch, fetchEvent }
  }

  const navigation = (path) => ({ method: 'GET', url: ORIGIN + path, mode: 'navigate' })
  const rscFetch = (path, prefetch = false) => ({
    method: 'GET',
    url: ORIGIN + path + '?_rsc=1abcd',
    mode: 'cors',
    headers: new Headers(prefetch ? { RSC: '1', 'Next-Router-Prefetch': '1' } : { RSC: '1' }),
  })

  test('an offline navigation serves the cached page', async () => {
    const sw = runServiceWorker({ online: false, seed: { '/teacher/attendance': '<html>attendance shell</html>' } })
    const response = await sw.fetchEvent(navigation('/teacher/attendance'))
    assert.ok(response, 'The navigation must be answered')
    assert.match(await response.text(), /attendance shell/)
  })

  test('an offline navigation to a page never opened goes to its nearest cached parent', async () => {
    const sw = runServiceWorker({ online: false, seed: { '/teacher/exams': '<html>exam list</html>' } })
    const response = await sw.fetchEvent(navigation('/teacher/exams/never-opened'))
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), ORIGIN + '/teacher/exams')
  })

  test('a device that reports offline is answered from the cache without touching the network', async () => {
    const sw = runServiceWorker({
      online: true,
      deviceOffline: true,
      seed: { '/teacher/classes': '<html>classes shell</html>' },
    })
    const response = await sw.fetchEvent(navigation('/teacher/classes'))
    assert.match(await response.text(), /classes shell/)
    assert.equal(sw.fetchCalls.length, 0, 'An offline device must never wait for a network timeout')
  })

  test('the start URL of a signed-in user is redirected straight to their home screen', async () => {
    const sw = runServiceWorker({ online: true })
    await sw.dispatch('message', { data: { type: 'SET_HOME', path: '/teacher' } })
    for (const start of ['/', '/login', '/dashboard', '/m/khendeq']) {
      const response = await sw.fetchEvent(navigation(start))
      assert.equal(response.status, 302, `${start} must redirect to the home screen`)
      assert.equal(response.headers.get('location'), ORIGIN + '/teacher')
    }
    // A sign-in page the server bounced to is left alone: no redirect loop.
    const bounced = await sw.fetchEvent(navigation('/login?from=%2Fteacher'))
    assert.equal(bounced.status, 200)
    // The whole area was precached: pages and their RSC payloads.
    assert.ok(sw.store.has(ORIGIN + '/teacher/classes'), 'Area pages must be precached after sign-in')
    assert.ok(sw.store.has(ORIGIN + '/teacher/requests'), 'Area pages must be precached after sign-in')
    assert.ok(
      sw.cacheFor('khendeq-medresah-rsc-v5').map.has(ORIGIN + '/teacher/classes'),
      'Area RSC payloads must be precached after sign-in'
    )
  })

  test('signing out forgets the home screen and the cached RSC payloads', async () => {
    const sw = runServiceWorker({ online: true })
    await sw.dispatch('message', { data: { type: 'SET_HOME', path: '/teacher' } })
    await sw.dispatch('message', { data: { type: 'CLEAR_HOME' } })
    const response = await sw.fetchEvent(navigation('/'))
    assert.equal(response.status, 200, 'Without a home the landing page is served normally')
    assert.equal(sw.cacheFor('khendeq-medresah-rsc-v5').map.size, 0)
  })

  test('a home screen outside the app areas is refused', async () => {
    const sw = runServiceWorker({ online: true })
    await sw.dispatch('message', { data: { type: 'SET_HOME', path: 'https://evil.example/x' } })
    await sw.dispatch('message', { data: { type: 'SET_HOME', path: '/login' } })
    const response = await sw.fetchEvent(navigation('/'))
    assert.equal(response.status, 200)
  })

  test('an in-app navigation offline is answered by the RSC payload cached under the page path', async () => {
    const sw = runServiceWorker({ online: true })
    const online = await sw.fetchEvent(rscFetch('/teacher/classes'))
    assert.match(await online.text(), /flight:/)
    sw.fetchCalls.length = 0
    // Later, offline, with a different ?_rsc marker.
    const offline = runServiceWorker({ online: false })
    const rsc = offline.cacheFor('khendeq-medresah-rsc-v5')
    await rsc.put(ORIGIN + '/teacher/classes', new Response('flight:cached', { headers: { 'Content-Type': 'text/x-component' } }))
    const served = await offline.fetchEvent({ ...rscFetch('/teacher/classes'), url: ORIGIN + '/teacher/classes?_rsc=zzzz' })
    assert.equal(served.status, 200)
    assert.match(await served.text(), /flight:cached/)
    const missing = await offline.fetchEvent(rscFetch('/teacher/history'))
    assert.equal(missing.status, 503, 'With nothing cached the router must fall back to a full navigation')
  })

  test('a prefetch never replaces a full RSC payload already cached', async () => {
    const sw = runServiceWorker({ online: true })
    const rsc = sw.cacheFor('khendeq-medresah-rsc-v5')
    await rsc.put(ORIGIN + '/teacher/classes', new Response('flight:full', { headers: { 'Content-Type': 'text/x-component' } }))
    await sw.fetchEvent(rscFetch('/teacher/classes', true))
    assert.match(await (await rsc.match(ORIGIN + '/teacher/classes')).text(), /flight:full/)
  })

  test('an offline navigation without any cached page serves the offline document', async () => {
    const sw = runServiceWorker({ online: false, seed: { '/offline.html': '<html>offline document</html>' } })
    const response = await sw.fetchEvent(navigation('/admin/students'))
    assert.ok(response)
    assert.match(await response.text(), /offline document/)
  })

  test('an offline navigation without any cached page at all answers 503', async () => {
    const sw = runServiceWorker({ online: false })
    const response = await sw.fetchEvent(navigation('/admin/students'))
    assert.equal(response.status, 503)
    assert.match(await response.text(), /You are offline\./)
  })

  test('an online navigation is answered by the network', async () => {
    const sw = runServiceWorker({ online: true })
    const response = await sw.fetchEvent(navigation('/dashboard'))
    assert.equal(response.status, 200)
    assert.match(await response.text(), /network:/)
  })

  test('a build asset that is not cached fails loudly instead of with an empty body', async () => {
    const sw = runServiceWorker({ online: false })
    const response = await sw.fetchEvent({
      method: 'GET',
      url: ORIGIN + '/_next/static/chunks/app-1234.js',
      mode: 'cors',
    })
    assert.equal(response.status, 504, 'A missing build asset must be an explicit error')
    assert.notEqual((await response.text()).length, 0, 'The error body must not be empty')
  })

  test('a cached build asset is served without touching the network', async () => {
    const sw = runServiceWorker({
      online: false,
      seed: { '/_next/static/chunks/app-1234.js': 'console.log("boot")' },
    })
    const response = await sw.fetchEvent({
      method: 'GET',
      url: ORIGIN + '/_next/static/chunks/app-1234.js',
      mode: 'cors',
    })
    assert.equal(response.status, 200)
    assert.match(await response.text(), /console\.log/)
    assert.equal(sw.fetchCalls.length, 0, 'A cached asset must not hit the network')
  })

  test('installing the worker caches the build assets the app shell needs', async () => {
    const sw = runServiceWorker({
      online: true,
      html: '<html><script src="/_next/static/chunks/app-1234.js"></script><link href="/_next/static/css/app-5678.css" /></html>',
    })
    await sw.dispatch('install', {})
    assert.ok(
      sw.store.has(ORIGIN + '/_next/static/chunks/app-1234.js'),
      'The chunk the shell references must be cached, or the app can never hydrate offline'
    )
    assert.ok(
      sw.store.has(ORIGIN + '/_next/static/css/app-5678.css'),
      'The stylesheet the shell references must be cached too'
    )
    assert.ok(sw.store.has(ORIGIN + '/offline.html'), 'The offline document must be precached')
  })

  test('every network attempt of the worker is bounded by a timeout', () => {
    assert.match(swSource, /AbortController/)
    assert.match(swSource, /NAV_TIMEOUT_MS/)
    assert.match(swSource, /ASSET_TIMEOUT_MS/)
  })

  test('the worker never lets a request hang without answering', () => {
    assert.match(swSource, /event\.respondWith/)
    assert.match(swSource, /X-Offline/)
  })
})

describe('Offline boot repair: the app never shows an endless spinner', () => {
  const layout = read(path.join('src', 'app', 'layout.tsx'))
  const auth = read(path.join('src', 'context', 'AuthContext.tsx'))
  const protectedRoute = read(path.join('src', 'components', 'ProtectedRoute.tsx'))
  const dashboard = read(path.join('src', 'app', 'dashboard', 'page.tsx'))
  const registrar = read(path.join('src', 'components', 'ServiceWorkerRegistrar.tsx'))
  const installPrompt = read(path.join('src', 'components', 'InstallAppPrompt.tsx'))
  const dataLayer = read(path.join('src', 'lib', 'database', 'index.ts'))

  test('the offline document exists, is localized and is offered by the worker', () => {
    const offlineHtml = read(path.join('public', 'offline.html'))
    for (const locale of ['en', 'am', 'ar', 'om', 'so']) {
      assert.ok(offlineHtml.includes(`${locale}:`), `The offline document must carry ${locale} copy`)
    }
    assert.ok(offlineHtml.includes('prefers-color-scheme: dark'), 'The offline document must follow the theme')
    assert.match(read(path.join('public', 'sw.js')), /OFFLINE_URL = '\/offline\.html'/)
  })

  test('the service worker is registered on every page, not only after signing in', () => {
    assert.ok(layout.includes('<ServiceWorkerRegistrar />'), 'The registrar must be mounted in the root layout')
    assert.ok(!installPrompt.includes("register('/sw.js')"), 'Registration must not depend on a signed-in user')
  })

  test('the worker is registered with a version so updates reach the device', () => {
    assert.match(registrar, /SW_URL = `\/sw\.js\?v=/)
    assert.match(registrar, /updateViaCache: 'none'/)
  })

  test('a failed offline boot lands on the branded offline page', () => {
    assert.ok(layout.includes('/offline.html'), 'The layout needs the offline boot guard')
    assert.ok(layout.includes('__kmmsBooted'), 'The boot guard needs to know the app booted')
  })

  test('the session exposes the offline and stalled states', () => {
    assert.match(auth, /offline: boolean/)
    assert.match(auth, /stalled: boolean/)
    assert.match(auth, /setStalled\(true\)/)
  })

  test('protected routes and the dashboard show the offline screen instead of spinning', () => {
    assert.ok(protectedRoute.includes('<OfflineScreen />'))
    assert.ok(dashboard.includes('<OfflineScreen />'))
  })

  test('one-shot realtime reads can no longer hang forever', () => {
    assert.match(dataLayer, /READ_TIMEOUT_OFFLINE_MS/)
    assert.match(dataLayer, /withTimeout\(rtdbGet\(reference\)/)
  })

  test('the offline copy exists in every supported language', () => {
    for (const locale of ['en', 'am', 'ar', 'om', 'so']) {
      const common = JSON.parse(read(path.join('src', 'i18n', 'messages', locale, 'common.json')))
      for (const key of ['title', 'description', 'retry', 'waiting', 'banner']) {
        assert.ok(common.offline?.[key], `common.offline.${key} is missing in ${locale}`)
      }
    }
  })
})

// ==================== App feel (not a web page) ====================

describe('Installed app feels native, not like a web page', () => {
  const css = read(path.join('src', 'app', 'globals.css'))
  const layout = read(path.join('src', 'app', 'layout.tsx'))
  const feel = read(path.join('src', 'components', 'NativeFeel.tsx'))

  test('the interface is not selectable text and shows no tap highlight or callout', () => {
    const body = css.match(/\n  body \{([\s\S]*?)\n  \}/)?.[1] ?? ''
    assert.match(body, /user-select: none/)
    assert.match(body, /-webkit-touch-callout: none/)
    assert.match(body, /-webkit-tap-highlight-color: transparent/)
    assert.match(body, /touch-action: manipulation/)
    assert.match(css, /overscroll-behavior: none/)
  })

  test('typing fields and marked text stay selectable', () => {
    assert.match(css, /input,\s*\n\s*textarea,\s*\n\s*select,[\s\S]*?\.select-text \{[\s\S]*?user-select: text/)
  })

  test('long presses open no browser menu outside typing fields', () => {
    assert.match(layout, /<NativeFeel \/>/)
    assert.match(feel, /addEventListener\('contextmenu'/)
    assert.match(feel, /addEventListener\('selectstart'/)
    assert.match(feel, /input, textarea, select, \[contenteditable=""\], \[contenteditable="true"\], \.select-text/)
  })
})

describe('Refresh button in the app bar', () => {
  test('every signed-in screen has a refresh control that checks for an update, then reloads', () => {
    const shell = read(path.join('src', 'components', 'shell', 'AppShell.tsx'))
    assert.match(shell, /<RefreshButton \/>/)
    const button = read(path.join('src', 'components', 'shell', 'RefreshButton.tsx'))
    assert.match(button, /registration\?\.update\(\)/)
    assert.match(button, /window\.location\.reload\(\)/)
    assert.match(button, /setTimeout\(resolve, 1500\)/)
  })
})
