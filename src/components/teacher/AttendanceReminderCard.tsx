'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { ClipboardCheck, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ATTENDANCE_PAGE, classLabel } from '@/lib/attendancePush'
import { getOfflineAttendanceQueue } from '@/lib/offlineAttendance'
import { DEFAULT_TIMEZONE, isTeacherReminderDue, reminderInstant, zonedClock } from '@/lib/sunset'
import { PushOptIn } from '@/components/PushOptIn'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import type { Attendance, Class } from '@/types'

/**
 * Ustaz dashboard: the attendance reminder.
 *
 * - After the reminder time (1.5 hours before sunset) a banner names the classes
 *   whose attendance has not been taken, with a button straight to the page.
 * - A small card lets the Ustaz turn on the push notification for this phone;
 *   the server then sends it every day at that time, even with the app closed.
 */
export function AttendanceReminderCard({ classes, attendance }: { classes: Class[]; attendance: Attendance[] }) {
  const t = useTranslations('attendanceReminder')
  const format = useFormatter()
  const { school } = useAuth()
  const timeZone = school?.timezone || DEFAULT_TIMEZONE

  // The clock moves on while the dashboard stays open: the banner appears by itself.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { date, weekday } = zonedClock(now, timeZone)
  const reminderAt = reminderInstant(date)
  const reminderTime = reminderAt ? format.dateTime(reminderAt, { timeStyle: 'short', timeZone }) : ''

  // Classes with no attendance today, counting marks still waiting on this phone to sync.
  const missing = useMemo(() => {
    if (weekday === 0 || !isTeacherReminderDue(now, timeZone)) return []
    const taken = new Set(attendance.filter((a) => a.date === date).map((a) => a.classId))
    getOfflineAttendanceQueue().forEach((q) => q.date === date && taken.add(q.classId))
    return classes.filter((c) => c.isActive !== false && !taken.has(c.id))
  }, [classes, attendance, date, weekday, now, timeZone])

  if (classes.length === 0) return null

  return (
    <div className="mb-4 space-y-3">
      {missing.length > 0 && (
        <Alert variant="warning" className="items-start">
          <Clock aria-hidden="true" />
          <AlertDescription className="min-w-0">
            <AlertTitle>{t('banner.title')}</AlertTitle>
            <p className="text-foreground">{t('banner.body', { classes: missing.map(classLabel).join(', ') })}</p>
          </AlertDescription>
          <Link href={ATTENDANCE_PAGE} className={buttonVariants({ size: 'sm' })}>
            <ClipboardCheck /> {t('banner.action')}
          </Link>
        </Alert>
      )}

      <PushOptIn
        title={t('card.title')}
        offDescription={t('card.offDescription', { time: reminderTime })}
        onDescription={t('card.onDescription', { time: reminderTime })}
        test={{ title: t('card.testTitle'), body: t('card.testBody'), action: t('push.action'), url: ATTENDANCE_PAGE }}
      />
    </div>
  )
}
