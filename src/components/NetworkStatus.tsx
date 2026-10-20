'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WifiOff } from 'lucide-react'

/**
 * A small, quiet pill that tells the user the device lost the connection.
 *
 * Offline work keeps working (marks are queued on the device), so the app
 * must never look frozen: the user sees that the app is alive, just offline.
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
      className="no-print pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur">
        <WifiOff className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
        {t('offline.banner')}
      </div>
    </div>
  )
}
