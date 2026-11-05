/**
 * Browser side of the push notifications (the Ustaz's attendance reminder, the
 * admin's "who did not text the parents" list): ask permission, subscribe this
 * device to Web Push and keep the subscription saved for the signed-in user
 * (pushSubs/{uid}/{id}). The server sends the actual notifications.
 */
import { rtdb } from '@/lib/database'
import type { PushSubscriptionRecord } from '@/types'

/** Public VAPID key (identifies this app to the browsers' push services). */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export type PushStatus =
  | 'unsupported' // this browser cannot receive push notifications
  | 'needs-install' // iPhone/iPad: only works once the app is on the Home Screen
  | 'denied' // the Ustaz blocked notifications in the browser settings
  | 'off' // available, not turned on yet
  | 'on'

function isIosBrowserTab(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  return ios && !standalone
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!VAPID_PUBLIC_KEY &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Base64url public key -> the bytes `pushManager.subscribe` wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** A database-safe, stable id for a device (hash of its push endpoint). */
export async function subscriptionId(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function getPushStatus(): Promise<PushStatus> {
  if (isIosBrowserTab()) return 'needs-install'
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

function toRecord(sub: PushSubscription, language: string): PushSubscriptionRecord | null {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, language }
}

/** Saves (or refreshes) this device's subscription for the signed-in user. */
export async function saveSubscription(uid: string, sub: PushSubscription, language: string): Promise<void> {
  const record = toRecord(sub, language)
  if (!record) throw new Error('Incomplete push subscription')
  await rtdb.setPushSubscription(uid, await subscriptionId(record.endpoint), record)
}

/** Asks permission, subscribes this device and saves it. Returns the new status. */
export async function enablePush(uid: string, language: string): Promise<PushStatus> {
  if (isIosBrowserTab()) return 'needs-install'
  if (!isPushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))
  await saveSubscription(uid, sub, language)
  return 'on'
}

/** Stops reminders on this device: unsubscribes and forgets the saved record. */
export async function disablePush(uid: string): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  const id = await subscriptionId(sub.endpoint)
  await sub.unsubscribe()
  await rtdb.removePushSubscription(uid, id)
}

/** Shows a notification on this device right now (so the user can see what it looks like). */
export async function showTestNotification(texts: { title: string; body: string; action: string; url: string }): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(texts.title, {
    body: texts.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'push-test',
    data: { url: texts.url },
    actions: [{ action: 'open', title: texts.action }],
  } as NotificationOptions)
}
