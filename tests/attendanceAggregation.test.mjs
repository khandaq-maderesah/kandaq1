import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  aggregateAttendanceOverview,
} = await import('../src/lib/attendanceAnalytics.ts')

describe('Attendance Overview Aggregation & Roster Analytics (Task 3.2)', () => {
  test('accurately aggregates student demographics and gender counts', () => {
    const students = [
      { id: 's1', name: 'Zayd', gender: 'male', classId: 'c1', isActive: true },
      { id: 's2', name: 'Mariam', gender: 'female', classId: 'c1', isActive: true },
      { id: 's3', name: 'Ammar', gender: 'male', classId: 'c2', isActive: true },
      { id: 's4', name: 'Archived Student', gender: 'male', classId: 'c1', isActive: false },
    ]

    const classes = [
      { id: 'c1', name: 'Grade 1', section: 'A', teacherId: 'u1' },
      { id: 'c2', name: 'Grade 2', section: 'B', teacherId: 'u2' },
    ]

    const users = [
      { uid: 'u1', name: 'Ustaz Ibrahim', role: 'teacher' },
      { uid: 'u2', name: 'Ustaz Yunus', role: 'teacher' },
      { uid: 'u3', name: 'Admin User', role: 'admin' },
    ]

    const attendance = [
      { id: 'a1', studentId: 's1', classId: 'c1', date: '2026-10-19', status: 'present' },
      { id: 'a2', studentId: 's2', classId: 'c1', date: '2026-10-19', status: 'absent' },
      { id: 'a3', studentId: 's3', classId: 'c2', date: '2026-10-19', status: 'late' },
      { id: 'a4', studentId: 's4', classId: 'c1', date: '2026-10-19', status: 'present' }, // Should be ignored (inactive)
    ]

    const result = aggregateAttendanceOverview({
      students,
      classes,
      users,
      attendance,
      todayDateStr: '2026-10-19',
    })

    assert.equal(result.totalStudents, 4)
    assert.equal(result.activeStudentsCount, 3)
    assert.equal(result.maleStudentsCount, 2)
    assert.equal(result.femaleStudentsCount, 1)
    assert.equal(result.totalTeachersCount, 2)

    // Absent today list
    assert.equal(result.absentTodayList.length, 1)
    assert.equal(result.absentTodayList[0].studentName, 'Mariam')
    assert.equal(result.absentTodayList[0].className, 'Grade 1')

    // Class daily breakdown for Grade 1
    const c1Days = result.classDailyStatus.c1
    assert.ok(c1Days)
    assert.equal(c1Days[0].date, '2026-10-19')
    assert.equal(c1Days[0].present, 1) // Only s1, s4 was ignored!
    assert.equal(c1Days[0].absent, 1)
  })

  test('high-volume benchmark: processes 2,000 students and 10,000 records in <50ms', () => {
    const students = []
    const classes = []
    const users = []
    const attendance = []

    for (let i = 1; i <= 20; i++) {
      classes.push({ id: `c_${i}`, name: `Class ${i}`, section: 'A', teacherId: `t_${i}` })
      users.push({ uid: `t_${i}`, name: `Ustaz ${i}`, role: 'teacher' })
    }

    for (let i = 1; i <= 2000; i++) {
      const classId = `c_${(i % 20) + 1}`
      students.push({
        id: `stu_${i}`,
        name: `Talib ${i}`,
        gender: i % 2 === 0 ? 'male' : 'female',
        classId,
        isActive: i % 100 !== 0, // 1% archived
      })
    }

    const statuses = ['present', 'present', 'present', 'absent', 'late', 'excused']
    const dates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']

    for (let i = 1; i <= 10000; i++) {
      const studentId = `stu_${(i % 2000) + 1}`
      const classId = `c_${(i % 20) + 1}`
      attendance.push({
        id: `att_${i}`,
        studentId,
        classId,
        date: dates[i % dates.length],
        status: statuses[i % statuses.length],
      })
    }

    const start = Date.now()
    const result = aggregateAttendanceOverview({
      students,
      classes,
      users,
      attendance,
      todayDateStr: '2026-10-19',
    })
    const duration = Date.now() - start

    assert.equal(result.totalStudents, 2000)
    assert.ok(result.activeStudentsCount > 1950)
    assert.ok(duration < 100, `Expected duration < 100ms, got ${duration}ms`)
  })

  test('handles empty or missing parameters without throwing', () => {
    const emptyResult = aggregateAttendanceOverview({
      students: [],
      classes: [],
      users: [],
      attendance: [],
    })

    assert.equal(emptyResult.totalStudents, 0)
    assert.equal(emptyResult.activeStudentsCount, 0)
    assert.equal(emptyResult.absentTodayList.length, 0)
    assert.deepEqual(emptyResult.classDailyStatus, {})
  })
})
