import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const {
  getOfflineAttendanceQueue,
  enqueueOfflineAttendance,
  clearOfflineAttendanceQueue,
  syncOfflineAttendance,
  isBrowserOnline,
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
    assert.ok(routes.length >= 4, 'Expected the app shell routes to be precached')

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

  test('the offline navigation fallback targets a precached route', () => {
    const fallback = sw.match(/request\.mode === 'navigate'[\s\S]*?cache\.match\('([^']+)'\)/)?.[1]
    assert.ok(fallback, 'No navigation fallback route found')
    assert.ok(
      precacheShell().includes(fallback),
      `Navigation fallback "${fallback}" is not part of the precache shell`
    )
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

  test('the Ustaz roster and class list are cached for offline marking', () => {
    const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))
    assert.ok(page.includes('kmms_teacher_classes_'), 'Class list must be cached for offline use')
    assert.ok(page.includes('kmms_class_students_'), 'Student roster must be cached for offline use')
  })

  test('an offline save falls back to the device queue when the cloud write fails', () => {
    const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))
    const catchIndex = page.indexOf('catch {')
    const enqueueIndex = page.indexOf('enqueueOfflineAttendance(recordsToEnqueue)', catchIndex)
    assert.ok(catchIndex > -1 && enqueueIndex > catchIndex, 'Network failure must fall back to the offline queue')
  })
})
