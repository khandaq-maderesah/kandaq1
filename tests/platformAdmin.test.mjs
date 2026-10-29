import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { computeSchoolFigures, computePlatformTotals, attendanceRate, dateDaysAgo, REPORT_CARDS } = await import('../src/lib/platformStats.ts')
const { effectiveListsMode, resolveRegistrationOptions, DEFAULT_REGISTRATION_OPTIONS } = await import('../src/lib/registration.ts')

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

describe('Platform figures for the super admin', () => {
  const school = { id: 's1', name: 'Al-Huda', status: 'active' }
  const users = [
    { uid: 'u1', schoolId: 's1', role: 'teacher' },
    { uid: 'u2', schoolId: 's1', role: 'teacher' },
    { uid: 'u3', schoolId: 's1', role: 'admin' },
    { uid: 'u4', schoolId: 's2', role: 'teacher' },
    { uid: 'u5', role: 'superadmin' },
  ]
  const snapshot = {
    students: [
      { id: 'a', isActive: true, gender: 'male', father: { status: 'deceased' } },
      { id: 'b', isActive: true, gender: 'female' },
      { id: 'c', isActive: false, gender: 'female', mother: { status: 'deceased' } },
    ],
    classes: [
      { id: 'c1', teacherId: 'u1' },
      { id: 'c2', teacherIds: { u2: true } },
      { id: 'c3' },
    ],
    attendance: [
      { status: 'present' },
      { status: 'late' },
      { status: 'absent' },
      { status: 'excused' },
    ],
  }

  test('counts active students, Ustazes of that medreseh, classes and orphans', () => {
    const f = computeSchoolFigures(school, users, snapshot)
    assert.equal(f.students, 2, 'archived students are not counted')
    assert.equal(f.male, 1)
    assert.equal(f.female, 1)
    assert.equal(f.orphans, 1)
    assert.equal(f.ustazes, 2)
    assert.equal(f.admins, 1)
    assert.equal(f.classes, 3)
    assert.equal(f.classesWithoutUstaz, 1)
  })

  test('attendance rate counts present and late as came, ignores excused', () => {
    const f = computeSchoolFigures(school, users, snapshot)
    assert.equal(f.attended, 2)
    assert.equal(f.absent, 1)
    assert.equal(f.attendanceRate, 66.7)
    assert.equal(attendanceRate(0, 0), null)
  })

  test('a medreseh that could not be read shows zero data and is flagged', () => {
    const f = computeSchoolFigures(school, users, undefined)
    assert.equal(f.loaded, false)
    assert.equal(f.students, 0)
    assert.equal(f.ustazes, 2)
  })

  test('totals add up every medreseh', () => {
    const a = computeSchoolFigures(school, users, snapshot)
    const b = computeSchoolFigures({ id: 's2', name: 'Al-Noor', status: 'suspended' }, users, snapshot)
    const t = computePlatformTotals([a, b])
    assert.equal(t.medresehs, 2)
    assert.equal(t.suspended, 1)
    assert.equal(t.students, 4)
    assert.equal(t.classes, 6)
    assert.equal(t.ustazes, 3)
  })

  test('the report offers six cards and dates count back from today', () => {
    assert.deepEqual([...REPORT_CARDS], ['overview', 'students', 'staff', 'classes', 'orphans', 'attendance'])
    assert.equal(dateDaysAgo(30, new Date('2026-10-31T10:00:00Z')), '2026-10-01')
  })
})

describe('Platform dropdown lists', () => {
  const platform = { kitabs: ['Platform kitab'], quranLevels: ['Platform level'] }
  const own = { kitabs: ['Own kitab'] }

  test('a medreseh with nothing chosen follows the platform lists, an older one with its own keeps them', () => {
    assert.equal(effectiveListsMode(undefined, false), 'platform')
    assert.equal(effectiveListsMode(undefined, true), 'own')
    assert.equal(effectiveListsMode('platform', true), 'platform')
    assert.equal(effectiveListsMode('own', false), 'own')
  })

  test('platform mode uses the super admin lists and falls back to the built-in starter lists', () => {
    const lists = resolveRegistrationOptions({ platform, own, mode: 'platform' })
    assert.deepEqual(lists.kitabs, ['Platform kitab'])
    assert.deepEqual(lists.results, DEFAULT_REGISTRATION_OPTIONS.results)
  })

  test('own mode uses the medreseh lists and fills anything unset from the platform', () => {
    const lists = resolveRegistrationOptions({ platform, own, mode: 'own' })
    assert.deepEqual(lists.kitabs, ['Own kitab'])
    assert.deepEqual(lists.quranLevels, ['Platform level'])
  })

  test('new medresehs (no choice, no own lists) get the platform lists', () => {
    const lists = resolveRegistrationOptions({ platform, own: null, mode: undefined })
    assert.deepEqual(lists.kitabs, ['Platform kitab'])
  })

  test('rules: only the super admin writes the platform lists and the mode', () => {
    const rules = JSON.parse(read('database.rules.json')).rules
    assert.equal(rules.platformSettings['.read'], 'auth != null')
    assert.match(rules.platformSettings['.write'], /superadmin/)
    const mode = rules.schoolInfo.$schoolId.listsMode['.validate']
    assert.match(mode, /'platform'.*'own'/)
    assert.match(mode, /superadmin/)
  })
})

describe('Menus and email changes', () => {
  test('the Ustaz menu no longer lists the weekly report; the super admin has Reports and Lists', () => {
    const nav = read('src/components/shell/nav.ts')
    const teacher = nav.slice(nav.indexOf('export const teacherNav'), nav.indexOf('export const superadminNav'))
    assert.doesNotMatch(teacher, /weeklyReport/)
    const superadmin = nav.slice(nav.indexOf('export const superadminNav'))
    assert.match(superadmin, /\/superadmin\/reports/)
    assert.match(superadmin, /\/superadmin\/lists/)
  })

  test('the Reports page reads nothing until Generate report is pressed', () => {
    const page = read('src/app/superadmin/reports/page.tsx')
    assert.match(page, /usePlatformFigures\(\{ auto: false \}\)/)
    assert.match(page, /await refresh\(\)\s+\/\/ Keep the cards/)
    const hook = read('src/hooks/usePlatformFigures.ts')
    assert.match(hook, /if \(auto\) void load\(\)/)
  })

  test('an admin may change an Ustaz email, only the super admin an admin email', () => {
    const route = read('src/app/api/admin/users/[uid]/route.ts')
    assert.match(route, /caller\.role === 'superadmin' \? user\.role !== 'superadmin' : user\.role === 'teacher'/)
    assert.match(route, /getAuth\(\)\.updateUser\(uid, \{ email \}\)/)
    assert.match(route, /users\/\$\{uid\}\/email/)
  })
})
