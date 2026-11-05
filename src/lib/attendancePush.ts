/**
 * Attendance reminder push notification (Ustaz).
 *
 * One hour before sunset the server sends a push notification to every Ustaz
 * who has not taken attendance for a class today. The notification carries a
 * "Take attendance" action; tapping it (or the notification itself) opens the
 * Ustaz's attendance page.
 *
 * Pure (no React, no Firebase) so the rules can be unit tested.
 */
import { classTeacherIds } from '@/lib/classTeachers'
import type { Class } from '@/types'

/** Where the notification (and its action) takes the Ustaz. */
export const ATTENDANCE_PAGE = '/teacher/attendance'

/** The reminder is not sent after this local time (the admin has been told by then). */
export const PUSH_CUTOFF_TIME = '19:30'

/**
 * The server only runs twice an evening, so a run also sends to the Ustazes
 * whose reminder falls within this many minutes (a few minutes early is better
 * than a long wait for the next run).
 */
export const PUSH_EARLY_TOLERANCE_MINUTES = 12

/** Where the admin's "Ustazes who did not text the parents" notification leads. */
export const ADMIN_SMS_PAGE = '/admin/attendance#ustaz'

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** True when a run at `time` (HH:MM) should send a reminder due at `reminderTime` (HH:MM). */
export function isPushDue(time: string, reminderTime: string): boolean {
  return toMinutes(time) >= toMinutes(reminderTime) - PUSH_EARLY_TOLERANCE_MINUTES
}

/** At most this many class names are spelled out in the notification text. */
const MAX_CLASS_NAMES = 3

/**
 * Hosts of the browsers' push services. The server only posts to these: an
 * Ustaz's saved subscription is user-supplied data, never a place to send
 * requests to.
 */
const PUSH_SERVICE_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
]

export function isTrustedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string') return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && !url.port && PUSH_SERVICE_HOSTS.some((h) => h.test(url.hostname))
  } catch {
    return false
  }
}

export interface MissingClass {
  id: string
  name: string
  section?: string
}

/** "Level 1 · A" */
export function classLabel(c: Pick<MissingClass, 'name' | 'section'>): string {
  return c.section ? `${c.name} · ${c.section}` : c.name
}

/**
 * The classes with no attendance taken today, grouped by Ustaz (every Ustaz of
 * a shared class is asked). Inactive classes and classes without an Ustaz are
 * skipped, like the admin's missing-attendance list.
 */
export function missingClassesByTeacher(
  classes: Pick<Class, 'id' | 'name' | 'section' | 'isActive' | 'teacherId' | 'teacherIds'>[],
  attendedClassIds: Set<string>
): Map<string, MissingClass[]> {
  const byTeacher = new Map<string, MissingClass[]>()
  for (const c of classes) {
    if (c.isActive === false || attendedClassIds.has(c.id)) continue
    for (const uid of classTeacherIds(c)) {
      const list = byTeacher.get(uid) ?? []
      list.push({ id: c.id, name: c.name, section: c.section })
      byTeacher.set(uid, list)
    }
  }
  return byTeacher
}

export interface PushTexts {
  title: string
  /** Contains `{classes}`. */
  body: string
  action: string
}

export interface AttendancePushPayload {
  title: string
  body: string
  /** Label of the notification button. */
  action: string
  /** Opened when the notification or its button is tapped. */
  url: string
  /** Same tag for a day: a repeat replaces the earlier notification instead of stacking. */
  tag: string
  lang: string
}

/** The notification sent to one Ustaz for the classes still missing today. */
export function buildAttendancePush(
  texts: PushTexts,
  missing: MissingClass[],
  date: string,
  lang: string
): AttendancePushPayload {
  const names = missing.map(classLabel)
  const shown = names.slice(0, MAX_CLASS_NAMES).join(', ')
  const more = names.length - MAX_CLASS_NAMES
  const classes = more > 0 ? `${shown} +${more}` : shown
  return {
    title: texts.title,
    body: texts.body.replace('{classes}', classes),
    action: texts.action,
    url: ATTENDANCE_PAGE,
    tag: `attendance-reminder-${date}`,
    lang,
  }
}

/** Names spelled out in the admin notification before "+N". */
const MAX_USTAZ_NAMES = 4

export interface AdminSmsPushPayload {
  title: string
  body: string
  action: string
  url: string
  tag: string
  lang: string
}

/** The admin's notification: which Ustazes saved absences but did not text the parents. */
export function buildUnsentSmsPush(texts: PushTexts, ustazNames: string[], date: string, lang: string): AdminSmsPushPayload {
  const names = [...new Set(ustazNames.map((n) => n.trim()).filter(Boolean))]
  const shown = names.slice(0, MAX_USTAZ_NAMES).join(', ')
  const more = names.length - MAX_USTAZ_NAMES
  return {
    title: texts.title,
    body: texts.body.replace('{ustazes}', more > 0 ? `${shown} +${more}` : shown),
    action: texts.action,
    url: ADMIN_SMS_PAGE,
    tag: `unsent-sms-${date}`,
    lang,
  }
}
