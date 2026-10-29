import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const {
  emptyRegistration,
  missingRegistrationFields,
  registrationToStudentFields,
  registrationFromStudent,
  orphanKind,
  isReachable,
  supportToRecord,
  supportFromRecord,
  supportNeedsReview,
  emptySupport,
} = await import('../src/lib/registration.ts')
const { buildSupportRows, countSupportRows, filterSupportRows } = await import('../src/lib/supportList.ts')

/**
 * Parent status, the caregiver and the private help assessment, as agreed with
 * the owner: a deceased/absent parent needs no details; when neither parent can
 * be contacted a caregiver must be named; the help assessment is a private
 * record kept only while the family needs help.
 */

function livingRegistration() {
  const r = emptyRegistration()
  r.quranLevel = 'Juz Amma'
  for (const who of ['father', 'mother']) {
    r[who].name = who === 'father' ? 'Ahmed Ali' : 'Fatima Hassan'
    r[who].phone = who === 'father' ? '0911000001' : '0911000002'
    r[who].occupation = 'Trader'
    r[who].educationLevel = 'Degree'
    r[who].quranLevel = 'Hifz - 5 Juz'
  }
  return r
}

describe('Parent status: required fields', () => {
  test('a deceased father needs no details, the living mother still does', () => {
    const r = livingRegistration()
    r.father = { ...emptyRegistration().father, status: 'deceased' }
    assert.deepEqual(missingRegistrationFields(r), [])
    r.mother.phone = ''
    assert.deepEqual(missingRegistrationFields(r), ['mother.phone'])
  })

  test('a parent unable to work still needs contact details but not an occupation', () => {
    const r = livingRegistration()
    r.father.status = 'unable'
    r.father.occupation = ''
    assert.deepEqual(missingRegistrationFields(r), [])
    r.father.phone = ''
    assert.deepEqual(missingRegistrationFields(r), ['father.phone'])
  })

  test('when neither parent can be contacted a caregiver is required', () => {
    const r = livingRegistration()
    r.father.status = 'deceased'
    r.mother.status = 'absent'
    assert.deepEqual(missingRegistrationFields(r), ['caregiver.relation', 'caregiver.name', 'caregiver.phone'])
    r.caregiver = { relation: 'grandparent', name: 'Abdu', phone: '0911000009' }
    assert.deepEqual(missingRegistrationFields(r), [])
  })

  test('a missing status (older record) counts as alive', () => {
    assert.equal(isReachable(undefined), true)
    assert.equal(isReachable('deceased'), false)
    const loaded = registrationFromStudent({ father: { name: 'A', phone: '1' } })
    assert.equal(loaded.father.status, 'alive')
  })
})

describe('Parent status: the student record', () => {
  test('a deceased parent keeps only the status and name; the contact is the living parent', () => {
    const r = livingRegistration()
    r.father = { ...emptyRegistration().father, status: 'deceased', name: 'Late Ahmed', phone: '0900000000' }
    const f = registrationToStudentFields(r)
    assert.deepEqual(f.father, { status: 'deceased', name: 'Late Ahmed' })
    assert.equal(f.parentPhone, '0911000002')
    assert.equal(f.parentName, 'Fatima Hassan')
    assert.equal(f.caregiver?.phone, '')
  })

  test('with both parents gone the caregiver is who gets called', () => {
    const r = livingRegistration()
    r.father.status = 'deceased'
    r.mother.status = 'deceased'
    r.caregiver = { relation: 'uncleAunt', name: 'Uncle Omar', phone: '0911000009' }
    const f = registrationToStudentFields(r)
    assert.equal(f.parentPhone, '0911000009')
    assert.equal(f.parentName, 'Uncle Omar')
    assert.equal(f.alternativePhone, '')
  })

  test('no caregiver is stored when both parents are alive', () => {
    assert.equal(registrationToStudentFields(livingRegistration()).caregiver, null)
  })

  test('the living parents keep working as before (father then mother)', () => {
    const f = registrationToStudentFields(livingRegistration())
    assert.equal(f.parentPhone, '0911000001')
    assert.equal(f.alternativePhone, '0911000002')
  })

  test('orphan kind comes only from deceased parents', () => {
    assert.equal(orphanKind({ father: { status: 'deceased' }, mother: { status: 'deceased' } }), 'both')
    assert.equal(orphanKind({ father: { status: 'deceased' }, mother: { status: 'alive' } }), 'father')
    assert.equal(orphanKind({ mother: { status: 'deceased' } }), 'mother')
    assert.equal(orphanKind({ father: { status: 'absent' } }), null)
    assert.equal(orphanKind({}), null)
  })
})

