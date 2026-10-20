/**
 * Offline Attendance Queue Engine & Auto-Sync.
 * Enables Ustazes to record attendance completely offline without continuous internet.
 * Records are stored safely in local device storage and automatically synchronized
 * to Firebase Realtime Database as soon as an internet connection is established.
 */

export interface QueuedAttendanceRecord {
  id: string // e.g. classId_date_studentId
  studentId: string
  classId: string
  date: string // YYYY-MM-DD
  status: 'present' | 'absent' | 'late' | 'excused'
  studentName?: string
  className?: string
  teacherId?: string
  markedBy?: string
  timestamp: number
  retryCount: number
}

const STORAGE_KEY = 'kmms_offline_attendance_queue'

/**
 * Returns all pending attendance records currently stored offline.
 */
export function getOfflineAttendanceQueue(): QueuedAttendanceRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Saves a list of attendance records into the offline queue (replacing existing duplicate entries).
 */
export function enqueueOfflineAttendance(records: QueuedAttendanceRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    const current = getOfflineAttendanceQueue()
    const map = new Map<string, QueuedAttendanceRecord>()

    // Existing queue
    for (const item of current) {
      map.set(item.id, item)
    }

    // New/updated records
    for (const item of records) {
      map.set(item.id, item)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())))
  } catch (err) {
    console.error('Failed to save attendance offline:', err)
  }
}

/**
 * Removes successfully synced records from the offline queue.
 */
export function removeSyncedRecords(syncedIds: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const current = getOfflineAttendanceQueue()
    const remaining = current.filter((item) => !syncedIds.includes(item.id))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
  } catch (err) {
    console.error('Failed to remove synced records:', err)
  }
}

/**
 * Clears the entire offline attendance queue.
 */
export function clearOfflineAttendanceQueue(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Checks if the browser currently reports an active internet connection.
 */
export function isBrowserOnline(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine !== false
}

export interface SyncResult {
  total: number
  synced: number
  failed: number
  errors: string[]
}

/**
 * Dispatches all pending offline records to Firebase RTDB.
 * Takes the database submit function as parameter to remain decoupled and testable.
 */
export async function syncOfflineAttendance(
  submitFn: (record: QueuedAttendanceRecord) => Promise<void>
): Promise<SyncResult> {
  const queue = getOfflineAttendanceQueue()
  if (queue.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] }
  }

  const syncedIds: string[] = []
  const errors: string[] = []

  for (const record of queue) {
    try {
      await submitFn(record)
      syncedIds.push(record.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Failed record ${record.id}: ${message}`)
    }
  }

  if (syncedIds.length > 0) {
    removeSyncedRecords(syncedIds)
  }

  // Increment retryCount for failed records remaining in queue
  if (errors.length > 0) {
    try {
      const remaining = getOfflineAttendanceQueue().map((item) => {
        if (!syncedIds.includes(item.id)) {
          return { ...item, retryCount: (item.retryCount || 0) + 1 }
        }
        return item
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
    } catch {
      /* ignore */
    }
  }

  return {
    total: queue.length,
    synced: syncedIds.length,
    failed: queue.length - syncedIds.length,
    errors,
  }
}
