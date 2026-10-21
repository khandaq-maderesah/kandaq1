import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const {
  SNAPSHOT_PREFIX,
  MAX_SNAPSHOT_CHARS,
  snapshotKey,
  readSnapshot,
  writeSnapshot,
  removeSnapshots,
  recentAttendanceOnly,
  persistSelectorFor,
} = await import('../src/lib/dataStorePersistence.ts')

const { homePathFor, offlineHomeFor } = await import('../src/lib/routes.ts')

/**
 * Offline-first data store + service worker v5 contract tests.
 *
 * The phone cannot be driven from CI, so the pieces that make every screen
 * open instantly offline are asserted directly: the on-device snapshot
 * persistence (what the live store hydrates from), the start-screen rules the
 * worker applies, and the worker's routing helpers executed in a sandbox.
 */

const ROOT = path.resolve('.')

function createStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value))
    },
    removeItem: (key) => {
      map.delete(key)
    },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
  }
}

// ==================== On-device snapshots ====================

describe('Live store snapshots persist on the device', () => {
  test('a snapshot written for a channel is read back as the same value', () => {
    const storage = createStorage()
    const classes = [{ id: 'c1', name: 'Fiqh', teacherId: 'u1' }]
    assert.equal(writeSnapshot('school1:classes', classes, storage), true)
    assert.deepEqual(readSnapshot('school1:classes', storage), classes)
    assert.equal(storage.getItem(snapshotKey('school1:classes')), JSON.stringify(classes))
  })

  test('an unknown channel reads as undefined, never as an empty list', () => {
    assert.equal(readSnapshot('school1:exams', createStorage()), undefined)
  })

  test('a corrupt snapshot is ignored instead of breaking the screen', () => {
    const storage = createStorage()
    storage.setItem(snapshotKey('school1:classes'), '{not json')
    assert.equal(readSnapshot('school1:classes', storage), undefined)
  })

  test('an oversized snapshot is skipped and a stale copy removed', () => {
    const storage = createStorage()
    writeSnapshot('school1:attendance', [{ id: 'old' }], storage)
    const huge = Array.from({ length: 20000 }, (_, i) => ({ id: `r${i}`, note: 'x'.repeat(100) }))
    assert.ok(JSON.stringify(huge).length > MAX_SNAPSHOT_CHARS)
    assert.equal(writeSnapshot('school1:attendance', huge, storage), false)
    assert.equal(readSnapshot('school1:attendance', storage), undefined)
  })

  test('a storage that throws (quota, private mode) never throws out of the store', () => {
    const storage = createStorage()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    assert.equal(writeSnapshot('school1:classes', [1, 2, 3], storage), false)
    assert.equal(writeSnapshot('school1:classes', [1], null), false)
    assert.equal(readSnapshot('school1:classes', null), undefined)
  })

  test('signing out removes every snapshot but nothing else', () => {
    const storage = createStorage()
    writeSnapshot('school1:classes', [], storage)
    writeSnapshot('school1:studentsByClass:c1', [], storage)
    storage.setItem('kmms_offline_attendance_queue', '[]')
    assert.equal(removeSnapshots(storage), 2)
    assert.equal(storage.length, 1)
    assert.equal(storage.getItem('kmms_offline_attendance_queue'), '[]')
    assert.ok(!storage.key(0).startsWith(SNAPSHOT_PREFIX))
  })
})

describe('Attendance snapshots keep only what a phone needs', () => {
  const now = new Date('2026-10-21T12:00:00Z')

  test('rows older than the retention window are dropped, newest first', () => {
    const rows = [
      { id: 'a', date: '2026-10-20' },
      { id: 'b', date: '2026-05-01' },
      { id: 'c', date: '2026-10-21' },
      { id: 'd', date: '2026-08-01' },
    ]
    assert.deepEqual(
      recentAttendanceOnly(rows, now, 90).map((r) => r.id),
      ['c', 'a', 'd']
    )
  })

  test('the hard row cap bounds a very large history', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: String(i), date: '2026-10-21' }))
    assert.equal(recentAttendanceOnly(rows, now, 90, 10).length, 10)
  })

  test('only attendance channels get a persist selector', () => {
    assert.equal(typeof persistSelectorFor('attendance:teacher:u1'), 'function')
    assert.equal(typeof persistSelectorFor('attendance:since:2026-10-01'), 'function')
    assert.equal(persistSelectorFor('classes'), null)
    assert.equal(persistSelectorFor('studentsByClass:c1'), null)
    const select = persistSelectorFor('attendance:teacher:u1')
    assert.equal(select('not a list'), 'not a list')
  })
})