describe('Help assessment record', () => {
  const by = { uid: 'u1', name: 'Ustaz One' }

  test('"no help needed" keeps no record', () => {
    assert.equal(supportToRecord(emptySupport(), by), null)
  })

  test('a saved assessment round-trips through the form', () => {
    const rec = supportToRecord({ level: 'urgent', kinds: ['food', 'health', 'bogus'], note: ' Father is sick ' }, by, new Date('2026-10-28T00:00:00Z'))
    assert.deepEqual(rec.kinds, { food: true, health: true })
    assert.equal(rec.note, 'Father is sick')
    assert.equal(rec.updatedBy, 'u1')
    assert.deepEqual(supportFromRecord({ ...rec, studentId: 's1' }), { level: 'urgent', kinds: ['food', 'health'], note: 'Father is sick' })
    assert.deepEqual(supportFromRecord(null), emptySupport())
  })

  test('an assessment older than six months is due for review', () => {
    const now = new Date('2026-10-28T00:00:00Z')
    assert.equal(supportNeedsReview({ updatedAt: '2026-09-01T00:00:00Z' }, now), false)
    assert.equal(supportNeedsReview({ updatedAt: '2026-03-01T00:00:00Z' }, now), true)
    assert.equal(supportNeedsReview({ updatedAt: 'garbage' }, now), true)
  })
})

describe('Admin support list', () => {
  const now = new Date('2026-10-28T00:00:00Z')
  const student = (id, name, extra = {}) => ({ id, name, classId: 'c1', className: 'Grade 1', isActive: true, parentPhone: '0911', ...extra })
  const students = [
    student('s1', 'Zainab', { father: { status: 'deceased' } }),
    student('s2', 'Ali'),
    student('s3', 'Bilal'),
    student('s4', 'Hamza', { mother: { status: 'deceased' }, father: { status: 'deceased' } }),
    student('s5', 'Archived', { isActive: false, father: { status: 'deceased' } }),
  ]
  const supports = [
    { studentId: 's2', level: 'urgent', kinds: { food: true }, updatedAt: '2026-10-01T00:00:00Z', updatedBy: 'u1' },
    { studentId: 's3', level: 'needs', kinds: { health: true }, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'u1' },
  ]
  const rows = buildSupportRows(students, supports, now)

  test('lists orphans and students needing help, not others or archived ones, urgent first', () => {
    assert.deepEqual(rows.map((r) => r.student.name), ['Ali', 'Bilal', 'Hamza', 'Zainab'])
  })

  test('counts and filters', () => {
    assert.deepEqual(countSupportRows(rows), { orphans: 2, needs: 2, urgent: 1, review: 1 })
    const names = (o) => filterSupportRows(rows, { filter: 'all', kind: '', search: '', ...o }).map((r) => r.student.name)
    assert.deepEqual(names({ filter: 'orphans' }), ['Hamza', 'Zainab'])
    assert.deepEqual(names({ filter: 'urgent' }), ['Ali'])
    assert.deepEqual(names({ filter: 'review' }), ['Bilal'])
    assert.deepEqual(names({ kind: 'health' }), ['Bilal'])
    assert.deepEqual(names({ search: 'zain' }), ['Zainab'])
  })
})

describe('database rules for the private assessment', () => {
  const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'))
  const school = rules.rules.schoolData.$schoolId
  const node = school.studentSupport

  test('the whole list is admin-only; one record is readable by the admin and that class\'s Ustaz', () => {
    assert.equal(node['.read'], school.adminPushTokens['.read'])
    assert.equal(node.$studentId['.read'], school.studentPhotos.$studentId['.write'])
    assert.match(node.$studentId['.read'], /students\/' \+ \$studentId \+ '\/classId/)
    assert.equal(node.$studentId['.write'], node.$studentId['.read'])
  })

  test('only known fields and values can be written', () => {
    assert.equal(node.$studentId.$other['.validate'], false)
    assert.match(node.$studentId.level['.validate'], /needs.*urgent/)
    assert.match(node.$studentId.updatedBy['.validate'], /auth\.uid/)
  })
})
