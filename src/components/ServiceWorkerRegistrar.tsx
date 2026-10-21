'use client'

import { useEffect } from 'react'

/**
 * Bump this whenever public/sw.js changes.
 *
 * The version is a query string on the script URL, so the browser treats it as
 * a brand new worker and installs it immediately. Without it, the browser may
 * keep serving the previously cached /sw.js (the CDN sends it with a 4 hour
 * Cache-Control), and a fixed offline bug would stay broken on every device
 * that already installed the app.
 */
const SW_VERSION = 'v5'
const SW_URL = `/sw.js?v=${SW_VERSION}`

declare global {
  interface Window {
    /** Set as soon as the app boots, so the offline boot guard knows the bundle loaded. */
    __kmmsBooted?: boolean
  }
}

/**
 * Registers the service worker and keeps it up to date.
 *
 * It is mounted in the root layout on every page (never behind a sign-in
 * check) so the app is offline-capable from the very first visit, and it is
 * deliberately not reloading the page on `controllerchange`: a new worker takes
 * over with `clients.claim()`, the next navigation uses it, and the user is
 * never interrupted mid-task (for example while marking attendance).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // The app is alive: the offline boot guard must not send the user away.
    window.__kmmsBooted = true

    if (!('serviceWorker' in navigator) || !window.isSecureContext) return

    let registration: ServiceWorkerRegistration | null = null

    navigator.serviceWorker
      .register(SW_URL, { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // A new worker is ready: let it take over as soon as possible.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
        // Pick up a worker that finished installing while the page was closed.
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
      .catch(() => {
        /* the app works fine without a service worker */
      })

    return () => {
      if (registration) registration.removeEventListener('updatefound', () => {})
    }
  }, [])

  return null
}
