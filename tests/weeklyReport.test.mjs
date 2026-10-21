import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const {
  weekStartOf,
  weekDays,
  isSaturday,
  reportWeekFor,
  sessionLogId,
  weeklyReportId,
  sessionsAnswered,
  answersFromLog,
  emptyWeeklyReport,
  normalizeWeeklyReport,
  weeklyReportProblems,
} = await import('../src/lib/weeklyReport.ts')

const { getOfflineSessionQueue, enqueueOfflineSession, syncOfflineSessions } = await import(
  '../src/lib/offlineSessions.ts'
)

/**
 * Daily session log + weekly report, as agreed with the owner: two sessions a
 * day (Qur'an, then Kitab; Saturday's second is the review), Monday to
 * Saturday; the Ustaz must say whether each was held when taking attendance;
 * the weekly report is per class, submitted on Saturday, locked after that.
 */

describe('Weeks run Monday to Saturday', () => {
  test('a date maps to the Monday of its week; Sunday belongs to the week before', () => {
    assert.equal(weekStartOf('2026-10-21'), '2026-10-19') // Wednesday
    assert.equal(weekStartOf('2026-10-19'), '2026-10-19') // Monday
    assert.equal(weekStartOf('2026-10-24'), '2026-10-19') // Saturday
    assert.equal(weekStartOf('2026-10-25'), '2026-10-19') // Sunday
  })

  test('a week has six school days, Monday to Saturday', () => {
    const days = weekDays('2026-10-19')
    assert.equal(days.length, 6)
    assert.equal(days[0], '2026-10-19')
    assert.equal(days[5], '2026-10-24')
    assert.equal(isSaturday(days[5]), true)
    assert.equal(isSaturday(days[0]), false)
  })

  test('the report due is this week on Saturday/Sunday, otherwise last week', () => {
    assert.equal(reportWeekFor('2026-10-24'), '2026-10-19') // Saturday
    assert.equal(reportWeekFor('2026-10-25'), '2026-10-19') // Sunday
    assert.equal(reportWeekFor('2026-10-21'), '2026-10-12') // Wednesday
  })

  test('ids are per class and day / per class and week', () => {
    assert.equal(sessionLogId('c1', '2026-10-21'), 'c1_2026-10-21')
    assert.equal(weeklyReportId('c1', '2026-10-19'), 'c1_2026-10-19')
  })
})

describe('Daily session answers are required', () => {
  test('both sessions must be answered (held or not held) before attendance can be saved', () => {
    assert.equal(sessionsAnswered({ quran: null, kitab: null }), false)
    assert.equal(sessionsAnswered({ quran: true, kitab: null }), false)
    assert.equal(sessionsAnswered({ quran: true, kitab: false }), true)
    assert.equal(sessionsAnswered({ quran: false, kitab: false }), true)
  })

  test('a saved log fills the answers; no log leaves them unanswered', () => {
    assert.deepEqual(answersFromLog(undefined), { quran: null, kitab: null })
    assert.deepEqual(
      answersFromLog({ id: 'c1_2026-10-21', classId: 'c1', date: '2026-10-21', teacherId: 'u1', quran: true, kitab: false, markedAt: '' }),
      { quran: true, kitab: false }
    )
  })
})

describe('Weekly report submission rules', () => {
  const log = (date, quran, kitab) => ({ id: `c1_${date}`, classId: 'c1', date, teacherId: 'u1', quran, kitab, markedAt: '' })

  test('a fresh report has an entry for each of the six days and is a draft', () => {
    const r = emptyWeeklyReport('c1', 'u1', '2026-10-19')
    assert.equal(r.id, 'c1_2026-10-19')
    assert.equal(Object.keys(r.days).length, 6)
    assert.equal(r.status, 'draft')
  })

  test('only sessions that were held need an entry; the review is always needed', () => {
    const r = emptyWeeklyReport('c1', 'u1', '2026-10-19')
    const logs = {
      'c1_2026-10-19': log('2026-10-19', true, true),
      'c1_2026-10-20': log('2026-10-20', false, false),
      'c1_2026-10-24': log('2026-10-24', true, true), // Saturday: second session is the review
    }
    assert.deepEqual(weeklyReportProblems(r, logs), [
      '2026-10-19.quran',
      '2026-10-19.kitab',
      '2026-10-19.topic',
      '2026-10-24.quran',
      'review',
    ])
    r.days['2026-10-19'] = { quran: 'Al-Baqarah 1-20', kitab: "Safinat al-Najah", topic: 'Wudu' }
    r.days['2026-10-24'] = { quran: 'Revision', kitab: '', topic: '' }
    r.review = 'Good week'
    assert.deepEqual(weeklyReportProblems(r, logs), [])
  })

  test('days without any attendance log need nothing', () => {
    const r = emptyWeeklyReport('c1', 'u1', '2026-10-19')
    r.review = 'x'
    assert.deepEqual(weeklyReportProblems(r, {}), [])
  })

  test('a stored report with missing days is completed for the form', () => {
    const r = normalizeWeeklyReport({ ...emptyWeeklyReport('c1', 'u1', '2026-10-19'), days: {}, review: undefined, status: undefined })
    assert.equal(Object.keys(r.days).length, 6)
    assert.equal(r.review, '')
    assert.equal(r.status, 'draft')
  })
})