// ==================== Start screen rules ====================

describe('Start screen of the installed app', () => {
  test('each role has a fixed home the worker can open without a network', () => {
    assert.equal(offlineHomeFor('teacher'), '/teacher')
    assert.equal(offlineHomeFor('admin'), '/admin')
    assert.equal(offlineHomeFor('superadmin'), '/superadmin')
    assert.equal(offlineHomeFor(undefined), null)
  })

  test('homePathFor keeps its sign-in landing rules', () => {
    assert.equal(homePathFor('superadmin', true), '/admin')
    assert.equal(homePathFor('superadmin', false), '/superadmin')
    assert.equal(homePathFor('teacher', false), '/teacher')
    assert.equal(homePathFor(undefined, false), '/login')
  })

  test('the auth context announces the home screen to the worker and clears it on sign-out', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'src', 'context', 'AuthContext.tsx'), 'utf8')
    assert.match(auth, /announceOfflineHome\(user \? offlineHomeFor\(user\.role\) : null\)/)
    assert.match(auth, /clearLiveDataCache\(\)\s*\n\s*announceOfflineHome\(null\)/)
  })

  test('a cached profile renders the app at once, online or offline', () => {
    const auth = fs.readFileSync(path.join(ROOT, 'src', 'context', 'AuthContext.tsx'), 'utf8')
    const loadingInit = auth.match(/const \[loading, setLoading\] = useState<boolean>\(\(\) => \{([\s\S]*?)\n  \}\)/)
    assert.ok(loadingInit, 'loading initializer not found')
    assert.doesNotMatch(loadingInit[1], /navigator\.onLine/, 'the cached session must not depend on navigator.onLine')
    assert.match(loadingInit[1], /kmms_last_active_user[\s\S]*return false/)
  })
})

// ==================== Service worker v5 ====================

