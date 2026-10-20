import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const {
  getOfflineAttendanceQueue,
  enqueueOfflineAttendance,
  clearOfflineAttendanceQueue,
  syncOfflineAttendance,
} = await import('../src/lib/offlineAttendance.ts')

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

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

describe('Offline sync retry accounting', () => {
  let storage

  beforeEach(() => {
    storage = createStorage()
    installBrowser(storage)
    clearOfflineAttendanceQueue()
  })

  afterEach(() => {
    uninstallBrowser()
  })

  test('a failed record gets its retry counter incremented', async () => {
    enqueueOfflineAttendance([makeRecord(1)])

    const result = await syncOfflineAttendance(async () => {
      throw new Error('network down')
    })

    assert.equal(result.failed, 1)
    const queued = getOfflineAttendanceQueue()
    assert.equal(queued.length, 1)
    assert.equal(queued[0].retryCount, 1)
  })

  test('the retry counter keeps growing while the network stays down', async () => {
    enqueueOfflineAttendance([makeRecord(1)])

    await syncOfflineAttendance(async () => {
      throw new Error('network down')
    })
    await syncOfflineAttendance(async () => {
      throw new Error('network down')
    })

    assert.equal(getOfflineAttendanceQueue()[0].retryCount, 2)
  })

  test('only the failed records are counted, the synced ones leave the queue', async () => {
    enqueueOfflineAttendance([makeRecord(1), makeRecord(2)])

    const result = await syncOfflineAttendance(async (record) => {
      if (record.studentId === 'student2') throw new Error('network down')
    })

    assert.equal(result.synced, 1)
    assert.equal(result.failed, 1)

    const queued = getOfflineAttendanceQueue()
    assert.equal(queued.length, 1)
    assert.equal(queued[0].studentId, 'student2')
    assert.equal(queued[0].retryCount, 1)
  })

  test('a record that syncs later leaves the queue and is not retried again', async () => {
    enqueueOfflineAttendance([makeRecord(1)])

    await syncOfflineAttendance(async () => {
      throw new Error('network down')
    })
    const second = await syncOfflineAttendance(async () => {})

    assert.equal(second.synced, 1)
    assert.equal(second.failed, 0)
    assert.equal(getOfflineAttendanceQueue().length, 0)
  })

  test('a fresh mark resets the retry counter for that student', () => {
    enqueueOfflineAttendance([makeRecord(1, { retryCount: 3 })])
    enqueueOfflineAttendance([makeRecord(1, { status: 'late', retryCount: 0 })])

    const queued = getOfflineAttendanceQueue()
    assert.equal(queued.length, 1)
    assert.equal(queued[0].status, 'late')
    assert.equal(queued[0].retryCount, 0)
  })
})

describe('Cloud write safety during sync', () => {
  const hook = read(path.join('src', 'hooks', 'useOfflineAttendanceSync.ts'))
  const page = read(path.join('src', 'app', 'teacher', 'attendance', 'page.tsx'))

  test('the sync hook updates an existing attendance record instead of overwriting it', () => {
    assert.match(
      hook,
      /rtdb\.updateAttendance\(record\.id/,
      'Synced records must be patched so notes and excuse notes survive'
    )
    assert.match(
      hook,
      /rtdb\.createAttendance\(record\.id/,
      'New attendance records are still created'
    )
  })

  test('the sync hook looks the existing records up once per class and day', () => {
    assert.match(
      hook,
      /rtdb\.getAttendanceByClassAndDate\(/,
      'A batched lookup keeps a full roster fast on a weak connection'
    )
  })

  test('the Ustaz attendance page keeps the update-if-exists branch', () => {
    assert.match(page, /await rtdb\.getAttendance\(attendanceId\)/)
    assert.match(page, /await rtdb\.updateAttendance\(attendanceId/)
    assert.match(page, /await rtdb\.createAttendance\(attendanceId/)
  })

  test('a pending queue is synced automatically when the app opens online', () => {
    assert.match(
      hook,
      /if \(isBrowserOnline\(\) && getOfflineAttendanceQueue\(\)\.length > 0\)/,
      'The hook must sync a pending queue on mount'
    )
  })
})
