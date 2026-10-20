'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OfflineScreenProps {
  /** Called when the user asks to try again. Defaults to a page reload. */
  onRetry?: () => void
  /** Shown under the title, e.g. what still works while offline. */
  message?: string
}

/**
 * The screen shown when the app cannot reach the server.
 *
 * It replaces the old "spinner forever" behaviour: the app must never leave a
 * user staring at a rotating loader with no explanation and no way out.
 */
export function OfflineScreen({ onRetry, message }: OfflineScreenProps) {
  const t = useTranslations('common')
  const [retrying, setRetrying] = useState(false)

  const retry = useCallback(() => {
    setRetrying(true)
    if (onRetry) {
      onRetry()
      return
    }
    window.location.reload()
  }, [onRetry])

  // The moment the connection is back, try again by itself.
  useEffect(() => {
    const onOnline = () => retry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retry])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm"
        role="alert"
        aria-live="polite"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CloudOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-base font-semibold text-foreground">{t('offline.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {message ?? t('offline.description')}
        </p>
        <Button type="button" className="mt-5 w-full" onClick={retry} disabled={retrying}>
          <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} aria-hidden="true" />
          {t('offline.retry')}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">{t('offline.waiting')}</p>
      </div>
    </div>
  )
}
