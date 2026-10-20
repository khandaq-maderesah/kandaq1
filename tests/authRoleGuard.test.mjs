import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('Role-Based Access Guard Invariants', () => {
  function canAccessAdminRoute(user) {
    if (!user || user.status === 'inactive') return false
    return user.role === 'admin' || user.role === 'superadmin'
  }

  function canAccessSuperadminRoute(user) {
    if (!user || user.status === 'inactive') return false
    return user.role === 'superadmin'
  }

  function canMarkAttendance(user, classObj) {
    if (!user || user.status === 'inactive') return false
    if (user.role === 'superadmin') return true
    if (user.role === 'admin') return user.schoolId === classObj.schoolId
    if (user.role === 'teacher') {
      return user.schoolId === classObj.schoolId && classObj.teacherId === user.uid
    }
    return false
  }

  test('superadmin can access all routes and classes', () => {
    const superadmin = { uid: 's1', role: 'superadmin', status: 'active' }
    const sampleClass = { id: 'c1', schoolId: 'sch1', teacherId: 't1' }

    assert.equal(canAccessAdminRoute(superadmin), true)
    assert.equal(canAccessSuperadminRoute(superadmin), true)
    assert.equal(canMarkAttendance(superadmin, sampleClass), true)
  })

  test('admin has school-scoped access only', () => {
    const adminSch1 = { uid: 'a1', role: 'admin', schoolId: 'sch1', status: 'active' }
    const classSch1 = { id: 'c1', schoolId: 'sch1', teacherId: 't1' }
    const classSch2 = { id: 'c2', schoolId: 'sch2', teacherId: 't2' }

    assert.equal(canAccessAdminRoute(adminSch1), true)
    assert.equal(canAccessSuperadminRoute(adminSch1), false)
    assert.equal(canMarkAttendance(adminSch1, classSch1), true)
    assert.equal(canMarkAttendance(adminSch1, classSch2), false)
  })

  test('teacher can only mark attendance for their assigned class within their madrasa', () => {
    const ustaz = { uid: 'u1', role: 'teacher', schoolId: 'sch1', status: 'active' }
    const myClass = { id: 'c1', schoolId: 'sch1', teacherId: 'u1' }
    const otherClass = { id: 'c2', schoolId: 'sch1', teacherId: 'u2' }
    const otherMadrasa = { id: 'c3', schoolId: 'sch2', teacherId: 'u1' }

    assert.equal(canAccessAdminRoute(ustaz), false)
    assert.equal(canMarkAttendance(ustaz, myClass), true)
    assert.equal(canMarkAttendance(ustaz, otherClass), false)
    assert.equal(canMarkAttendance(ustaz, otherMadrasa), false)
  })

  test('inactive users are denied all access', () => {
    const inactiveAdmin = { uid: 'a2', role: 'admin', schoolId: 'sch1', status: 'inactive' }
    const classSch1 = { id: 'c1', schoolId: 'sch1', teacherId: 't1' }

    assert.equal(canAccessAdminRoute(inactiveAdmin), false)
    assert.equal(canMarkAttendance(inactiveAdmin, classSch1), false)
  })
})
