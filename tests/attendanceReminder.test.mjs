import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  isSunday,
  todayStr,
  currentHHMM,
  isPastHHMM,
  detectMissingAttendance,
  ADMIN_NOTIFY_TIME,
  TEACHER_NOTIFY_TIME,
} = await import('../src/lib/attendanceReminder.ts')

describe('Attendance Reminder Logic & Detectors', () => {
  test('isSunday correctly detects Sundays', () => {
    // 2026-10-18 was a Sunday
    const sunday = new Date('2026-10-18T10:00:00Z')
    assert.equal(isSunday(sunday), true)

    // 2026-10-19 was a Monday
    const monday = new Date('2026-10-19T10:00:00Z')
    assert.equal(isSunday(monday), false)
  })

  test('todayStr returns valid YYYY-MM-DD string', () => {
    const s = todayStr()
    assert.match(s, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('currentHHMM returns valid 24h time string', () => {
    const hhmm = currentHHMM()
    assert.match(hhmm, /^\d{2}:\d{2}$/)
  })

  test('isPastHHMM correctly evaluates time boundaries', () => {
    const morning = new Date('2026-10-19T09:00:00')
    const evening = new Date('2026-10-19T19:00:00')

    assert.equal(isPastHHMM('18:00', morning), false)
    assert.equal(isPastHHMM('18:00', evening), true)
  })

  test('detectMissingAttendance flags active classes without records', () => {
    const mockDate = new Date('2026-10-19T12:00:00Z')
    const today = todayStr(mockDate)

    const classes = [
      { id: 'c1', name: 'Quran 1A', teacherId: 'u1', isActive: true },
      { id: 'c2', name: 'Fiqh 2B', teacherId: 'u2', isActive: true },
      { id: 'c3', name: 'Inactive Class', teacherId: 'u3', isActive: false },
      { id: 'c4', name: 'Unassigned Class', teacherId: '', isActive: true },
    ]

    const users = [
      { uid: 'u1', name: 'Ustaz Ahmed', role: 'teacher' },
      { uid: 'u2', name: 'Ustaz Bilal', role: 'teacher' },
    ]

    // Only class c1 has an attendance record today
    const attendance = [
      { id: 'a1', classId: 'c1', date: today, studentId: 's1', status: 'present' },
    ]

    const missing = detectMissingAttendance(classes, attendance, users, mockDate)

    assert.equal(missing.length, 1)
    assert.equal(missing[0].classId, 'c2')
    assert.equal(missing[0].className, 'Fiqh 2B')
    assert.equal(missing[0].teacherName, 'Ustaz Bilal')
  })
})
