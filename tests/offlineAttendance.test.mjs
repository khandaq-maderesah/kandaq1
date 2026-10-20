import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getOfflineAttendanceQueue,
  enqueueOfflineAttendance,
  removeSyncedRecords,
  clearOfflineAttendanceQueue,
  syncOfflineAttendance,
  isBrowserOnline,
} from '../src/lib/offlineAttendance.ts'

// Polyfill window.localStorage for Node test runner
const memoryStorage = new Map()
globalThis.window = {
  navigator: { onLine: true },
}
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
}

// The offline engine reads the global `navigator`, not `window.navigator`.
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
  writable: true,
})

const STORAGE_KEY = 'kmms_offline_attendance_queue'

function setOnline(onLine) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine },
    configurable: true,
    writable: true,
  })
}

test('Offline Attendance Queue: initial queue is empty', () => {
  clearOfflineAttendanceQueue()
  const queue = getOfflineAttendanceQueue()
  assert.deepEqual(queue, [])
})

test('Offline Attendance Queue: enqueue and deduplicate records by id', () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'class1_2026-10-20_student1',
      studentId: 'student1',
      classId: 'class1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'class1_2026-10-20_student2',
      studentId: 'student2',
      classId: 'class1',
      date: '2026-10-20',
      status: 'absent',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  let queue = getOfflineAttendanceQueue()
  assert.equal(queue.length, 2)
  assert.equal(queue.find((r) => r.studentId === 'student1').status, 'present')

  // Update status for student1 (same id)
  enqueueOfflineAttendance([
    {
      id: 'class1_2026-10-20_student1',
      studentId: 'student1',
      classId: 'class1',
      date: '2026-10-20',
      status: 'late',
      timestamp: 2000,
      retryCount: 0,
    },
  ])

  queue = getOfflineAttendanceQueue()
  assert.equal(queue.length, 2, 'Queue length should remain 2 after update')
  assert.equal(queue.find((r) => r.studentId === 'student1').status, 'late', 'Status updated')
})

test('Offline Attendance Queue: removeSyncedRecords removes only completed records', () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'rec_1',
      studentId: 's1',
      classId: 'c1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'rec_2',
      studentId: 's2',
      classId: 'c1',
      date: '2026-10-20',
      status: 'absent',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  removeSyncedRecords(['rec_1'])
  const remaining = getOfflineAttendanceQueue()
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].id, 'rec_2')
})

test('Offline Attendance Sync: syncOfflineAttendance syncs successfully and empties queue', async () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'rec_10',
      studentId: 's10',
      classId: 'c1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'rec_11',
      studentId: 's11',
      classId: 'c1',
      date: '2026-10-20',
      status: 'excused',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  const syncedList = []
  const result = await syncOfflineAttendance(async (record) => {
    syncedList.push(record.id)
  })

  assert.equal(result.total, 2)
  assert.equal(result.synced, 2)
  assert.equal(result.failed, 0)
  assert.deepEqual(syncedList, ['rec_10', 'rec_11'])
  assert.equal(getOfflineAttendanceQueue().length, 0)
})

test('Offline Attendance Sync: preserves failed records for subsequent retry', async () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'rec_pass',
      studentId: 'sp',
      classId: 'c1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'rec_fail',
      studentId: 'sf',
      classId: 'c1',
      date: '2026-10-20',
      status: 'absent',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  const result = await syncOfflineAttendance(async (record) => {
    if (record.id === 'rec_fail') {
      throw new Error('Network timeout simulating offline glitch')
    }
  })

  assert.equal(result.total, 2)
  assert.equal(result.synced, 1)
  assert.equal(result.failed, 1)

  const queue = getOfflineAttendanceQueue()
  assert.equal(queue.length, 1)
  assert.equal(queue[0].id, 'rec_fail')
})

test('Browser online status helper returns boolean', () => {
  assert.equal(typeof isBrowserOnline(), 'boolean')
})

// ==================== Implementer (Kilo AI) hardening additions ====================

