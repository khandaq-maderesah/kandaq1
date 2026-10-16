'use client'

import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
  /** Items per page (default 10). */
  pageSize?: number
}

export function Pagination({ page, totalPages, totalItems, onPageChange, pageSize = 10 }: PaginationProps) {
  const t = useTranslations('common')
  if (totalPages <= 1) return null

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <nav className="no-print mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label={t('pagination.page', { page, pages: totalPages })}>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('pagination.showing', { from, to, total: totalItems })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="rtl:rotate-180" />
          {t('actions.previous')}
        </Button>
        <span className="px-1 text-sm tabular-nums text-muted-foreground">
          {t('pagination.page', { page, pages: totalPages })}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t('actions.next')}
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </nav>
  )
}
