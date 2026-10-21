/**
 * Offline queue for the daily session log (Qur'an / Kitab held or not),
 * saved together with the attendance. Same pattern as offlineAttendance.ts:
 * stored on the device, synced as soon as the connection is back.
 */
import type { SessionLog } from '@/types'

const STORAGE_KEY = 'kmms_offline_session_queue'

export function getOfflineSessionQueue(): SessionLog[] {
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

/** Saves a session log into the queue (replacing one for the same class/day). */
export function enqueueOfflineSession(log: SessionLog): void {
  if (typeof window === 'undefined') return
  try {
    const map = new Map<string, SessionLog>()
    for (const item of getOfflineSessionQueue()) map.set(item.id, item)
    map.set(log.id, log)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())))
  } catch (err) {
    console.error('Failed to save session log offline:', err)
  }
}

export function removeSyncedSessions(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    const remaining = getOfflineSessionQueue().filter((item) => !ids.includes(item.id))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
  } catch {
    /* ignore */
  }
}

/** Sends every queued session log with `submitFn`; the ones that fail stay queued. */
export async function syncOfflineSessions(
  submitFn: (log: SessionLog) => Promise<void>
): Promise<{ total: number; synced: number; failed: number }> {
  const queue = getOfflineSessionQueue()
  const synced: string[] = []
  for (const log of queue) {
    try {
      await submitFn(log)
      synced.push(log.id)
    } catch {
      /* stays in the queue */
    }
  }
  if (synced.length > 0) removeSyncedSessions(synced)
  return { total: queue.length, synced: synced.length, failed: queue.length - synced.length }
}
