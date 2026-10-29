import type { Attendance, Class, School, Student, User } from '@/types'
import { orphanKind } from '@/lib/registration'

/** What the super admin reads from one medreseh: its students, classes and recent attendance. */
export interface SchoolSnapshot {
  students: Student[]
  classes: Class[]
  attendance: Attendance[]
}

/** The numbers shown for one medreseh. Counts of students leave out archived ones. */
export interface SchoolFigures {
  schoolId: string
  name: string
  status: School['status']
  /** False when the medreseh's data could not be read; its data figures are then 0. */
  loaded: boolean
  students: number
  male: number
  female: number
  orphans: number
  classes: number
  classesWithoutUstaz: number
  ustazes: number
  admins: number
  attendanceMarks: number
  attended: number
  absent: number
  /** Percentage (0-100) of marks where the student came; excused marks are left out. null with no marks. */
  attendanceRate: number | null
}

export type PlatformTotals = Omit<SchoolFigures, 'schoolId' | 'name' | 'status' | 'loaded' | 'attendanceRate'> & {
  medresehs: number
  active: number
  suspended: number
  attendanceRate: number | null
}

/** The report cards the super admin can pick from. */
export const REPORT_CARDS = ['overview', 'students', 'staff', 'classes', 'orphans', 'attendance'] as const
export type ReportCard = (typeof REPORT_CARDS)[number]

export function attendanceRate(attended: number, absent: number): number | null {
  const total = attended + absent
  return total === 0 ? null : Math.round((attended / total) * 1000) / 10
}

export function computeSchoolFigures(school: School, users: User[], snapshot: SchoolSnapshot | undefined): SchoolFigures {
  const mine = users.filter((u) => u.schoolId === school.id)
  const students = (snapshot?.students ?? []).filter((s) => s.isActive !== false)
  const classes = snapshot?.classes ?? []
  let attended = 0
  let absent = 0
  for (const a of snapshot?.attendance ?? []) {
    if (a.status === 'present' || a.status === 'late') attended++
    else if (a.status === 'absent') absent++
  }
  return {
    schoolId: school.id,
    name: school.name,
    status: school.status,
    loaded: !!snapshot,
    students: students.length,
    male: students.filter((s) => s.gender === 'male').length,
    female: students.filter((s) => s.gender === 'female').length,
    orphans: students.filter((s) => orphanKind(s) !== null).length,
    classes: classes.length,
    classesWithoutUstaz: classes.filter((c) => !c.teacherId && !Object.keys(c.teacherIds ?? {}).length).length,
    ustazes: mine.filter((u) => u.role === 'teacher').length,
    admins: mine.filter((u) => u.role === 'admin').length,
    attendanceMarks: attended + absent,
    attended,
    absent,
    attendanceRate: attendanceRate(attended, absent),
  }
}

export function computePlatformTotals(figures: SchoolFigures[]): PlatformTotals {
  const sum = (pick: (f: SchoolFigures) => number) => figures.reduce((n, f) => n + pick(f), 0)
  const attended = sum((f) => f.attended)
  const absent = sum((f) => f.absent)
  const suspended = figures.filter((f) => f.status === 'suspended').length
  return {
    medresehs: figures.length,
    active: figures.length - suspended,
    suspended,
    students: sum((f) => f.students),
    male: sum((f) => f.male),
    female: sum((f) => f.female),
    orphans: sum((f) => f.orphans),
    classes: sum((f) => f.classes),
    classesWithoutUstaz: sum((f) => f.classesWithoutUstaz),
    ustazes: sum((f) => f.ustazes),
    admins: sum((f) => f.admins),
    attendanceMarks: attended + absent,
    attended,
    absent,
    attendanceRate: attendanceRate(attended, absent),
  }
}

/** YYYY-MM-DD of `days` days before `now`. */
export function dateDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
