import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { classTeacherIds, isClassTeacher, hasTeacher, teachersAfterChange, teacherFieldsFor } = await import(
  '../src/lib/classTeachers.ts'
)
const { detectMissingAttendance } = await import('../src/lib/attendanceReminder.ts')

/** A class can have several Ustaz: teacherId is the lead, teacherIds is everyone. */
describe('classTeachers', () => {
  const names = { u1: 'Ustaz One', u2: 'Ustaz Two', u3: 'Ustaz Three' }
  const nameOf = (uid) => names[uid]

  test('an old class with only teacherId still has one Ustaz', () => {
    assert.deepEqual(classTeacherIds({ teacherId: 'u1' }), ['u1'])
    assert.equal(isClassTeacher({ teacherId: 'u1' }, 'u1'), true)
    assert.equal(isClassTeacher({ teacherId: 'u1' }, 'u2'), false)
  })

  test('lists every Ustaz once, lead first', () => {
    const c = { teacherId: 'u2', teacherIds: { u1: true, u2: true } }
    assert.deepEqual(classTeacherIds(c), ['u2', 'u1'])
    assert.equal(isClassTeacher(c, 'u1'), true)
  })

  test('a class with nobody assigned has no Ustaz', () => {
    assert.equal(hasTeacher({}), false)
    assert.equal(hasTeacher({ teacherId: null, teacherIds: null }), false)
    assert.equal(isClassTeacher({}, undefined), false)
  })

  test('adding an Ustaz keeps the others', () => {
    const next = teachersAfterChange({ teacherId: 'u1' }, 'u2', true, nameOf)
    assert.deepEqual(next, [
      { uid: 'u1', name: 'Ustaz One' },
      { uid: 'u2', name: 'Ustaz Two' },
    ])
    assert.deepEqual(teacherFieldsFor(next), {
      teacherId: 'u1',
      teacherName: 'Ustaz One, Ustaz Two',
      teacherIds: { u1: true, u2: true },
    })
  })

  test('removing the lead promotes the next Ustaz; removing the last clears the class', () => {
    const c = { teacherId: 'u1', teacherIds: { u1: true, u2: true } }
    assert.equal(teacherFieldsFor(teachersAfterChange(c, 'u1', false, nameOf)).teacherId, 'u2')
    assert.deepEqual(teacherFieldsFor(teachersAfterChange({ teacherId: 'u1' }, 'u1', false, nameOf)), {
      teacherId: null,
      teacherName: null,
      teacherIds: null,
    })
  })

  test('adding the same Ustaz twice does not duplicate', () => {
    const c = { teacherId: 'u1', teacherIds: { u1: true } }
    assert.deepEqual(
      teachersAfterChange(c, 'u1', true, nameOf).map((t) => t.uid),
      ['u1']
    )
  })

  test('an Ustaz whose account was deleted is dropped', () => {
    const c = { teacherId: 'gone', teacherIds: { gone: true, u1: true } }
    assert.deepEqual(
      teachersAfterChange(c, 'u2', true, nameOf).map((t) => t.uid),
      ['u1', 'u2']
    )
  })

  test('the missing-attendance reminder reaches every Ustaz of the class', () => {
    const classes = [
      { id: 'c1', name: 'Grade 1', isActive: true, teacherId: 'u1', teacherIds: { u1: true, u2: true }, teacherName: 'Ustaz One, Ustaz Two' },
    ]
    const missing = detectMissingAttendance(classes, [], [], new Date('2026-10-27T12:00:00Z'))
    assert.equal(missing.length, 1)
    assert.deepEqual(missing[0].teacherIds, ['u1', 'u2'])
  })
})

describe('database rules for co-teachers', () => {
  const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'))
  const school = rules.rules.schoolData.$schoolId

  test('attendance, student and exam writes also accept teacherIds/{uid}', () => {
    for (const rule of [school.attendance.$attendanceId['.write'], school.students.$studentId['.write'], school.exams.$examId['.write']]) {
      assert.match(rule, /teacherIds\/' \+ auth\.uid\)\.val\(\) === true/)
      assert.equal(rule.split('(').length, rule.split(')').length, 'parentheses are balanced')
    }
  })
})
