'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { ATTENDANCE_RECENT_DAYS, daysAgoISO } from '@/lib/utils'
import { SMS_LOOKBACK_DAYS, findUnsentAbsenceSms, type UnsentAbsenceSms } from '@/lib/absenceSms'
import type { AbsenceSmsLog, Attendance, Class, User } from '@/types'

/**
 * Admin: class days where an Ustaz saved absent students but did not text the
 * parents (see lib/absenceSms.ts). Uses the same live channels as the bells
 * and dashboards, so nothing extra is downloaded. Re-evaluated every minute
 * because an Ustaz gets a few minutes to finish texting before being listed.
 */
export function useUnsentAbsenceSms(enabled: boolean): { rows: UnsentAbsenceSms[]; ready: boolean } {
  const attendanceSince = useMemo(() => daysAgoISO(ATTENDANCE_RECENT_DAYS), [])
  const logsSince = useMemo(() => daysAgoISO(SMS_LOOKBACK_DAYS), [])
  const classes = useLiveData<Class[]>(enabled ? 'classes' : null, (emit) => rtdb.subscribeToClasses(emit)).data
  const users = useLiveData<User[]>(enabled ? 'users' : null, (emit) => rtdb.subscribeToUsers(emit)).data
  const attendance = useLiveData<Attendance[]>(enabled ? `attendance:since:${attendanceSince}` : null, (emit) =>
    rtdb.subscribeToAttendanceSince(attendanceSince, emit)
  ).data
  const logs = useLiveData<AbsenceSmsLog[]>(enabled ? `absenceSms:${logsSince}` : null, (emit) =>
    rtdb.subscribeToAbsenceSmsSince(logsSince, emit)
  ).data

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [enabled])

  const ready = !!classes && !!users && !!attendance && !!logs
  const rows = useMemo(
    () => (ready ? findUnsentAbsenceSms({ attendance, logs, classes, users, now }) : []),
    [ready, attendance, logs, classes, users, now]
  )
  return { rows, ready }
}
