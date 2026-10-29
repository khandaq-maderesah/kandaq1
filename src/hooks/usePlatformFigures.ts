'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import {
  computePlatformTotals,
  computeSchoolFigures,
  dateDaysAgo,
  type PlatformTotals,
  type SchoolFigures,
  type SchoolSnapshot,
} from '@/lib/platformStats'
import type { School, User } from '@/types'

/** Days of attendance the platform figures cover. */
export const PLATFORM_ATTENDANCE_DAYS = 30

/**
 * Super admin: the numbers of every medreseh (students, Ustazes, classes,
 * attendance). The medresehs and users are live; each medreseh's students,
 * classes and attendance are read once and again on `refresh`.
 */
export function usePlatformFigures(): {
  figures: SchoolFigures[]
  totals: PlatformTotals
  /** False until the medresehs, users and their data have been read. */
  ready: boolean
  refreshing: boolean
  refresh: () => void
} {
  const schools = useLiveData<School[]>('schools', (emit) => rtdb.subscribeToSchools(emit)).data
  const users = useLiveData<User[]>('allUsers', (emit) => rtdb.subscribeToAllUsers(emit)).data
  const [snapshots, setSnapshots] = useState<Record<string, SchoolSnapshot> | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const idsKey = useMemo(
    () =>
      (schools ?? [])
        .map((s) => s.id)
        .sort()
        .join(','),
    [schools]
  )

  const load = useCallback(async () => {
    if (!idsKey) return
    setRefreshing(true)
    try {
      setSnapshots(await rtdb.fetchSchoolSnapshots(idsKey.split(','), dateDaysAgo(PLATFORM_ATTENDANCE_DAYS)))
    } finally {
      setRefreshing(false)
    }
  }, [idsKey])

  useEffect(() => {
    void load()
  }, [load])

  const figures = useMemo(
    () =>
      [...(schools ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => computeSchoolFigures(s, users ?? [], snapshots?.[s.id])),
    [schools, users, snapshots]
  )
  const totals = useMemo(() => computePlatformTotals(figures), [figures])

  return { figures, totals, ready: schools !== undefined && users !== undefined && snapshots !== null, refreshing, refresh: () => void load() }
}
