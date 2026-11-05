import webpush from 'web-push'
import { getDatabase, type Database, type DataSnapshot } from 'firebase-admin/database'
import { getAdminApp } from '@/lib/firebase/admin'
import { DEFAULT_TIMEZONE, teacherReminderTime, zonedClock } from '@/lib/sunset'
import { SMS_LOOKBACK_DAYS, findUnsentAbsenceSms, groupByUstaz } from '@/lib/absenceSms'
import {
  PUSH_CUTOFF_TIME,
  buildAttendancePush,
  buildUnsentSmsPush,
  isPushDue,
  isTrustedPushEndpoint,
  missingClassesByTeacher,
  type PushTexts,
} from '@/lib/attendancePush'
import en from '@/i18n/messages/en/attendanceReminder.json'
import am from '@/i18n/messages/am/attendanceReminder.json'
import ar from '@/i18n/messages/ar/attendanceReminder.json'
import om from '@/i18n/messages/om/attendanceReminder.json'
import so from '@/i18n/messages/so/attendanceReminder.json'
import type { Attendance, Class, PushSubscriptionRecord, User } from '@/types'

const MESSAGES = { en, am, ar, om, so }
const LANGUAGES = Object.keys(MESSAGES)

/** The notification texts of a kind, in the language chosen on the phone (English if unknown). */
function textsFor(kind: 'push' | 'adminSms', language: string | undefined): { lang: string; texts: PushTexts } {
  const lang = language && LANGUAGES.includes(language) ? language : 'en'
  return { lang, texts: MESSAGES[lang as keyof typeof MESSAGES][kind] }
}

/** A notification stays this long on the phone's push service if the phone is off. */
const TTL_SECONDS = 2 * 60 * 60

export interface SchoolPushResult {
  schoolId: string
  date: string
  time: string
  /** Why nothing was sent (empty when the run could send). */
  skipped: '' | 'sunday' | 'tooEarly' | 'tooLate' | 'nothingToReport'
  /** People who were sent a notification. */
  notified: number
  /** Devices that received it. */
  delivered: number
  /** Devices removed because the phone no longer accepts notifications. */
  expired: number
}

export interface PushRunResult {
  ok: boolean
  configured: boolean
  schools: SchoolPushResult[]
}

function configureWebPush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  // The subject only has to identify the sender: the app's address works.
  const subject = process.env.VAPID_SUBJECT || 'https://khendeq-medresah--khendeq-8e17f.europe-west4.hosted.app'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

/** Runs `task` for every active school and collects the results. */
async function forEachSchool(task: (db: Database, schoolId: string, timeZone: string) => Promise<SchoolPushResult>): Promise<PushRunResult> {
  if (!configureWebPush()) return { ok: true, configured: false, schools: [] }
  const db = getDatabase(getAdminApp())
  const defaultTimeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
  const schoolsSnap = await db.ref('schoolInfo').get()

  const jobs: Promise<SchoolPushResult>[] = []
  schoolsSnap.forEach((child) => {
    const info = child.val()
    if (info?.status !== 'active') return
    jobs.push(task(db, child.key as string, info.timezone || defaultTimeZone))
  })
  return { ok: true, configured: true, schools: await Promise.all(jobs) }
}

/** The user's usable devices (a push service we trust, with its keys). */
function devicesOf(subs: DataSnapshot, uid: string) {
  const devices: { id: string; sub: PushSubscriptionRecord }[] = []
  subs.child(uid).forEach((device) => {
    const sub = device.val() as PushSubscriptionRecord
    if (isTrustedPushEndpoint(sub?.endpoint) && sub.keys?.p256dh && sub.keys?.auth) {
      devices.push({ id: device.key as string, sub })
    }
  })
  return devices
}

/**
 * Sends a notification to every device of one user, in each device's language.
 * Returns how many devices got it; phones that dropped the subscription are
 * removed from the database.
 */
async function pushToUser(
  db: Database,
  base: string,
  uid: string,
  devices: { id: string; sub: PushSubscriptionRecord }[],
  payloadFor: (language: string | undefined) => object,
  result: SchoolPushResult
): Promise<number> {
  let delivered = 0
  for (const { id, sub } of devices) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payloadFor(sub.language)), {
        TTL: TTL_SECONDS,
        urgency: 'high',
      })
      delivered++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // The phone dropped the subscription (app removed, notifications turned off).
        await db.ref(`${base}/pushSubs/${uid}/${id}`).remove()
        result.expired++
      } else {
        console.warn('Push failed:', status ?? err)
      }
    }
  }
  return delivered
}

/**
 * Sends the "take attendance" push to every Ustaz who still has a class without
 * attendance today, once per Ustaz per day, from 1.5 hours before sunset.
 * Run by Cloud Scheduler twice an evening (see isPushDue for the early margin).
 */
export function sendTeacherAttendancePushes(now: Date = new Date()): Promise<PushRunResult> {
  return forEachSchool((db, schoolId, timeZone) => pushTeachers(db, schoolId, timeZone, now))
}

