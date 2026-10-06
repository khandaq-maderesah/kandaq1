import { rtdb } from '@/lib/database'
import type { Class, Attendance, User, MissingAttendanceAlert } from '@/types'
import { ADMIN_NOTIFY_TIME, TEACHER_NOTIFY_TIME, CHECK_INTERVAL_MS } from './reminderConstants'

export { ADMIN_NOTIFY_TIME, TEACHER_NOTIFY_TIME, CHECK_INTERVAL_MS }

// ============================================================================
// "Teacher did not take attendance" reminder scheduler
//
// The app has no always-on backend, so reminders are generated while the app
// is open (the bell component mounts in both the admin and teacher navbars).
// Every CHECK_INTERVAL_MS the scheduler scans active classes and writes a
// reminder record for any class that has NO attendance saved for today.
//
//   - Teacher is flagged at TEACHER_NOTIFY_TIME (18:00) -> teacher sees the alert
//   - Admin is flagged at ADMIN_NOTIFY_TIME      (18:30) -> admin sees the alert
//
// Reminders are generated every day EXCEPT Sunday. Once the teacher saves
// attendance for that class/date the reminder auto-resolves and disappears
// from both bells.
// ============================================================================

/** True on Sunday (day index 0) - no reminders are generated that day. */
export function isSunday(now: Date = new Date()): boolean {
  return now.getDay() === 0
}

/** Same "today" format used everywhere in the app (YYYY-MM-DD, UTC slice). */
export function todayStr(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Local wall-clock time as HH:MM (24h). */
export function currentHHMM(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** True once the current time has reached (or passed) the given HH:MM. */
export function isPastHHMM(time: string, now: Date = new Date()): boolean {
  return currentHHMM(now) >= time
}

export interface MissingClassInput {
  id: string
  date: string
  classId: string
  className: string
  section: string
  teacherId: string
  teacherName: string
}

/**
 * Pure function: find every active class (with an assigned teacher) that has
 * no attendance record for today.
 */
export function detectMissingAttendance(
  classes: Class[],
  attendance: Attendance[],
  users: User[],
  now: Date = new Date()
): MissingClassInput[] {
  const date = todayStr(now)
  const attendedClassIds = new Set(
    attendance.filter((a) => a.date === date).map((a) => a.classId)
  )
  const userById = new Map(users.map((u) => [u.uid, u]))

  const missing: MissingClassInput[] = []
  for (const c of classes) {
    if (c.isActive === false) continue
    if (!c.teacherId) continue
    if (attendedClassIds.has(c.id)) continue
    const teacher = userById.get(c.teacherId)
    missing.push({
      id: `${date}_${c.id}`,
      date,
      classId: c.id,
      className: c.name,
      section: c.section || '',
      teacherId: c.teacherId,
      teacherName: c.teacherName || teacher?.name || 'Unknown teacher',
    })
  }
  return missing
}

/**
 * Idempotent check: write/update reminders for today's missing classes and
 * auto-resolve any open reminders whose attendance has since been recorded.
 *
 * Pass `existing` when the caller already holds the live `missingAttendanceAlerts`
 * data — the check then reuses it instead of issuing another full GET (the bell
 * calls this every minute, and an extra GET every minute wastes bandwidth).
 */
export async function runMissingAttendanceCheck(
  classes: Class[],
  attendance: Attendance[],
  users: User[],
  now: Date = new Date(),
  existing?: MissingAttendanceAlert[]
): Promise<void> {
  // No reminders on Sundays.
  if (isSunday(now)) return
  const recordedKeys = new Set(attendance.map((a) => `${a.classId}_${a.date}`))
  const missing = detectMissingAttendance(classes, attendance, users, now)

  const existingById = new Map<string, MissingAttendanceAlert>(
    (existing ?? (await rtdb.getMissingAttendanceAlerts())).map((a) => [a.id, a])
  )

  const adminDue = isPastHHMM(ADMIN_NOTIFY_TIME, now)
  const teacherDue = isPastHHMM(TEACHER_NOTIFY_TIME, now)
  const nowIso = now.toISOString()
  let changed = false

  for (const m of missing) {
    const prev = existingById.get(m.id)
    const adminNotified = prev?.adminNotified === true || adminDue
    const teacherNotified = prev?.teacherNotified === true || teacherDue

    const record: MissingAttendanceAlert = {
      id: m.id,
      date: m.date,
      classId: m.classId,
      className: m.className,
      section: m.section,
      teacherId: m.teacherId,
      teacherName: m.teacherName,
      adminNotified,
      adminNotifiedAt: adminNotified ? prev?.adminNotifiedAt || nowIso : '',
      teacherNotified,
      teacherNotifiedAt: teacherNotified ? prev?.teacherNotifiedAt || nowIso : '',
      // Preserve a previously-resolved state. Once an alert has been resolved
      // (manually by the admin or auto-resolved after attendance was recorded)
      // it must NOT be re-armed just because the class still has no attendance.
      resolved: prev?.resolved === true,
      resolvedAt: prev?.resolved === true ? prev?.resolvedAt || '' : '',
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
    }

    // Skip redundant writes: a write every 60s for every missing class keeps
    // waking every subscriber even when nothing changed.
    if (prev && prev.adminNotified === record.adminNotified && prev.teacherNotified === record.teacherNotified && prev.resolved === record.resolved) {
      continue
    }
    changed = true
    await rtdb.setMissingAttendanceAlert(m.id, record)
  }

  // Auto-resolve any open reminder whose attendance was eventually recorded.
  for (const ex of existingById.values()) {
    if (ex.resolved) continue
    if (recordedKeys.has(`${ex.classId}_${ex.date}`)) {
      changed = true
      await rtdb.updateMissingAttendanceAlert(ex.id, {
        resolved: true,
        resolvedAt: nowIso,
        updatedAt: nowIso,
      })
    }
  }

  if (changed) {
    try {
      await rtdb.logAction({
        actorName: 'system',
        action: 'update',
        entity: 'missingAttendanceAlert',
        details: `Reminder scan updated ${changed} alert(s) on ${todayStr(now)}`,
      })
    } catch {
      /* audit is best-effort */
    }
  }
}

export type { MissingAttendanceAlert }
