import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { checkInId, buildPresenceRows, presenceSummary, filterPresence } = await import('../src/lib/teacherCheckIn.ts')
const { STUDENT_OCCUPATIONS, isStudentOccupation } = await import('../src/lib/registration.ts')

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** An Ustaz taps "I am in class" once per class and day; the admin sees who is missing. */
describe('Ustaz presence', () => {
  const users = [
    { uid: 'u1', name: 'Ustaz One', phone: '0911' },
    { uid: 'u2', name: 'Ustaz Two' },
  ]
  const classes = [
    { id: 'c1', name: 'Level 1', section: 'A', teacherId: 'u1', isActive: true },
    { id: 'c2', name: 'Level 2', teacherId: 'u1', teacherIds: { u1: true, u2: true }, isActive: true },
    { id: 'c3', name: 'Old', teacherId: 'u1', isActive: false },
    { id: 'c4', name: 'Nobody', isActive: true },
  ]
  const date = '2026-10-30'

  test('one check-in id per Ustaz, class and day', () => {
    assert.equal(checkInId(date, 'c1', 'u1'), '2026-10-30_c1_u1')
    assert.notEqual(checkInId(date, 'c1', 'u1'), checkInId(date, 'c2', 'u1'))
  })

  test('one row per Ustaz of every active class with an Ustaz', () => {
    const rows = buildPresenceRows({ classes, users, checkIns: [], attendance: [], date })
    assert.deepEqual(rows.map((r) => r.key).sort(), ['c1:u1', 'c2:u1', 'c2:u2'])
    assert.ok(rows.every((r) => r.checkedInAt === null))
  })

  test('a check-in marks only that Ustaz in that class', () => {
    const rows = buildPresenceRows({
      classes,
      users,
      checkIns: [{ classId: 'c2', teacherId: 'u1', checkedInAt: 1000 }],
      attendance: [],
      date,
    })
    const by = Object.fromEntries(rows.map((r) => [r.key, r.checkedInAt]))
    assert.deepEqual(by, { 'c1:u1': null, 'c2:u1': 1000, 'c2:u2': null })
    assert.deepEqual(presenceSummary(rows), { total: 3, inClass: 1, notYet: 2 })
    // Those not yet in class come first: that is who the admin acts on.
    assert.equal(rows[rows.length - 1].key, 'c2:u1')
  })

  test('attendance counts as taken only for that day', () => {
    const rows = buildPresenceRows({
      classes,
      users,
      checkIns: [],
      attendance: [{ classId: 'c1', date }, { classId: 'c2', date: '2026-10-29' }],
      date,
    })
    assert.equal(rows.find((r) => r.key === 'c1:u1').attendanceTaken, true)
    assert.equal(rows.find((r) => r.key === 'c2:u1').attendanceTaken, false)
  })

  test('filters by status and by name or class', () => {
    const rows = buildPresenceRows({
      classes,
      users,
      checkIns: [{ classId: 'c1', teacherId: 'u1', checkedInAt: 5 }],
      attendance: [],
      date,
    })
    assert.equal(filterPresence(rows, 'inClass').length, 1)
    assert.equal(filterPresence(rows, 'notYet').length, 2)
    assert.deepEqual(filterPresence(rows, 'all', 'two').map((r) => r.teacherId), ['u2'])
    assert.deepEqual(filterPresence(rows, 'all', 'level 1').map((r) => r.key), ['c1:u1'])
  })

  test('rules: an Ustaz may only create their own check-in, for their class, with the server time', () => {
    const rules = JSON.parse(read('database.rules.json')).rules.schoolData.$schoolId.teacherCheckIns
    assert.match(rules['.read'], /schoolId/)
    assert.deepEqual(rules['.indexOn'], ['date', 'teacherId'])
    const write = rules.$id['.write']
    assert.match(write, /!data\.exists\(\)/)
    assert.match(write, /newData\.child\('teacherId'\)\.val\(\) === auth\.uid/)
    assert.match(write, /\$id === newData\.child\('date'\)\.val\(\) \+ '_' \+ newData\.child\('classId'\)\.val\(\) \+ '_' \+ auth\.uid/)
    assert.match(write, /newData\.child\('checkedInAt'\)\.val\(\) === now/)
    assert.match(write, /teacherIds\//)
    assert.match(write, /'admin'/)
  })

  test('the Ustaz dashboard shows the button, the admin board lists the Ustazes', () => {
    assert.match(read('src/app/teacher/page.tsx'), /<CheckInCard/)
    assert.match(read('src/app/admin/attendance/page.tsx'), /<UstazAttendanceMonitor/)
    assert.match(read('src/lib/database/index.ts'), /checkedInAt: serverTimestamp\(\)/)
  })
})

describe('Student occupation', () => {
  test('a short fixed list, older free text still recognised as not on it', () => {
    assert.deepEqual([...STUDENT_OCCUPATIONS], ['student', 'working', 'notWorking'])
    assert.equal(isStudentOccupation('working'), true)
    assert.equal(isStudentOccupation('Trader'), false)
    assert.equal(isStudentOccupation(undefined), false)
  })
})