async function pushTeachers(db: Database, schoolId: string, timeZone: string, now: Date): Promise<SchoolPushResult> {
  const { date, time, weekday } = zonedClock(now, timeZone)
  const result: SchoolPushResult = { schoolId, date, time, skipped: '', notified: 0, delivered: 0, expired: 0 }

  if (weekday === 0) return { ...result, skipped: 'sunday' }
  if (!isPushDue(time, teacherReminderTime(date, timeZone))) return { ...result, skipped: 'tooEarly' }
  if (time >= PUSH_CUTOFF_TIME) return { ...result, skipped: 'tooLate' }

  const base = `schoolData/${schoolId}`
  const [classesSnap, attendanceSnap, subsSnap, logSnap, usersSnap] = await Promise.all([
    db.ref(`${base}/classes`).get(),
    db.ref(`${base}/attendance`).orderByChild('date').equalTo(date).get(),
    db.ref(`${base}/pushSubs`).get(),
    db.ref(`${base}/attendancePushLog/${date}`).get(),
    db.ref('users').orderByChild('schoolId').equalTo(schoolId).get(),
  ])
  if (!subsSnap.exists()) return result

  const classes: Class[] = []
  classesSnap.forEach((child) => {
    classes.push({ id: child.key as string, ...child.val() })
  })
  const attended = new Set<string>()
  attendanceSnap.forEach((child) => {
    attended.add(child.val()?.classId)
  })
  const inactive = new Set<string>()
  usersSnap.forEach((child) => {
    if (child.val()?.status === 'inactive') inactive.add(child.key as string)
  })
  const alreadyNotified = new Set<string>(Object.keys(logSnap.val() ?? {}))

  for (const [uid, missing] of missingClassesByTeacher(classes, attended)) {
    if (alreadyNotified.has(uid) || inactive.has(uid) || !subsSnap.hasChild(uid)) continue
    const devices = devicesOf(subsSnap, uid)
    if (devices.length === 0) continue

    const delivered = await pushToUser(
      db,
      base,
      uid,
      devices,
      (language) => {
        const { lang, texts } = textsFor('push', language)
        return buildAttendancePush(texts, missing, date, lang)
      },
      result
    )
    // Only a delivered reminder counts as sent, so a failed one is tried again on the next run.
    if (delivered > 0) {
      await db.ref(`${base}/attendancePushLog/${date}/${uid}`).set(now.toISOString())
      result.notified++
      result.delivered += delivered
    }
  }
  return result
}

/**
 * Tells every admin which Ustazes saved absent students but did not text the
 * parents (the same list as the admin's "Absence SMS not sent" screen), once a
 * day, from the evening run. Nothing is sent when every Ustaz texted.
 */
export function sendAdminUnsentSmsPushes(now: Date = new Date()): Promise<PushRunResult> {
  return forEachSchool((db, schoolId, timeZone) => pushAdmins(db, schoolId, timeZone, now))
}

async function pushAdmins(db: Database, schoolId: string, timeZone: string, now: Date): Promise<SchoolPushResult> {
  const { date, time, weekday } = zonedClock(now, timeZone)
  const result: SchoolPushResult = { schoolId, date, time, skipped: '', notified: 0, delivered: 0, expired: 0 }
  if (weekday === 0) return { ...result, skipped: 'sunday' }

  const base = `schoolData/${schoolId}`
  const subsSnap = await db.ref(`${base}/pushSubs`).get()
  if (!subsSnap.exists()) return result

  const since = new Date(now.getTime() - SMS_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
  const [classesSnap, attendanceSnap, smsSnap, usersSnap, logSnap] = await Promise.all([
    db.ref(`${base}/classes`).get(),
    db.ref(`${base}/attendance`).orderByChild('date').startAt(since).get(),
    db.ref(`${base}/absenceSms`).orderByChild('date').startAt(since).get(),
    db.ref('users').orderByChild('schoolId').equalTo(schoolId).get(),
    db.ref(`${base}/smsPushLog/${date}`).get(),
  ])

  const classes: Class[] = []
  classesSnap.forEach((child) => {
    classes.push({ id: child.key as string, ...child.val() })
  })
  const attendance: Attendance[] = []
  attendanceSnap.forEach((child) => {
    attendance.push({ id: child.key as string, ...child.val() })
  })
  const logs: { classId: string; date: string; absentCount: number }[] = []
  smsSnap.forEach((child) => {
    logs.push(child.val())
  })
  const users: User[] = []
  usersSnap.forEach((child) => {
    users.push({ uid: child.key as string, ...child.val() })
  })

  const unsent = findUnsentAbsenceSms({ attendance, logs, classes, users, now })
  if (unsent.length === 0) return { ...result, skipped: 'nothingToReport' }
  const ustazNames = groupByUstaz(unsent).map((g) => g.teacherName)
  const alreadyNotified = new Set<string>(Object.keys(logSnap.val() ?? {}))

  for (const admin of users) {
    if (admin.role !== 'admin' || admin.status === 'inactive') continue
    if (alreadyNotified.has(admin.uid) || !subsSnap.hasChild(admin.uid)) continue
    const devices = devicesOf(subsSnap, admin.uid)
    if (devices.length === 0) continue

    const delivered = await pushToUser(
      db,
      base,
      admin.uid,
      devices,
      (language) => {
        const { lang, texts } = textsFor('adminSms', language)
        return buildUnsentSmsPush(texts, ustazNames, date, lang)
      },
      result
    )
    if (delivered > 0) {
      await db.ref(`${base}/smsPushLog/${date}/${admin.uid}`).set(now.toISOString())
      result.notified++
      result.delivered += delivered
    }
  }
  return result
}
