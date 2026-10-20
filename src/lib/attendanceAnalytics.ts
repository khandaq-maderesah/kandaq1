import type { Attendance, Class, Student, User } from '@/types'

export interface ClassDailyStatus {
  date: string
  present: number
  absent: number
  late: number
  excused: number
}

export interface ClassGenderStat {
  name: string
  male: number
  female: number
  teacherName: string
}

export interface AttendanceOverviewResult {
  totalStudents: number
  activeStudentsCount: number
  maleStudentsCount: number
  femaleStudentsCount: number
  totalTeachersCount: number
  classGenderStats: ClassGenderStat[]
  classDailyStatus: Record<string, ClassDailyStatus[]>
  absentTodayList: Array<{
    id: string
    studentId: string
    studentName: string
    className: string
    date: string
    parentPhone?: string
  }>
}

/**
 * High-performance, single-pass attendance & roster analytics aggregation.
 * Optimized for large student rosters (thousands of students/records) using O(1) Maps.
 */
export function aggregateAttendanceOverview(params: {
  students: Student[]
  classes: Class[]
  users: User[]
  attendance: Attendance[]
  todayDateStr?: string
  unassignedLabel?: string
}): AttendanceOverviewResult {
  const {
    students = [],
    classes = [],
    users = [],
    attendance = [],
    todayDateStr = '',
    unassignedLabel = 'Unassigned',
  } = params

  // 1. Build lookup Maps for fast O(1) reference
  const userMap = new Map<string, User>()
  let totalTeachersCount = 0
  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    userMap.set(u.uid, u)
    if (u.role === 'teacher') totalTeachersCount++
  }

  const classMap = new Map<string, { name: string; section?: string; teacherName: string }>()
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i]
    const teacher = c.teacherId ? userMap.get(c.teacherId) : undefined
    classMap.set(c.id, {
      name: c.name,
      section: c.section,
      teacherName: c.teacherName || teacher?.name || '',
    })
  }

  // 2. Index active students and compute demographic distribution
  const studentMap = new Map<string, Student>()
  let activeStudentsCount = 0
  let maleStudentsCount = 0
  let femaleStudentsCount = 0

  const genderMap = new Map<string, { male: number; female: number; name: string; teacherName: string }>()

  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    if (s.isActive === false) continue

    studentMap.set(s.id, s)
    activeStudentsCount++

    if (s.gender === 'male') maleStudentsCount++
    else if (s.gender === 'female') femaleStudentsCount++

    const cid = s.classId || 'none'
    const cInfo = classMap.get(cid)
    const baseName = s.className || cInfo?.name || unassignedLabel
    const section = s.section || cInfo?.section || ''
    const key = `${cid}::${section}`
    const displayName = section ? `${baseName} ${section}` : baseName

    let gEntry = genderMap.get(key)
    if (!gEntry) {
      gEntry = { male: 0, female: 0, name: displayName, teacherName: cInfo?.teacherName || '' }
      genderMap.set(key, gEntry)
    }

    if (s.gender === 'male') gEntry.male++
    else if (s.gender === 'female') gEntry.female++
  }

  // 3. Process attendance records with single-pass classification
  const classDayMap = new Map<string, Map<string, { present: number; absent: number; late: number; excused: number }>>()
  const absentTodayList: AttendanceOverviewResult['absentTodayList'] = []

  for (let i = 0; i < attendance.length; i++) {
    const a = attendance[i]
    const student = studentMap.get(a.studentId)
    // Ignore attendance of archived or non-existent students
    if (!student) continue

    const cid = a.classId || student.classId || 'none'
    const date = a.date || ''

    let days = classDayMap.get(cid)
    if (!days) {
      days = new Map()
      classDayMap.set(cid, days)
    }

    let dayEntry = days.get(date)
    if (!dayEntry) {
      dayEntry = { present: 0, absent: 0, late: 0, excused: 0 }
      days.set(date, dayEntry)
    }

    const st = a.status
    if (st === 'present') dayEntry.present++
    else if (st === 'absent') {
      dayEntry.absent++
      if (todayDateStr && date === todayDateStr) {
        const cInfo = classMap.get(cid)
        absentTodayList.push({
          id: a.id,
          studentId: a.studentId,
          studentName: student.name || a.studentName || '',
          className: cInfo?.name || student.className || a.className || '',
          date,
          parentPhone: student.parentPhone,
        })
      }
    } else if (st === 'late') dayEntry.late++
    else if (st === 'excused') dayEntry.excused++
  }

  // 4. Assemble sorted last-7-days window per class
  const classDailyStatus: Record<string, ClassDailyStatus[]> = {}
  for (const [cid, days] of classDayMap.entries()) {
    const sortedDates = Array.from(days.keys()).sort().slice(-7)
    classDailyStatus[cid] = sortedDates.map((date) => {
      const stats = days.get(date)!
      return { date, ...stats }
    })
  }

  return {
    totalStudents: students.length,
    activeStudentsCount,
    maleStudentsCount,
    femaleStudentsCount,
    totalTeachersCount,
    classGenderStats: Array.from(genderMap.values()),
    classDailyStatus,
    absentTodayList,
  }
}
