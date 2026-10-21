'use client'

import { useTranslations } from 'next-intl'
import { WifiOff } from 'lucide-react'
import { EmptyState } from '@/components/ui/page'
import { cn } from '@/lib/utils'

/**
 * Shown in place of a list that has never been loaded on this device while the
 * device is offline. It replaces an endless skeleton with an explanation: once
 * the screen has been opened online it stays available offline.
 */
export function OfflineNotice({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations('common')
  if (compact) {
    return (
      <div
        className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground', className)}
        role="status"
      >
        <WifiOff className="h-6 w-6 text-amber-600" aria-hidden="true" />
        <p className="font-medium text-foreground">{t('offline.notCached')}</p>
        <p className="text-xs">{t('offline.notCachedHint')}</p>
      </div>
    )
  }
  return (
    <EmptyState
      className={className}
      icon={WifiOff}
      title={t('offline.notCached')}
      description={t('offline.notCachedHint')}
    />
  )
}
