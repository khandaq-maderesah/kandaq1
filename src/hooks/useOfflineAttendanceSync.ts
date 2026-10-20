'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { rtdb } from '@/lib/database'
import {
  getOfflineAttendanceQueue,
  isBrowserOnline,
  resolveAttendanceConflict,
  syncOfflineAttendance,
  type CloudAttendanceMark,
  type QueuedAttendanceRecord,
} from '@/lib/offlineAttendance'

export function useOfflineAttendanceSync() {
  const t = useTranslations('teacherAttendance')
  const [online, setOnline] = useState(isBrowserOnline)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshPending = useCallback(() => {
    setPendingCount(getOfflineAttendanceQueue().length)
  }, [])

  const triggerSync = useCallback(async () => {
    if (syncing || !isBrowserOnline()) return
    const queue = getOfflineAttendanceQueue()
    if (queue.length === 0) return

    // One existence lookup per class/day instead of one per student, so a full
    // roster syncs quickly even on a weak connection.
    const groups = new Map<string, { classId: string; date: string }>()
    for (const record of queue) {
      const key = `${record.classId}|${record.date}`
      if (!groups.has(key)) {
        groups.set(key, { classId: record.classId, date: record.date })
      }
    }

    const existingMarks = new Map<string, CloudAttendanceMark>()
    const failedLookups = new Set<string>()
    await Promise.all(
      Array.from(groups.entries()).map(async ([key, group]) => {
        try {
          const existing = await rtdb.getAttendanceByClassAndDate(group.classId, group.date)
          existing.forEach((row) => existingMarks.set(row.id, { markedAt: row.markedAt }))
        } catch {
          failedLookups.add(key)
        }
      })
    )

    let conflicts = 0

    setSyncing(true)
    try {
      const result = await syncOfflineAttendance(async (record: QueuedAttendanceRecord) => {
        const payload = {
          id: record.id,
          studentId: record.studentId,
          classId: record.classId,
          date: record.date,
          status: record.status,
          studentName: record.studentName,
          className: record.className,
          teacherId: record.teacherId,
          markedBy: record.markedBy,
          markedAt: new Date(record.timestamp).toISOString(),
        }
        // Last-write-wins: a newer cloud edit (for example an admin correction)
        // wins over the offline mark, otherwise the offline mark is applied.
        const existing = failedLookups.has(`${record.classId}|${record.date}`)
          ? await rtdb.getAttendance(record.id)
          : existingMarks.get(record.id)
        const action = resolveAttendanceConflict(record, existing)

        if (action === 'skip') {
          conflicts += 1
          console.info(
            `[offline-sync] Skipped ${record.id}: the cloud record (${existing?.markedAt}) is newer than the offline mark (${payload.markedAt}).`
          )
          return
        }
        if (action === 'update') {
          await rtdb.updateAttendance(record.id, payload)
        } else {
          await rtdb.createAttendance(record.id, payload)
        }
      })

      if (result.synced > 0) {
        toast.success(t('offline.synced', { count: result.synced }))
      }
      if (result.failed > 0) {
        toast.error(t('offline.syncFailed', { count: result.failed }))
      }
      if (conflicts > 0) {
        console.info(`[offline-sync] ${conflicts} offline record(s) were skipped because the cloud copy was newer.`)
      }
    } catch (err) {
      console.error('Offline attendance sync failed:', err)
    } finally {
      setSyncing(false)
      refreshPending()
    }
  }, [syncing, refreshPending, t])

  useEffect(() => {
    refreshPending()
    if (isBrowserOnline() && getOfflineAttendanceQueue().length > 0) {
      triggerSync()
    }

    const handleOnline = () => {
      setOnline(true)
      toast.info(t('offline.reconnectedSyncing'))
      triggerSync()
    }

    const handleOffline = () => {
      setOnline(false)
      toast.warning(t('offline.workingOffline'))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync, refreshPending, t])

  return {
    isOnline: online,
    pendingCount,
    isSyncing: syncing,
    syncNow: triggerSync,
    refreshPending,
  }
}