function loadWorker() {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8')
  const listeners = {}
  const context = {
    self: {
      addEventListener: (name, fn) => {
        listeners[name] = fn
      },
      location: { origin: 'https://mms.khendeq.com' },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    location: { origin: 'https://mms.khendeq.com' },
    navigator: { onLine: true },
    caches: {},
    clients: {},
    Response: class {},
    Request: class {},
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  }
  context.self.navigator = context.navigator
  vm.createContext(context)
  vm.runInContext(source, context, { filename: 'sw.js' })
  // Top-level const/let live in the script scope, not on the global object.
  const consts = vm.runInContext('({ CACHE, RSC_CACHE, STATE_CACHE, AREA_ROUTES, PRECACHE_SHELL })', context)
  return { context, consts, listeners, source }
}

describe('Service worker v5 routing helpers', () => {
  const { context, consts, listeners, source } = loadWorker()

  test('the worker registers every lifecycle handler including messages', () => {
    for (const event of ['install', 'activate', 'fetch', 'push', 'notificationclick', 'message']) {
      assert.equal(typeof listeners[event], 'function', `missing ${event} handler`)
    }
  })

  test('the three caches are versioned together and old ones are purged', () => {
    assert.equal(consts.CACHE, 'khendeq-medresah-v5')
    assert.equal(consts.RSC_CACHE, 'khendeq-medresah-rsc-v5')
    assert.equal(consts.STATE_CACHE, 'khendeq-medresah-state-v5')
    assert.match(source, /const keep = \[CACHE, RSC_CACHE, STATE_CACHE\]/)
    const registrar = fs.readFileSync(path.join(ROOT, 'src', 'components', 'ServiceWorkerRegistrar.tsx'), 'utf8')
    assert.match(registrar, /const SW_VERSION = 'v5'/)
  })

  test('the start pages are the ones redirected to the home screen', () => {
    assert.equal(context.isEntryPath('/'), true)
    assert.equal(context.isEntryPath('/login'), true)
    assert.equal(context.isEntryPath('/dashboard'), true)
    assert.equal(context.isEntryPath('/m/khendeq'), true)
    assert.equal(context.isEntryPath('/m/khendeq/'), true)
    assert.equal(context.isEntryPath('/m/khendeq/manifest.webmanifest'), false)
    assert.equal(context.isEntryPath('/teacher'), false)
    assert.equal(context.isEntryPath('/offline.html'), false)
  })

  test('a sign-in page the server bounced to is never redirected (no loop)', () => {
    assert.match(source, /isEntryPath\(url\.pathname\) && !url\.searchParams\.has\('from'\)/)
    assert.match(source, /Response\.redirect\(new URL\(home, self\.location\.origin\)\.href, 302\)/)
  })

  test('only an area path can become the home screen', () => {
    assert.equal(context.areaOf('/teacher/attendance'), '/teacher')
    assert.equal(context.areaOf('/admin'), '/admin')
    assert.equal(context.areaOf('/superadmin'), '/superadmin')
    assert.equal(context.areaOf('/teacherx'), null)
    assert.equal(context.areaOf('/login'), null)
    assert.match(source, /if \(typeof path !== 'string' \|\| path\.charAt\(0\) !== '\/' \|\| !areaOf\(path\)\) return/)
  })

  test('an uncached page falls back to its nearest parent, never to the landing page', () => {
    assert.equal(context.parentPath('/teacher/exams/abc'), '/teacher/exams')
    assert.equal(context.parentPath('/teacher/exams'), '/teacher')
    assert.equal(context.parentPath('/teacher'), null)
    assert.equal(context.parentPath('/'), null)
  })

  test('RSC payloads are keyed by page path, without the per-request ?_rsc marker', () => {
    const url = new URL('https://mms.khendeq.com/teacher/classes?_rsc=1abcd')
    assert.equal(context.rscKey(url), 'https://mms.khendeq.com/teacher/classes')
    assert.match(source, /rsc\.match\(key, \{ ignoreVary: true \}\)/)
  })

  test('a sign-in redirect is never stored under a protected route', () => {
    const ok = { ok: true, redirected: false, url: 'https://mms.khendeq.com/teacher' }
    const bounced = { ok: true, redirected: true, url: 'https://mms.khendeq.com/login?from=/teacher' }
    assert.equal(context.isSamePage(ok, '/teacher'), true)
    assert.equal(context.isSamePage(bounced, '/teacher'), false)
    assert.equal(context.isSamePage({ ok: false, redirected: false, url: 'https://mms.khendeq.com/teacher' }, '/teacher'), false)
  })

  test('offline never waits for a network timeout', () => {
    context.navigator.onLine = false
    assert.equal(context.isOffline(), true)
    context.navigator.onLine = true
    assert.equal(context.isOffline(), false)
    assert.match(source, /if \(!isOffline\(\)\) \{\s*\n\s*try \{\s*\n\s*const response = await fetchWithTimeout\(request, NAV_TIMEOUT_MS\)/)
  })

  test('every area route the worker precaches exists in the App Router', () => {
    const routes = Object.values(consts.AREA_ROUTES).flat()
    assert.ok(routes.includes('/teacher/classes'))
    assert.ok(routes.includes('/teacher/requests'))
    for (const route of routes) {
      const pageFile = path.join(ROOT, 'src', 'app', ...route.replace(/^\//, '').split('/'), 'page.tsx')
      assert.ok(fs.existsSync(pageFile), `AREA_ROUTES precaches "${route}" but ${pageFile} does not exist`)
    }
  })

  test('protected routes are no longer precached at install (they would be the sign-in page)', () => {
    for (const entry of consts.PRECACHE_SHELL) {
      assert.equal(context.areaOf(entry), null, `${entry} must not be precached before sign-in`)
    }
  })
})
