export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.requestPermission()
}

interface ShowOptions {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function showBrowserNotification({ title, body, url = '/admin/attendance', tag }: ShowOptions): Promise<void> {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  const storageKey = `kmms_notif_${tag || title}_${new Date().toISOString().slice(0, 10)}`
  if (localStorage.getItem(storageKey)) return
  localStorage.setItem(storageKey, '1')

  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: url,
    tag: tag || title,
  }

  try {
    const reg = await navigator.serviceWorker.ready
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, options)
      return
    }
  } catch {
    // fall through
  }
  try {
    new Notification(title, options)
  } catch {
    // ignore
  }
}
