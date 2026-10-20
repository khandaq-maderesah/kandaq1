'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { rtdb } from '@/lib/database'
import {
  getOfflineAttendanceQueue,
  isBrowserOnline,
  syncOfflineAttendance,
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

    setSyncing(true)
    try {
      const result = await syncOfflineAttendance(async (record: QueuedAttendanceRecord) => {
        await rtdb.createAttendance(record.id, {
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
        })
      })

      if (result.synced > 0) {
        toast.success(t('offline.synced', { count: result.synced }))
      }
      if (result.failed > 0) {
        toast.error(t('offline.syncFailed', { count: result.failed }))
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
