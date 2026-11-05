'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WifiOff } from 'lucide-react'

/**
 * A small, quiet pill that tells the user the device lost the connection.
 *
 * Offline work keeps working (marks are queued on the device), so the app
 * must never look frozen: the user sees that the app is alive, just offline.
 *
 * It sits at the TOP, just under the app bar. At the bottom it covered the
 * sticky "Save" bars of the attendance and report screens, and the longer
 * sentences of some languages made it wrap and cover even more. The pill shows
 * a short label in every language; the full sentence is the tooltip and what
 * screen readers announce.
 */
export function NetworkStatus() {
  const t = useTranslations('common')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 top-[4.25rem] z-[25] flex justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label={t('offline.banner')}
    >
      <div
        title={t('offline.banner')}
        className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="truncate">{t('offline.short')}</span>
      </div>
    </div>
  )
}
