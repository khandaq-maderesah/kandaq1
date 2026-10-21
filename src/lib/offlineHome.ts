/**
 * Tells the service worker which screen this account's installed app opens on.
 *
 * The worker answers the app's start URL ('/', '/login', '/dashboard' or the
 * madrasa's /m/{slug} link) with a redirect to that screen, exactly like the
 * server middleware does online, so the sign-in/landing page never flashes and
 * the dashboard appears on the first paint, with or without a network.
 * It also precaches every page of that area, so screens the user has not opened
 * yet still work offline.
 */

type HomeMessage = { type: 'SET_HOME'; path: string } | { type: 'CLEAR_HOME' }

function post(message: HomeMessage) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage(message))
      .catch(() => {
        /* no worker: the app works without it */
      })
  } catch {
    /* ignore */
  }
}

export function announceOfflineHome(path: string | null): void {
  if (path) post({ type: 'SET_HOME', path })
  else post({ type: 'CLEAR_HOME' })
}
