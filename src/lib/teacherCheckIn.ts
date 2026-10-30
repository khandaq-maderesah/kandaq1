/**
 * Ustaz presence ("I am in class").
 *
 * An Ustaz taps one button per class and day; the admin sees who is in class
 * and who is not yet. This module is pure (no React, no Firebase) so the
 * rules can be unit tested.
 */
import { classTeacherIds } from '@/lib/classTeachers'
import type { Attendance, Class, TeacherCheckIn, User } from '@/types'

/** One check-in per Ustaz, class and day: tapping twice cannot create a second record. */
export function checkInId(date: string, classId: string, teacherId: string): string {
  return `${date}_${classId}_${teacherId}`
}

export interface PresenceRow {
  key: string
  classId: string
  className: string
  section: string
  teacherId: string
  teacherName: string
  phone: string
  /** Server time (ms) of the "I am in class" tap, or null when not yet in class. */
  checkedInAt: number | null
  /** The class's student attendance was taken that day (by anyone). */
  attendanceTaken: boolean
}

export type PresenceFilter = 'all' | 'inClass' | 'notYet'

/**
 * One row per Ustaz of every active class, for the given day. Classes with
 * nobody assigned have no Ustaz to be present and are left out.
 */
export function buildPresenceRows(input: {
  classes: Class[]
  users: Pick<User, 'uid' | 'name' | 'phone'>[]
  checkIns: Pick<TeacherCheckIn, 'classId' | 'teacherId' | 'checkedInAt'>[]
  attendance: Pick<Attendance, 'classId' | 'date'>[]
  date: string
}): PresenceRow[] {
  const userById = new Map(input.users.map((u) => [u.uid, u]))
  const checkedIn = new Map(input.checkIns.map((c) => [`${c.classId}:${c.teacherId}`, c.checkedInAt]))
  const taken = new Set(input.attendance.filter((a) => a.date === input.date).map((a) => a.classId))
  const rows: PresenceRow[] = []
  for (const c of input.classes) {
    if (c.isActive === false) continue
    for (const teacherId of classTeacherIds(c)) {
      const user = userById.get(teacherId)
      rows.push({
        key: `${c.id}:${teacherId}`,
        classId: c.id,
        className: c.name,
        section: c.section ?? '',
        teacherId,
        teacherName: user?.name || c.teacherName || '',
        phone: user?.phone ?? '',
        checkedInAt: checkedIn.get(`${c.id}:${teacherId}`) ?? null,
        attendanceTaken: taken.has(c.id),
      })
    }
  }
  // Not yet in class first (that is what the admin acts on), then by class and name.
  return rows.sort(
    (a, b) =>
      Number(a.checkedInAt !== null) - Number(b.checkedInAt !== null) ||
      a.className.localeCompare(b.className) ||
      a.teacherName.localeCompare(b.teacherName)
  )
}

export function presenceSummary(rows: PresenceRow[]): { total: number; inClass: number; notYet: number } {
  const inClass = rows.filter((r) => r.checkedInAt !== null).length
  return { total: rows.length, inClass, notYet: rows.length - inClass }
}

export function filterPresence(rows: PresenceRow[], filter: PresenceFilter, query = ''): PresenceRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (filter === 'inClass' && r.checkedInAt === null) return false
    if (filter === 'notYet' && r.checkedInAt !== null) return false
    return !q || r.teacherName.toLowerCase().includes(q) || r.className.toLowerCase().includes(q)
  })
}
