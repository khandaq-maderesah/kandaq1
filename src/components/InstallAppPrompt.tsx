'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Smartphone, X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const IOS_HINTS = [
  'Tap the Share button in Safari.',
  'Scroll down and tap "Add to Home Screen".',
  'Tap "Add" and Ansar Madresah will appear on your home screen.',
]

export function InstallAppPrompt() {
  const { user } = useAuth()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIosHints, setShowIosHints] = useState(false)
  const lastUid = useRef<string | null>(null)

  // Return a per-user flag so the banner resets on a new login.
  const storageKey = user ? `ansar_install_dismissed_${user.uid}` : null

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (user && lastUid.current !== user.uid) {
      lastUid.current = user.uid
      setDismissed(false)
    }
    if (!user) return

    // Already running as an installed app?
    setAppInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const ua = window.navigator.userAgent || ''
    setIsIos(/iphone|ipad|ipod/i.test(ua))

    const saved = storageKey ? sessionStorage.getItem(storageKey) : null
    if (saved === '1') setDismissed(true)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setAppInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Register the service worker for app-like / offline support.
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [user, storageKey])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setAppInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    if (storageKey) sessionStorage.setItem(storageKey, '1')
  }

  // Only show after login, and not when already installed / dismissed.
  if (!user || appInstalled || dismissed) return null
  // Show only when install is actually available: native prompt OR iOS.
  if (!deferredPrompt && !isIos) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        <div className="flex items-start gap-3 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Ansar Madresah logo"
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Install Ansar Madresah</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {isIos
                ? 'Add Ansar Madresah to your home screen to use it like an app.'
                : 'Install the app on your device for quicker access and offline support.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isIos ? (
          <div className="border-t border-slate-100 p-4">
            {!showIosHints ? (
              <button
                type="button"
                onClick={() => setShowIosHints(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                <Share className="h-4 w-4" /> How to add to home screen
              </button>
            ) : (
              <ol className="space-y-1.5 text-xs text-slate-600">
                {IOS_HINTS.map((hint, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    {hint}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              <Smartphone className="h-4 w-4" /> Install App
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}