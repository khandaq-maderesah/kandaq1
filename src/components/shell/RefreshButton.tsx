'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Reloads the screen. The installed app has no browser bar and no
 * pull-to-refresh, so this is the one way to force a fresh start. Before
 * reloading it asks the service worker to look for a newer app version, so
 * a refresh also picks up an update that was deployed meanwhile.
 */
export function RefreshButton() {
  const t = useTranslations('nav')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.onLine) {
        const registration = await navigator.serviceWorker.getRegistration()
        // Bounded: a dead network must never hold the refresh.
        await Promise.race([registration?.update(), new Promise((resolve) => setTimeout(resolve, 1500))])
      }
    } catch {
      /* the reload below is what matters */
    }
    window.location.reload()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={refresh}
      disabled={busy}
      aria-label={t('refresh')}
      title={t('refresh')}
    >
      <RefreshCw className={cn('h-5 w-5', busy && 'animate-spin')} aria-hidden="true" />
    </Button>
  )
}
