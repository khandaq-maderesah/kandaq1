'use client'

/**
 * Shared live-data store.
 *
 * The admin/teacher navigation bars mount several "bell" components, and each
 * page also subscribes to the same Firebase Realtime Database nodes. Before
 * this module existed EVERY one of those subscriptions was a separate realtime
 * channel, so one screen would download the whole `attendance` node 3 times,
 * `students` 2-3 times, `classes` 3 times and `users` 2 times simultaneously.
 *
 * This store keeps ONE underlying RTDB subscription per unique key and hands
 * the same data to every component that asks for it. The subscription is only
 * brought down (unsubscribe) when the last component stops using it; the last
 * received snapshot stays cached in memory so a fast remount renders instantly.
 */

import { useEffect, useRef, useState } from 'react'

type Listener<T> = (data: T) => void

interface StoreEntry<T> {
  data: T | undefined
  refs: number
  listeners: Set<Listener<T>>
  start: (() => void) | null
  unsub: (() => void) | null
}

const entries = new Map<string, StoreEntry<unknown>>()

function getEntry<T>(
  key: string,
  startProvider: (emit: (data: T) => void) => () => void
): StoreEntry<T> {
  const entry = entries.get(key) as StoreEntry<T> | undefined
  if (entry) return entry

  const newEntry: StoreEntry<T> = {
    data: undefined,
    refs: 0,
    listeners: new Set(),
    start: null,
    unsub: null,
  }

  const emit = (data: T) => {
    const e = entries.get(key) as StoreEntry<T> | undefined
    if (!e) return
    e.data = data
    e.listeners.forEach((l) => l(data))
  }

  newEntry.start = () => {
    if (newEntry.unsub) return
    try {
      newEntry.unsub = startProvider(emit) || (() => {})
    } catch (err) {
      console.error(`[dataStore] failed to start subscription "${key}"`, err)
    }
  }

  entries.set(key, newEntry as StoreEntry<unknown>)
  return newEntry
}

/**
 * Subscribe to a live collection/query. `key` identifies the shared channel
 * (use the same key for the same data — e.g. 'students', 'classes',
 * 'attendance:since:2026-08-15'). When `key` is null no subscription is
 * created and `data` stays undefined (use this for data you only want when a
 * flag is enabled).
 *
 * `startProvider` is called once while the key's first consumer mounts, so it
 * can be an inline closure capturing the query parameters baked into `key`.
 */
export function useLiveData<T>(
  key: string | null,
  startProvider: (emit: (data: T) => void) => () => void
): { data: T | undefined } {
  // `tick` is intentionally unused — it exists only to trigger re-renders when
  // a new snapshot arrives (we read the value from a ref below).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0)
  const dataRef = useRef<T | undefined>(undefined)

  useEffect(() => {
    if (!key) {
      dataRef.current = undefined
      setTick((n) => n + 1)
      return
    }

    const entry = getEntry<T>(key, startProvider)

    // Keep a local copy so `data` returned below is the freshest value even
    // before a re-render is flushed.
    if (entry.data !== undefined) {
      dataRef.current = entry.data
    }

    entry.refs += 1
    if (entry.refs === 1 && entry.start) {
      entry.start()
    }

    const listener: Listener<T> = (data) => {
      dataRef.current = data
      setTick((n) => n + 1)
    }

    entry.listeners.add(listener)

    // If the value already arrived while we were mounting, push it immediately
    // so this consumer does not block on a spurious "undefined" render.
    if (entry.data !== undefined) {
      dataRef.current = entry.data
      setTick((n) => n + 1)
    }

    return () => {
      entry.listeners.delete(listener)
      entry.refs -= 1
      if (entry.refs <= 0) {
        if (entry.unsub) {
          entry.unsub()
          entry.unsub = null
        }
        // Keep the value cached in memory so a quick remount is instant, but
        // drop the live subscription.
      }
    }
    // Re-run only when the key changes; the provider closure is captured by the
    // entry that owns it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data: dataRef.current }
}