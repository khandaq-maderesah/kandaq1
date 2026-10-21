'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSaturday, sessionLogId, weekDays } from '@/lib/weeklyReport'
import type { SessionLog, WeeklyReport } from '@/types'

/** Day heading, e.g. "Monday, 20 Oct". */
export function useDayLabel() {
  const format = useFormatter()
  return (date: string) => {
    const parsed = new Date(`${date}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? date : format.dateTime(parsed, { weekday: 'long', day: 'numeric', month: 'short' })
  }
}

/** The two session chips of a day (held / not held), from the daily session log. */
export function SessionChips({ date, log }: { date: string; log: SessionLog | undefined }) {
  const t = useTranslations('weeklyReports')
  if (!log) return <span className="text-xs text-muted-foreground">{t('sessions.noLog')}</span>
  const items: { label: string; held: boolean }[] = [
    { label: t('sessions.quran'), held: log.quran },
    { label: isSaturday(date) ? t('sessions.review') : t('sessions.kitab'), held: log.kitab },
  ]
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            item.held ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          )}
        >
          {item.held ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {item.label}
        </span>
      ))}
    </span>
  )
}

/** Read-only rendering of a weekly report (admin view). */
export function WeeklyReportView({
  report,
  logs,
}: {
  report: WeeklyReport
  logs: Record<string, SessionLog | undefined>
}) {
  const t = useTranslations('weeklyReports')
  const dayLabel = useDayLabel()
  return (
    <div className="space-y-3">
      {weekDays(report.weekStart).map((date) => {
        const day = report.days?.[date]
        const saturday = isSaturday(date)
        return (
          <div key={date} className="rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{dayLabel(date)}</p>
              <SessionChips date={date} log={logs[sessionLogId(report.classId, date)]} />
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t('fields.quran')}</dt>
                <dd className="text-foreground">{day?.quran || '—'}</dd>
              </div>
              {!saturday && (
                <div>
                  <dt className="text-xs text-muted-foreground">{t('fields.kitab')}</dt>
                  <dd className="text-foreground">
                    {day?.kitab || '—'}
                    {day?.topic ? <span className="text-muted-foreground"> · {day.topic}</span> : null}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )
      })}
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">{t('fields.review')}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{report.review || '—'}</p>
      </div>
    </div>
  )
}
