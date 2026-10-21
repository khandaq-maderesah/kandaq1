'use client'

/**
 * Shared live-data store (offline-first).
 *
 * The admin/teacher navigation bars mount several "bell" components, and each
 * page also subscribes to the same Firebase Realtime Database nodes. This store
 * keeps ONE underlying RTDB subscription per unique key and hands the same data
 * to every component that asks for it. The subscription is only brought down
 * when the last component stops using it; the last received snapshot stays
 * cached in memory so a fast remount renders instantly.
 *
 * Every snapshot is also mirrored to the device (see dataStorePersistence.ts).
 * A channel's first consumer therefore renders the last known data on the very
 * first frame, online or offline, and the live subscription replaces it the
 * moment the server answers. Without this the Realtime Database SDK, which has
 * no disk cache of its own, leaves every screen on a skeleton while offline.
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { getCurrentSchoolId } from '@/lib/database'
import {
  persistSelectorFor,
  readSnapshot,
  removeSnapshots,
  writeSnapshot,
} from '@/lib/dataStorePersistence'

export type StartProvider<T> = (emit: (data: T) => void) => () => void

type Listener = () => void

interface StoreEntry<T> {
  key: string
  rawKey: string
  data: T | undefined
  refs: number
  listeners: Set<Listener>
  provider: StartProvider<T>
  unsub: (() => void) | null
  persistTimer: ReturnType<typeof setTimeout> | null
}

const entries = new Map<string, StoreEntry<unknown>>()

const PERSIST_DEBOUNCE_MS = 250

/** Channels are per school, so a superadmin switching schools never sees the previous school's snapshot. */
function scopedKey(rawKey: string): string {
  return `${getCurrentSchoolId() ?? '-'}:${rawKey}`
}

function persistLater<T>(entry: StoreEntry<T>) {
  if (entry.persistTimer) clearTimeout(entry.persistTimer)
  entry.persistTimer = setTimeout(() => {
    entry.persistTimer = null
    if (entry.data === undefined) return
    const select = persistSelectorFor(entry.rawKey)
    writeSnapshot(entry.key, select ? select(entry.data) : entry.data)
  }, PERSIST_DEBOUNCE_MS)
}

function getEntry<T>(rawKey: string, provider: StartProvider<T>): StoreEntry<T> {
  const key = scopedKey(rawKey)
  const existing = entries.get(key) as StoreEntry<T> | undefined
  if (existing) return existing

  const entry: StoreEntry<T> = {
    key,
    rawKey,
    // Last known snapshot from the device, so the first render is never empty.
    data: readSnapshot<T>(key),
    refs: 0,
    listeners: new Set(),
    provider,
    unsub: null,
    persistTimer: null,
  }
  entries.set(key, entry as StoreEntry<unknown>)
  return entry
}

function startEntry<T>(entry: StoreEntry<T>) {
  if (entry.unsub) return
  const emit = (data: T) => {
    entry.data = data
    persistLater(entry)
    entry.listeners.forEach((l) => l())
  }
  try {
    entry.unsub = entry.provider(emit) || (() => {})
  } catch (err) {
    console.error(`[dataStore] failed to start subscription "${entry.key}"`, err)
  }
}

function stopEntry<T>(entry: StoreEntry<T>) {
  if (entry.unsub) {
    entry.unsub()
    entry.unsub = null
  }
  // The value stays cached in memory (and on the device) for a quick remount.
}

function attach<T>(entry: StoreEntry<T>, onChange: Listener): () => void {
  entry.listeners.add(onChange)
  entry.refs += 1
  if (entry.refs === 1) startEntry(entry)
  return () => {
    entry.listeners.delete(onChange)
    entry.refs -= 1
    if (entry.refs <= 0) stopEntry(entry)
  }
}

const getServerSnapshot = () => undefined

/**
 * Subscribe to a live collection/query. `key` identifies the shared channel
 * (use the same key for the same data, e.g. 'students', 'classes',
 * 'attendance:since:2026-08-15'). When `key` is null no subscription is
 * created and `data` stays undefined (use this for data you only want when a
 * flag is enabled).
 *
 * `startProvider` is called once while the key's first consumer mounts, so it
 * can be an inline closure capturing the query parameters baked into `key`.
 *
 * `data` is undefined only when nothing is known yet: no snapshot has arrived
 * in this session AND none was saved on the device by an earlier one.
 */
export function useLiveData<T>(rawKey: string | null, startProvider: StartProvider<T>): { data: T | undefined } {
  const providerRef = useRef(startProvider)
  providerRef.current = startProvider

  const subscribe = useCallback(
    (onChange: Listener) => {
      if (!rawKey) return () => {}
      return attach(getEntry<T>(rawKey, providerRef.current), onChange)
    },
    [rawKey]
  )

  const getSnapshot = useCallback((): T | undefined => {
    if (!rawKey) return undefined
    return getEntry<T>(rawKey, providerRef.current).data
  }, [rawKey])

  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { data }
}

const ID_SEPARATOR = '\u0000'

/**
 * Subscribe to a dynamic list of channels of the same shape (e.g. the students
 * of each of a teacher's classes). Returns one slot per id, in order, or
 * undefined while `ids` is null. A slot is undefined until its channel has
 * data (live or from the device).
 */
export function useLiveDataMany<T>(
  ids: readonly string[] | null,
  channel: { keyFor: (id: string) => string; startFor: (id: string) => StartProvider<T> }
): (T | undefined)[] | undefined {
  const channelRef = useRef(channel)
  channelRef.current = channel

  // A stable identity for the id list, so consumers can pass fresh arrays.
  const idList = useMemo(() => (ids ? ids.join(ID_SEPARATOR) : null), [ids])
  const stableIds = useMemo(
    () => (idList === null ? null : idList === '' ? [] : idList.split(ID_SEPARATOR)),
    [idList]
  )

  const subscribe = useCallback(
    (onChange: Listener) => {
      if (!stableIds) return () => {}
      const detach = stableIds.map((id) =>
        attach(getEntry<T>(channelRef.current.keyFor(id), channelRef.current.startFor(id)), onChange)
      )
      return () => detach.forEach((d) => d())
    },
    [stableIds]
  )

  // useSyncExternalStore needs a referentially stable snapshot while nothing
  // changed, so the slots array is only rebuilt when one of its parts changed.
  const lastRef = useRef<{ idList: string | null; parts: (T | undefined)[] } | null>(null)
  const getSnapshot = useCallback((): (T | undefined)[] | undefined => {
    if (!stableIds) return undefined
    const parts = stableIds.map(
      (id) => getEntry<T>(channelRef.current.keyFor(id), channelRef.current.startFor(id)).data
    )
    const last = lastRef.current
    if (
      last &&
      last.idList === idList &&
      last.parts.length === parts.length &&
      last.parts.every((p, i) => p === parts[i])
    ) {
      return last.parts
    }
    lastRef.current = { idList, parts }
    return parts
  }, [stableIds, idList])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Forgets everything cached in memory and on the device (sign-out). */
export function clearLiveDataCache(): void {
  entries.forEach((entry) => {
    if (entry.persistTimer) clearTimeout(entry.persistTimer)
    stopEntry(entry)
  })
  entries.clear()
  removeSnapshots()
}
