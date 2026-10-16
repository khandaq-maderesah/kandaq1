'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Smartphone, X, Share } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { brandingAssetUrl, DEFAULT_APP_NAME } from '@/lib/branding'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const IOS_STEPS = ['iosStep1', 'iosStep2', 'iosStep3'] as const

export function InstallAppPrompt() {
  const t = useTranslations('notifications.install')
  const { user, school, branding } = useAuth()
  // The app being installed: the madrasa's own when it has branding, else MMS.
  const app = branding?.appName ?? DEFAULT_APP_NAME
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIosHints, setShowIosHints] = useState(false)
  const lastUid = useRef<string | null>(null)

  // Return a per-user flag so the banner resets on a new login.
  const storageKey = user ? `khandaq_install_dismissed_${user.uid}` : null

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

    let saved: string | null = null
    try {
      saved = storageKey ? sessionStorage.getItem(storageKey) : null
    } catch {
      /* storage unavailable */
    }
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
    try {
      if (storageKey) sessionStorage.setItem(storageKey, '1')
    } catch {
      /* storage unavailable */
    }
  }

  // Only show after login, and not when already installed / dismissed.
  if (!user || appInstalled || dismissed) return null
  // Show only when install is actually available: native prompt OR iOS.
  if (!deferredPrompt && !isIos) return null

  return (
    <div className="no-print fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md" role="dialog" aria-labelledby="install-app-title">
      <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
        <div className="flex items-start gap-3 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandingAssetUrl(school?.id, branding, 'icon192')} alt="" className="h-12 w-12 shrink-0 rounded-xl border object-cover" />
          <div className="min-w-0 flex-1">
            <p id="install-app-title" className="text-sm font-semibold text-foreground">
              {t('title', { app })}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {isIos ? t('descriptionIos', { app }) : t('description')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            aria-label={t('dismiss')}
            className="-me-1 -mt-1 shrink-0 text-muted-foreground"
          >
            <X />
          </Button>
        </div>

        {isIos ? (
          <div className="border-t p-4">
            {!showIosHints ? (
              <Button type="button" className="w-full" onClick={() => setShowIosHints(true)}>
                <Share /> {t('iosHowTo')}
              </Button>
            ) : (
              <ol className="space-y-2 text-sm text-muted-foreground">
                {IOS_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    {t(step, { app })}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t p-3">
            <Button type="button" className="flex-1" onClick={handleInstall}>
              <Smartphone /> {t('install')}
            </Button>
            <Button type="button" variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
              {t('notNow')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
