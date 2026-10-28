'use client'

/**
 * Daily session logs and weekly reports from the shared offline-first store.
 */
import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { weeklyReportId } from '@/lib/weeklyReport'
import { hasTeacher } from '@/lib/classTeachers'
import type { Class, SessionLog, WeeklyReport } from '@/types'

/** The signed-in Ustaz's session logs (every class day they took attendance for). */
export function useMySessionLogs(): SessionLog[] | undefined {
  const { user } = useAuth()
  const uid = user?.uid
  return useLiveData<SessionLog[]>(uid ? `sessions:teacher:${uid}` : null, (emit) =>
    rtdb.subscribeToSessionsByTeacher(uid || '', emit)
  ).data
}

/** Admin: every session log of the school. */
export function useAllSessionLogs(enabled: boolean): SessionLog[] | undefined {
  return useLiveData<SessionLog[]>(enabled ? 'sessions' : null, (emit) => rtdb.subscribeToSessions(emit)).data
}

/** The signed-in Ustaz's weekly reports. */
export function useMyWeeklyReports(): WeeklyReport[] | undefined {
  const { user } = useAuth()
  const uid = user?.uid
  return useLiveData<WeeklyReport[]>(uid ? `weeklyReports:teacher:${uid}` : null, (emit) =>
    rtdb.subscribeToWeeklyReportsByTeacher(uid || '', emit)
  ).data
}

/** Admin: every weekly report of the school. */
export function useAllWeeklyReports(enabled: boolean): WeeklyReport[] | undefined {
  return useLiveData<WeeklyReport[]>(enabled ? 'weeklyReports' : null, (emit) => rtdb.subscribeToWeeklyReports(emit))
    .data
}

/** Session logs keyed by id (`${classId}_${date}`). */
export function useSessionLogMap(logs: SessionLog[] | undefined): Record<string, SessionLog | undefined> {
  return useMemo(() => {
    const map: Record<string, SessionLog | undefined> = {}
    for (const log of logs ?? []) map[log.id] = log
    return map
  }, [logs])
}

/** Active classes with an Ustaz whose report for the week is not submitted. */
export function missingReportClasses(classes: Class[], reports: WeeklyReport[], weekStart: string): Class[] {
  const submitted = new Set(reports.filter((r) => r.status === 'submitted').map((r) => r.id))
  return classes.filter((c) => c.isActive !== false && hasTeacher(c) && !submitted.has(weeklyReportId(c.id, weekStart)))
}
