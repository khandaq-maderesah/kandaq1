'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, MessageSquareDashed } from 'lucide-react'
import { useUnsentAbsenceSms } from '@/hooks/useUnsentAbsenceSms'
import { buttonVariants } from '@/components/ui/button'

/** Admin dashboard: shown only while some Ustaz has not texted the parents of absent students. */
export function UnsentSmsBanner() {
  const t = useTranslations('absenceSms.admin')
  const { rows } = useUnsentAbsenceSms(true)
  if (rows.length === 0) return null
  return (
    <Link
      href="/admin/attendance#ustaz"
      className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <MessageSquareDashed className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{t('banner', { count: rows.length })}</p>
      <span className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        {t('view')} <ChevronRight className="rtl:rotate-180" />
      </span>
    </Link>
  )
}
