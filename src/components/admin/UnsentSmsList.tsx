'use client'

import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { CheckCircle2, MessageSquareDashed, MessageSquare, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import { useUnsentAbsenceSms } from '@/hooks/useUnsentAbsenceSms'
import { groupByUstaz } from '@/lib/absenceSms'

/**
 * The Ustazes who saved absent students but did not text the parents, with the
 * days and classes concerned and a way to reach them. Empty when all is well.
 */
export function UnsentSmsList() {
  const t = useTranslations('absenceSms.admin')
  const tp = useTranslations('ustazPresence.board')
  const format = useFormatter()
  const eth = useEthiopianDate()
  const { rows, ready } = useUnsentAbsenceSms(true)
  const byUstaz = useMemo(() => groupByUstaz(rows), [rows])

  if (!ready) return null

  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('allSent')}
      </p>
    )
  }

  const day = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' })
  const time = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'short', timeStyle: 'short' })

  return (
    <section aria-labelledby="unsent-sms-title" className="rounded-xl border border-destructive/40 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <MessageSquareDashed className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="unsent-sms-title" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Badge variant="destructive">{t('count', { count: byUstaz.length })}</Badge>
      </div>

      <ul className="mt-4 space-y-3">
        {byUstaz.map((u) => (
          <li key={u.teacherId} className="rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{u.teacherName}</p>
                <p className="text-xs text-muted-foreground">{t('days', { count: u.days.length })}</p>
              </div>
              {u.phone && (
                <div className="flex items-center gap-1">
                  <a
                    href={`tel:${u.phone}`}
                    aria-label={tp('call', { name: u.teacherName })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-accent"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <a
                    href={`sms:${u.phone}`}
                    aria-label={tp('sms', { name: u.teacherName })}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-accent"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
            <ul className="mt-2 divide-y text-sm">
              {u.days.map((d) => (
                <li key={d.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5">
                  <span className="text-foreground">
                    {day(d.date)}
                    {eth.format(d.date) ? <span className="text-xs text-muted-foreground"> · {eth.format(d.date)}</span> : null}
                    <span className="text-muted-foreground"> · {d.section ? `${d.className} · ${d.section}` : d.className}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('absent', { count: d.absentCount })} · {t('saved', { time: time(d.savedAt) })}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
