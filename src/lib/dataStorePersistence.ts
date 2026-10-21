/**
 * On-device persistence for the live data store (see dataStore.ts).
 *
 * The Realtime Database web SDK keeps no disk cache: without a connection a
 * subscription simply never answers. Every snapshot the app receives is
 * therefore mirrored into localStorage, so the next start (online or offline)
 * renders the last known data at once and the live subscription refreshes it
 * when the network is back.
 *
 * localStorage is used on purpose: it is synchronous, so the very first render
 * already has the data (no skeleton flash). It is small, so big channels are
 * trimmed before writing and anything over the cap is simply not persisted.
 */

export const SNAPSHOT_PREFIX = 'kmms:ds:v1:'

/** One snapshot never exceeds this many characters of JSON. */
export const MAX_SNAPSHOT_CHARS = 1_500_000

/** Attendance history kept on the device (days back from today). */
export const ATTENDANCE_PERSIST_DAYS = 90

/** Hard cap on the number of attendance rows kept on the device. */
export const ATTENDANCE_PERSIST_MAX_ROWS = 6000

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function snapshotKey(storeKey: string): string {
  return SNAPSHOT_PREFIX + storeKey
}

export function readSnapshot<T>(storeKey: string, storage: StorageLike | null = defaultStorage()): T | undefined {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(snapshotKey(storeKey))
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/**
 * Writes a snapshot. Returns false when it was skipped (too large, quota
 * exceeded or storage unavailable) — the app keeps working without it.
 */
export function writeSnapshot(storeKey: string, value: unknown, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  const key = snapshotKey(storeKey)
  try {
    const json = JSON.stringify(value)
    if (typeof json !== 'string' || json.length > MAX_SNAPSHOT_CHARS) {
      storage.removeItem(key)
      return false
    }
    storage.setItem(key, json)
    return true
  } catch {
    // Quota exceeded or private mode: drop this entry, never break the app.
    try {
      storage.removeItem(key)
    } catch {
      /* ignore */
    }
    return false
  }
}

/** Removes every persisted snapshot (sign-out). */
export function removeSnapshots(storage: StorageLike | null = defaultStorage()): number {
  if (!storage) return 0
  const doomed: string[] = []
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(SNAPSHOT_PREFIX)) doomed.push(key)
    }
    doomed.forEach((key) => storage.removeItem(key))
  } catch {
    /* ignore */
  }
  return doomed.length
}

function isoDaysAgo(days: number, now: Date): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Attendance channels can hold a whole school year, far more than a phone needs
 * offline. Keep only the recent rows (newest first) within a hard row cap.
 */
export function recentAttendanceOnly<T extends { date: string }>(
  records: T[],
  now: Date = new Date(),
  days: number = ATTENDANCE_PERSIST_DAYS,
  maxRows: number = ATTENDANCE_PERSIST_MAX_ROWS
): T[] {
  const since = isoDaysAgo(days, now)
  return records
    .filter((r) => typeof r.date === 'string' && r.date >= since)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, maxRows)
}

/**
 * What to persist for a channel, by its (school-independent) key. Channels not
 * listed here are persisted as-is.
 */
export function persistSelectorFor(rawKey: string): ((data: unknown) => unknown) | null {
  if (rawKey.startsWith('attendance:')) {
    return (data) => (Array.isArray(data) ? recentAttendanceOnly(data as { date: string }[]) : data)
  }
  return null
}
