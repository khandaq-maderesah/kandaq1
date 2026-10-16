'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { subscribeToChangeRequests, subscribeToMyChangeRequests } from '@/lib/database'
import type { ChangeRequest } from '@/types'

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
 */
export function useRequestBadges() {
  const { user, isAdmin, isTeacher } = useAuth()
  const schoolRequests = useSchoolRequests(isAdmin)
  const myRequests = useMyRequests(isTeacher ? user?.uid : undefined)
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
    }),
    [schoolRequests, myRequests, seen]
  )
}
