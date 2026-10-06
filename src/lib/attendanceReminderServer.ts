import { getAdminApp } from '@/lib/firebase/admin'
import { getDatabase } from 'firebase-admin/database'
import { ADMIN_NOTIFY_TIME, TEACHER_NOTIFY_TIME } from '@/lib/reminderConstants'
import type { Class, Attendance, User, MissingAttendanceAlert } from '@/types'

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa'

/** Local wall-clock date/time split for the configured timezone. */
function localParts(timeZone: string, now: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const hhmm = `${get('hour')}:${get('minute')}`
  const day = new Date(`${date}T00:00:00`).getDay()
  return { date, hhmm, day }
}

export interface ServerCheckResult {
  ok: boolean
  configured: boolean
  date: string
  time: string
  skippedSunday: boolean
  flaggedAdmin: number
  flaggedTeacher: number
  resolved: number
  missing: number
}

/**
 * Runs the "teacher did not take attendance" check on the server using the
 * Firebase Admin SDK. Intended to be invoked by a scheduled cron so the admin
 * (18:30) and teacher (18:00) reminders fire even when nobody has the app open.
 */
export async function runMissingAttendanceCheckServer(): Promise<ServerCheckResult> {
  const admin = getAdminApp()
  const db = getDatabase(admin)
  const timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
  const now = new Date()
  const { date, hhmm, day } = localParts(timeZone, now)

  const result: ServerCheckResult = {
    ok: true,
    configured: true,
    date,
    time: hhmm,
    skippedSunday: false,
    flaggedAdmin: 0,
    flaggedTeacher: 0,
    resolved: 0,
    missing: 0,
  }

  if (day === 0) {
    result.skippedSunday = true
    return result
  }

  const [classesSnap, attendanceSnap, usersSnap, alertsSnap] = await Promise.all([
    db.ref('classes').get(),
    db.ref('attendance').get(),
    db.ref('users').get(),
    db.ref('missingAttendanceAlerts').get(),
  ])

  const classes: Class[] = []
  classesSnap.forEach((child) => {
    classes.push({ id: child.key as string, ...child.val() })
  })
  const attendance: Attendance[] = []
  attendanceSnap.forEach((child) => {
    attendance.push({ id: child.key as string, ...child.val() })
  })
  const users: User[] = []
  usersSnap.forEach((child) => {
    users.push({ uid: child.key as string, ...child.val() })
  })
  const existing: MissingAttendanceAlert[] = []
  alertsSnap.forEach((child) => {
    existing.push({ id: child.key as string, ...child.val() })
  })

  const userById = new Map(users.map((u) => [u.uid, u]))
  const attendedToday = new Set(
    attendance.filter((a) => a.date === date).map((a) => a.classId)
  )
  const recordedKeys = new Set(attendance.map((a) => `${a.classId}_${a.date}`))
  const existingById = new Map(existing.map((a) => [a.id, a]))

  const adminDue = hhmm >= ADMIN_NOTIFY_TIME
  const teacherDue = hhmm >= TEACHER_NOTIFY_TIME
  const nowIso = now.toISOString()

  for (const c of classes) {
    if (c.isActive === false) continue
    if (!c.teacherId) continue
    if (attendedToday.has(c.id)) continue

    const id = `${date}_${c.id}`
    const prev = existingById.get(id)
    const teacher = userById.get(c.teacherId)
    const adminNotified = prev?.adminNotified === true || adminDue
    const teacherNotified = prev?.teacherNotified === true || teacherDue

    const record: MissingAttendanceAlert = {
      id,
      date,
      classId: c.id,
      className: c.name,
      section: c.section || '',
      teacherId: c.teacherId,
      teacherName: c.teacherName || teacher?.name || 'Unknown teacher',
      adminNotified,
      adminNotifiedAt: adminNotified ? prev?.adminNotifiedAt || nowIso : '',
      teacherNotified,
      teacherNotifiedAt: teacherNotified ? prev?.teacherNotifiedAt || nowIso : '',
      // Preserve a previously-resolved state so the cron does not re-arm an
      // alert that an admin already resolved (or that auto-resolved).
      resolved: prev?.resolved === true,
      resolvedAt: prev?.resolved === true ? prev?.resolvedAt || '' : '',
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
    }
    await db.ref(`missingAttendanceAlerts/${id}`).set(record)
    if (adminDue && !prev?.adminNotified) result.flaggedAdmin++
    if (teacherDue && !prev?.teacherNotified) result.flaggedTeacher++
    result.missing++
  }

  // Auto-resolve any open reminder whose attendance was eventually recorded.
  for (const ex of existing) {
    if (ex.resolved) continue
    if (recordedKeys.has(`${ex.classId}_${ex.date}`)) {
      await db.ref(`missingAttendanceAlerts/${ex.id}`).update({
        resolved: true,
        resolvedAt: nowIso,
        updatedAt: nowIso,
      })
      result.resolved++
    }
  }

  return result
}
