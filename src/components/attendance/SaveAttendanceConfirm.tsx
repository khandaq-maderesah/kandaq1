'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, Check, Clock, ShieldCheck, X, type LucideIcon } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

const STATUS_VIEW: { status: AttendanceStatus; icon: LucideIcon; tone: string }[] = [
  { status: 'present', icon: Check, tone: 'bg-success/10 text-success' },
  { status: 'absent', icon: X, tone: 'bg-destructive/10 text-destructive' },
  { status: 'late', icon: Clock, tone: 'bg-warning/10 text-warning' },
  { status: 'excused', icon: ShieldCheck, tone: 'bg-info/10 text-info' },
]

/**
 * "Save attendance?" - shows what is about to be recorded (class, day and a
 * count per status) so a wrong class, day or mark is caught before it is saved.
 * It also says when the day is not today, when some students have no mark and
 * will be skipped, and that the absent students' parents are texted next.
 */
export function SaveAttendanceConfirm({
  open,
  onOpenChange,
  onConfirm,
  className,
  dateLabel,
  isToday,
  counts,
  unmarked = 0,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  className: string
  /** The day, already formatted for the reader. */
  dateLabel: string
  isToday: boolean
  counts: Record<AttendanceStatus, number>
  /** Students without a mark, who will not be recorded. */
  unmarked?: number
}) {
  const t = useTranslations('confirm.saveAttendance')
  const ts = useTranslations('teacherAttendance.status')
  const total = STATUS_VIEW.reduce((n, v) => n + counts[v.status], 0)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description', { className, date: dateLabel, count: total })}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      onConfirm={onConfirm}
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUS_VIEW.map(({ status, icon: Icon, tone }) => (
          <div key={status} className={cn('flex items-center gap-2 rounded-lg px-3 py-2', tone)}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <dd className="text-lg font-semibold leading-none tabular-nums">{counts[status]}</dd>
              <dt className="mt-0.5 truncate text-xs">{ts(status)}</dt>
            </div>
          </div>
        ))}
      </dl>

      {(!isToday || unmarked > 0) && (
        <ul className="space-y-1.5">
          {!isToday && (
            <li className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t('pastDay', { date: dateLabel })}
            </li>
          )}
          {unmarked > 0 && (
            <li className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t('unmarked', { count: unmarked })}
            </li>
          )}
        </ul>
      )}

      {counts.absent > 0 && <p className="text-xs text-muted-foreground">{t('smsNext')}</p>}
    </ConfirmDialog>
  )
}