test('Offline Attendance Queue: corrupted storage payload is ignored instead of crashing', () => {
  clearOfflineAttendanceQueue()
  memoryStorage.set(STORAGE_KEY, '{not-valid-json')
  assert.deepEqual(getOfflineAttendanceQueue(), [])

  memoryStorage.set(STORAGE_KEY, JSON.stringify({ student1: { id: 'x' } }))
  assert.deepEqual(getOfflineAttendanceQueue(), [])

  memoryStorage.delete(STORAGE_KEY)
})

test('Offline Attendance Queue: records for different classes and students coexist', () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'class1_2026-10-20_student1',
      studentId: 'student1',
      classId: 'class1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'class1_2026-10-20_student2',
      studentId: 'student2',
      classId: 'class1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
    {
      id: 'class2_2026-10-20_student1',
      studentId: 'student1',
      classId: 'class2',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  assert.equal(getOfflineAttendanceQueue().length, 3)
})

test('Offline Attendance Queue: optional owner fields survive the storage round trip', () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'class1_2026-10-20_student1',
      studentId: 'student1',
      classId: 'class1',
      date: '2026-10-20',
      status: 'present',
      studentName: 'Abdi',
      className: 'Fiqh',
      teacherId: 'ustaz-uid',
      markedBy: 'ustaz-uid',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  const queued = getOfflineAttendanceQueue()[0]
  assert.equal(queued.teacherId, 'ustaz-uid')
  assert.equal(queued.markedBy, 'ustaz-uid')
  assert.equal(queued.studentName, 'Abdi')
  assert.equal(queued.className, 'Fiqh')
})

test('Offline Attendance Sync: the queued payload is delivered to the submit function unchanged', async () => {
  clearOfflineAttendanceQueue()
  const original = {
    id: 'rec_payload',
    studentId: 's1',
    classId: 'c1',
    date: '2026-10-20',
    status: 'late',
    studentName: 'Fatima',
    className: 'Tafseer',
    teacherId: 'ustaz-uid',
    markedBy: 'ustaz-uid',
    timestamp: 1792480000000,
    retryCount: 0,
  }
  enqueueOfflineAttendance([original])

  let received
  await syncOfflineAttendance(async (record) => {
    received = record
  })

  assert.deepEqual(received, original)
})

test('Offline Attendance Sync: a non-Error rejection is reported instead of crashing the queue', async () => {
  clearOfflineAttendanceQueue()
  enqueueOfflineAttendance([
    {
      id: 'rec_string_error',
      studentId: 's1',
      classId: 'c1',
      date: '2026-10-20',
      status: 'present',
      timestamp: 1000,
      retryCount: 0,
    },
  ])

  const result = await syncOfflineAttendance(async () => {
    throw 'offline'
  })

  assert.equal(result.total, 1)
  assert.equal(result.synced, 0)
  assert.equal(result.failed, 1)
  assert.equal(result.errors.length, 1)
  assert.equal(getOfflineAttendanceQueue().length, 1)
})

test('Browser online status helper reflects the browser connectivity API', () => {
  setOnline(false)
  assert.equal(isBrowserOnline(), false)
  setOnline(true)
  assert.equal(isBrowserOnline(), true)
})

test('Offline Attendance Queue: every storage helper is a no-op without browser storage', () => {
  const savedWindow = globalThis.window
  const savedStorage = globalThis.localStorage
  delete globalThis.window
  delete globalThis.localStorage

  try {
    assert.deepEqual(getOfflineAttendanceQueue(), [])
    enqueueOfflineAttendance([
      {
        id: 'ssr_record',
        studentId: 's1',
        classId: 'c1',
        date: '2026-10-20',
        status: 'present',
        timestamp: 1000,
        retryCount: 0,
      },
    ])
    assert.deepEqual(getOfflineAttendanceQueue(), [])
    removeSyncedRecords(['ssr_record'])
    clearOfflineAttendanceQueue()
    assert.equal(isBrowserOnline(), true)
  } finally {
    globalThis.window = savedWindow
    globalThis.localStorage = savedStorage
  }
})
