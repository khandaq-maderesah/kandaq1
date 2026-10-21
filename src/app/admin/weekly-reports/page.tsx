'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Unlock } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { useAllSessionLogs, useAllWeeklyReports, useSessionLogMap } from '@/hooks/useWeeklyReports'
import { addDays, reportWeekFor, weekStartOf, weeklyReportId } from '@/lib/weeklyReport'
import { WeeklyReportView } from '@/components/reports/WeeklyReportView'
import { OfflineNotice } from '@/components/OfflineNotice'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Class, WeeklyReport } from '@/types'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function AdminWeeklyReportsPage() {
  const t = useTranslations('weeklyReports')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { user, offline } = useAuth()
  const liveClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit)).data
  const reports = useAllWeeklyReports(true)
  const logs = useSessionLogMap(useAllSessionLogs(true))

  const currentWeek = weekStartOf(todayIso())
  const [weekStart, setWeekStart] = useState(reportWeekFor(todayIso()))
  const [open, setOpen] = useState<WeeklyReport | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const classes = useMemo(
    () => (liveClasses ?? []).filter((c) => c.isActive !== false && c.teacherId).sort((a, b) => a.name.localeCompare(b.name)),
    [liveClasses]
  )
  const byId = useMemo(() => {
    const m: Record<string, WeeklyReport | undefined> = {}
    for (const r of reports ?? []) m[r.id] = r
    return m
  }, [reports])

  const rows = classes.map((c) => ({ cls: c, report: byId[weeklyReportId(c.id, weekStart)] }))
  const submittedCount = rows.filter((r) => r.report?.status === 'submitted').length
  const missingCount = rows.length - submittedCount
  const loading = liveClasses === undefined || reports === undefined

  const weekLabel = (ws: string) =>
    t('weekOf', { date: format.dateTime(new Date(`${ws}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) })

  const statusBadge = (report: WeeklyReport | undefined) => {
    if (report?.status === 'submitted') return <Badge variant="success">{t('status.submitted')}</Badge>
    if (report) return <Badge variant="secondary">{t('status.draft')}</Badge>
    return <Badge variant="destructive">{t('status.missing')}</Badge>
  }

  const unlock = async () => {
    if (!open || !user) return
    setUnlocking(true)
    try {
      await rtdb.updateWeeklyReport(open.teacherId, open.id, {
        status: 'draft',
        unlockedBy: user.uid,
        updatedAt: new Date().toISOString(),
      })
      toast.success(t('toast.unlocked'))
      setOpen(null)
    } catch {
      toast.error(t('toast.failed'))
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('adminTitle')} description={t('adminDescription')} />

      <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
        <div className="space-y-2">
          <Label>{t('week')}</Label>
          <div className="flex h-11 items-center justify-between gap-2 rounded-lg border bg-background px-1 sm:max-w-sm">
            <Button type="button" variant="ghost" size="icon" aria-label={t('previousWeek')} onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {weekLabel(weekStart)}
              {weekStart === currentWeek ? <span className="ms-1 text-xs text-muted-foreground">({t('thisWeek')})</span> : null}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('nextWeek')}
              disabled={weekStart >= currentWeek}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('summary.submitted', { count: submittedCount })}</Badge>
            <Badge variant={missingCount > 0 ? 'destructive' : 'secondary'}>{t('summary.missing', { count: missingCount })}</Badge>
          </div>
        )}
      </div>

      {loading && offline ? (
        <OfflineNotice />
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t('empty.noClassesAdmin')} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {rows.map(({ cls, report }) => (
            <li key={cls.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{cls.section ? `${cls.name} · ${cls.section}` : cls.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('by', { name: report?.teacherName || cls.teacherName || '—' })}
                  {report?.submittedAt
                    ? ` · ${format.dateTime(new Date(report.submittedAt), { dateStyle: 'medium' })}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(report)}
                {report && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(report)}>
                    {t('actions.open')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {open.className || classes.find((c) => c.id === open.classId)?.name} · {weekLabel(open.weekStart)}
                </DialogTitle>
                <DialogDescription>
                  {t('by', { name: open.teacherName || '—' })} · {open.status === 'submitted' ? t('status.submitted') : t('status.draft')}
                </DialogDescription>
              </DialogHeader>
              <WeeklyReportView report={open} logs={logs} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(null)}>
                  {tc('actions.close')}
                </Button>
                {open.status === 'submitted' && (
                  <Button type="button" onClick={unlock} disabled={unlocking}>
                    {unlocking ? <Loader2 className="animate-spin" /> : <Unlock />}
                    {t('actions.unlock')}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