describe('Session logs queue offline and sync later', () => {
  const map = new Map()
  beforeEach(() => {
    map.clear()
    globalThis.window = globalThis.window ?? {}
    globalThis.localStorage = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    }
  })
  afterEach(() => {
    delete globalThis.window
    delete globalThis.localStorage
  })

  test('a log for the same class and day replaces the queued one; synced logs leave the queue', async () => {
    enqueueOfflineSession({ id: 'c1_2026-10-21', classId: 'c1', date: '2026-10-21', teacherId: 'u1', quran: true, kitab: false, markedAt: '1' })
    enqueueOfflineSession({ id: 'c1_2026-10-21', classId: 'c1', date: '2026-10-21', teacherId: 'u1', quran: true, kitab: true, markedAt: '2' })
    enqueueOfflineSession({ id: 'c1_2026-10-22', classId: 'c1', date: '2026-10-22', teacherId: 'u1', quran: false, kitab: false, markedAt: '3' })
    assert.equal(getOfflineSessionQueue().length, 2)
    assert.equal(getOfflineSessionQueue()[0].kitab, true)
    const sent = []
    const result = await syncOfflineSessions(async (log) => {
      if (log.id === 'c1_2026-10-22') throw new Error('network')
      sent.push(log.id)
    })
    assert.deepEqual(sent, ['c1_2026-10-21'])
    assert.deepEqual(result, { total: 2, synced: 1, failed: 1 })
    assert.deepEqual(getOfflineSessionQueue().map((l) => l.id), ['c1_2026-10-22'])
  })
})

describe('Wiring', () => {
  const ROOT = path.resolve('.')
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

  test('attendance cannot be saved without the session answers, online or offline', () => {
    const page = read('src/app/teacher/attendance/page.tsx')
    assert.match(page, /if \(!sessionsAnswered\(answers\)\)/)
    assert.equal((page.match(/enqueueOfflineSession\(sessionLog\(\)\)/g) || []).length, 2, 'queued offline and on a failed save')
    assert.match(page, /await rtdb\.setSessionLog\(sessionLog\(\)\)/)
    const sync = read('src/hooks/useOfflineAttendanceSync.ts')
    assert.match(sync, /syncOfflineSessions\(\(log\) => rtdb\.setSessionLog\(log\)\)/)
  })

  test('rules: an Ustaz writes session logs and reports only for their own class, never a submitted report', () => {
    const rules = read('database.rules.json')
    const sessions = rules.match(/"\$sessionId":\s*\{\s*"\.write":\s*"([^"]+)"/)?.[1]
    assert.ok(sessions, 'sessions write rule missing')
    assert.match(sessions, /newData\.child\('teacherId'\)\.val\(\) === auth\.uid/)
    assert.match(sessions, /classes\/' \+ newData\.child\('classId'\)\.val\(\) \+ '\/teacherId'\)\.val\(\) === auth\.uid/)
    const reports = rules.match(/"\$reportId":\s*\{\s*"\.write":\s*"([^"]+)"/)?.[1]
    assert.ok(reports, 'weeklyReports write rule missing')
    assert.match(reports, /\$teacherId === auth\.uid/)
    assert.match(reports, /data\.child\('status'\)\.val\(\) !== 'submitted'/)
    const teacherRead = rules.match(/"\$teacherId":\s*\{\s*"\.read":\s*"([^"]+)"/)?.[1]
    assert.match(teacherRead, /\$teacherId === auth\.uid/)
  })

  test('the new screens are in the navigation and precached by the worker', () => {
    const nav = read('src/components/shell/nav.ts')
    assert.match(nav, /href: '\/teacher\/reports', label: 'weeklyReport'/)
    assert.match(nav, /href: '\/admin\/weekly-reports', label: 'weeklyReports'.*badge: 'missingReports'/)
    const sw = read('public/sw.js')
    assert.match(sw, /'\/teacher\/reports'/)
    assert.match(sw, /'\/admin\/weekly-reports'/)
    assert.ok(fs.existsSync(path.join(ROOT, 'src/app/teacher/reports/page.tsx')))
    assert.ok(fs.existsSync(path.join(ROOT, 'src/app/admin/weekly-reports/page.tsx')))
  })
})
