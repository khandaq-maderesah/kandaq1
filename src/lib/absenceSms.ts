/**
 * Absence SMS follow-up.
 *
 * After an Ustaz saves attendance with absent students, the app asks them to
 * text those students' parents. Opening the SMS app is recorded as one small
 * record per class and day (`absenceSms/{date}_{classId}`). When an Ustaz saved
 * absences but no such record appears, the admin is told and sees the list.
 *
 * Pure (no React, no Firebase) so the rules can be unit tested.
 */
import type { AbsenceSmsLog, Attendance, Class, User } from '@/types'

/** Days already saved before this date are never flagged (the feature did not exist yet). */
export const SMS_TRACKING_START = '2026-10-31'

/** How long the admin waits after the Ustaz saved before flagging a missing SMS. */
export const SMS_GRACE_MINUTES = 15

/** How many days back the admin list looks. */
export const SMS_LOOKBACK_DAYS = 7

export function absenceSmsId(date: string, classId: string): string {
  return `${date}_${classId}`
}

export interface UnsentAbsenceSms {
  key: string
  date: string
  classId: string
  className: string
  section: string
  teacherId: string
  teacherName: string
  phone: string
  /** Students marked absent that day. */
  absentCount: number
  /** When the Ustaz saved the attendance (ISO). */
  savedAt: string
}

/**
 * Class days where an Ustaz saved absences and has not opened the SMS app for
 * them. Attendance an admin marked is left out (the admin does not text), and
 * so is a day saved less than SMS_GRACE_MINUTES ago (the Ustaz is probably
 * still in the SMS dialog). Newest first.
 */
export function findUnsentAbsenceSms(input: {
  attendance: Pick<Attendance, 'classId' | 'className' | 'date' | 'status' | 'teacherId' | 'markedBy' | 'markedAt'>[]
  logs: Pick<AbsenceSmsLog, 'classId' | 'date' | 'absentCount'>[]
  classes: Pick<Class, 'id' | 'name' | 'section' | 'teacherId' | 'teacherIds' | 'teacherName'>[]
  users: Pick<User, 'uid' | 'name' | 'phone'>[]
  now?: Date
  /** Earliest day looked at; defaults to the start of tracking. */
  since?: string
}): UnsentAbsenceSms[] {
  const now = input.now ?? new Date()
  const today = now.toISOString().slice(0, 10)
  const earliest = new Date(now)
  earliest.setUTCDate(earliest.getUTCDate() - SMS_LOOKBACK_DAYS)
  const from = [SMS_TRACKING_START, earliest.toISOString().slice(0, 10), input.since ?? ''].sort().pop() as string
  const graceEnd = now.getTime() - SMS_GRACE_MINUTES * 60_000

  const sent = new Map(input.logs.map((l) => [absenceSmsId(l.date, l.classId), l.absentCount]))
  const classById = new Map(input.classes.map((c) => [c.id, c]))
  const userById = new Map(input.users.map((u) => [u.uid, u]))

  const groups = new Map<string, UnsentAbsenceSms>()
  for (const a of input.attendance) {
    if (a.status !== 'absent' || a.date < from || a.date > today) continue
    // Taken by an admin, not the Ustaz: nobody is expected to text.
    if (!a.teacherId || a.markedBy !== a.teacherId) continue
    const key = absenceSmsId(a.date, a.classId)
    const group = groups.get(key)
    if (group) {
      group.absentCount++
      if (a.markedAt > group.savedAt) group.savedAt = a.markedAt
      continue
    }
    const cls = classById.get(a.classId)
    const teacher = userById.get(a.teacherId)
    groups.set(key, {
      key,
      date: a.date,
      classId: a.classId,
      className: cls?.name ?? a.className,
      section: cls?.section ?? '',
      teacherId: a.teacherId,
      teacherName: teacher?.name || cls?.teacherName || '',
      phone: teacher?.phone ?? '',
      absentCount: 1,
      savedAt: a.markedAt,
    })
  }

  return [...groups.values()]
    .filter((g) => {
      const savedAt = new Date(g.savedAt).getTime()
      if (Number.isFinite(savedAt) && savedAt > graceEnd) return false
      const sentFor = sent.get(g.key)
      // Text sent for fewer absentees than there are now: the new ones are still owed a message.
      return sentFor === undefined || sentFor < g.absentCount
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className))
}

/** Unsent days grouped by Ustaz, for the admin's "who did not text" list. */
export function groupByUstaz(rows: UnsentAbsenceSms[]): { teacherId: string; teacherName: string; phone: string; days: UnsentAbsenceSms[] }[] {
  const byTeacher = new Map<string, { teacherId: string; teacherName: string; phone: string; days: UnsentAbsenceSms[] }>()
  for (const r of rows) {
    const entry = byTeacher.get(r.teacherId) ?? { teacherId: r.teacherId, teacherName: r.teacherName, phone: r.phone, days: [] }
    entry.days.push(r)
    byTeacher.set(r.teacherId, entry)
  }
  return [...byTeacher.values()].sort((a, b) => b.days.length - a.days.length || a.teacherName.localeCompare(b.teacherName))
}
