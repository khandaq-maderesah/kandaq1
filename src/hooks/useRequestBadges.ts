'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { rtdb, subscribeToChangeRequests, subscribeToMyChangeRequests } from '@/lib/database'
import { reportWeekFor } from '@/lib/weeklyReport'
import { missingReportClasses, useAllWeeklyReports } from '@/hooks/useWeeklyReports'
import { useUnsentAbsenceSms } from '@/hooks/useUnsentAbsenceSms'
import type { ChangeRequest, Class } from '@/types'

const SEEN_EVENT = 'khandaq:request-updates-seen'
const seenKey = (uid: string) => `khandaq_requests_seen_${uid}`

function readSeen(uid: string): string {
  try {
    return localStorage.getItem(seenKey(uid)) ?? ''
  } catch {
    return ''
  }
}

/** Teacher opened "My requests": clear the "new decisions" badge. */
export function markRequestUpdatesSeen(uid: string) {
  try {
    localStorage.setItem(seenKey(uid), new Date().toISOString())
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SEEN_EVENT))
}

/** Admin: the school's requests (live). */
export function useSchoolRequests(enabled: boolean) {
  return useLiveData<ChangeRequest[]>(enabled ? 'requests' : null, (emit) => subscribeToChangeRequests(emit)).data
}

/** Teacher: their own requests (live). */
export function useMyRequests(uid: string | undefined) {
  return useLiveData<ChangeRequest[]>(uid ? `myRequests:${uid}` : null, (emit) =>
    subscribeToMyChangeRequests(uid as string, emit)
  ).data
}

/**
 * Counters for the navigation badges:
 *  - pendingRequests: requests waiting for a school admin
 *  - requestUpdates:  a teacher's requests decided since they last looked
 *  - missingReports:  classes whose weekly report for the due week is not submitted (admin)
 *  - unsentSms:       class days where the Ustaz did not text the parents of absent students (admin)
 */
export function useRequestBadges() {
  const { user, isAdmin, isTeacher } = useAuth()
  const schoolRequests = useSchoolRequests(isAdmin)
  const myRequests = useMyRequests(isTeacher ? user?.uid : undefined)
  const classes = useLiveData<Class[]>(isAdmin ? 'classes' : null, (emit) => rtdb.subscribeToClasses(emit)).data
  const weeklyReports = useAllWeeklyReports(isAdmin)
  const unsentSms = useUnsentAbsenceSms(isAdmin).rows.length
  const [seen, setSeen] = useState('')

  useEffect(() => {
    if (!user) return
    const sync = () => setSeen(readSeen(user.uid))
    sync()
    window.addEventListener(SEEN_EVENT, sync)
    return () => window.removeEventListener(SEEN_EVENT, sync)
  }, [user])

  return useMemo(
    () => ({
      pendingRequests: (schoolRequests ?? []).filter((r) => r.status === 'pending').length,
      requestUpdates: (myRequests ?? []).filter(
        (r) => (r.status === 'approved' || r.status === 'rejected') && (r.reviewedAt ?? '') > seen
      ).length,
      unsentSms,
      missingReports:
        classes && weeklyReports
          ? missingReportClasses(classes, weeklyReports, reportWeekFor(new Date().toISOString().slice(0, 10))).length
          : 0,
    }),
    [schoolRequests, myRequests, seen, classes, weeklyReports, unsentSms]
  )
}
