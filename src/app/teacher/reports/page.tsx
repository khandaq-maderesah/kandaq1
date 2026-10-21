'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Lock, Save, Send } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useMyClasses } from '@/hooks/useTeacherData'
import { useMySessionLogs, useMyWeeklyReports, useSessionLogMap } from '@/hooks/useWeeklyReports'
import { useRegistrationOptions } from '@/hooks/useRegistrationOptions'
import {
  addDays,
  emptyWeeklyReport,
  isSaturday,
  normalizeWeeklyReport,
  sessionLogId,
  weekDays,
  weekStartOf,
  weeklyReportId,
  weeklyReportProblems,
} from '@/lib/weeklyReport'
import { LevelSelect } from '@/components/students/FamilyInfoFields'
import { SessionChips, useDayLabel } from '@/components/reports/WeeklyReportView'
import { OfflineNotice } from '@/components/OfflineNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import type { Class, WeeklyReport, WeeklyReportDay } from '@/types'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function TeacherWeeklyReportPage() {
  const t = useTranslations('weeklyReports')
  const format = useFormatter()
  const dayLabel = useDayLabel()
  const { user, offline } = useAuth()
  const liveClasses = useMyClasses()
  const classes = useMemo<Class[]>(() => liveClasses ?? [], [liveClasses])
  const logs = useSessionLogMap(useMySessionLogs())
  const reports = useMyWeeklyReports()
  const options = useRegistrationOptions()

  const [classChoice, setClassChoice] = useState('')
  const classId = classChoice || (classes.length > 0 ? classes[0].id : '')
  const selectedClass = classes.find((c) => c.id === classId)
  const currentWeek = weekStartOf(todayIso())
  const [weekStart, setWeekStart] = useState(currentWeek)

  const stored = useMemo(
    () => (reports ?? []).find((r) => r.id === weeklyReportId(classId, weekStart)),
    [reports, classId, weekStart]
  )

  // The form: the stored report (or a fresh one). A live update never wipes
  // what the Ustaz is typing; switching class or week starts afresh.
  const [form, setForm] = useState<WeeklyReport | null>(null)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const scopeRef = useRef('')
  useEffect(() => {
    if (!classId || !user) return
    const scope = `${classId}|${weekStart}`
    const scopeChanged = scope !== scopeRef.current
    scopeRef.current = scope
    if (!scopeChanged && dirtyRef.current) return
    setForm(stored ? normalizeWeeklyReport(stored) : emptyWeeklyReport(classId, user.uid, weekStart))
    setDirty(false)
  }, [stored, classId, weekStart, user])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locked = form?.status === 'submitted'
  const loading = liveClasses === undefined || reports === undefined

  const setDay = (date: string, patch: Partial<WeeklyReportDay>) => {
    setForm((f) => (f ? { ...f, days: { ...f.days, [date]: { ...f.days[date], ...patch } } } : f))
    setDirty(true)
  }

  const problemLabel = (key: string) => {
    if (key === 'review') return t('problems.review')
    const [date, field] = key.split('.')
    return t(`problems.${field as 'quran' | 'kitab' | 'topic'}`, { day: dayLabel(date) })
  }

  const persist = async (submit: boolean) => {
    if (!form || !user) return
    setError('')
    if (submit) {
      const problems = weeklyReportProblems(form, logs)
      if (problems.length > 0) {
        setError(t('toast.missing', { fields: problems.map(problemLabel).join(', ') }))
        return
      }
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const next: WeeklyReport = {
        ...form,
        className: selectedClass?.name,
        teacherName: user.name,
        status: submit ? 'submitted' : 'draft',
        submittedAt: submit ? now : form.submittedAt,
        updatedAt: now,
      }
      await rtdb.saveWeeklyReport(next)
      setForm(next)
      setDirty(false)
      toast.success(submit ? t('toast.submitted') : t('toast.saved'))
    } catch {
      toast.error(t('toast.failed'))
    } finally {
      setSaving(false)
    }
  }

  const weekLabel = (ws: string) => {
    const parsed = new Date(`${ws}T00:00:00`)
    return t('weekOf', { date: format.dateTime(parsed, { day: 'numeric', month: 'short', year: 'numeric' }) })
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        {offline ? (
          <OfflineNotice />
        ) : (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        <EmptyState icon={CalendarCheck} title={t('empty.noClasses')} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="wr-class">{t('class')}</Label>
          <Select id="wr-class" value={classId} onChange={(e) => setClassChoice(e.target.value)} className="h-11">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.section ? `${c.name} · ${c.section}` : c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('week')}</Label>
          <div className="flex h-11 items-center justify-between gap-2 rounded-lg border bg-background px-1">
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
      </div>

      {form && (
        <>
          {locked && (
            <Alert className="mt-4">
              <AlertDescription className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t('status.locked', {
                  date: form.submittedAt ? format.dateTime(new Date(form.submittedAt), { dateStyle: 'medium' }) : '',
                })}
              </AlertDescription>
            </Alert>
          )}

          <fieldset disabled={locked || saving} className="mt-4 space-y-3">
            {weekDays(weekStart).map((date) => {
              const saturday = isSaturday(date)
              const day = form.days[date]
              const log = logs[sessionLogId(classId, date)]
              return (
                <section key={date} className={cn('rounded-xl border bg-card p-4 shadow-sm', saturday && 'border-primary/30')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{dayLabel(date)}</h2>
                    <SessionChips date={date} log={log} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`wr-${date}-quran`}>{t('fields.quran')}</Label>
                      <Input
                        id={`wr-${date}-quran`}
                        placeholder={t('fields.quranPlaceholder')}
                        value={day.quran}
                        onChange={(e) => setDay(date, { quran: e.target.value })}
                      />
                    </div>
                    {!saturday && (
                      <>
                        <LevelSelect
                          id={`wr-${date}-kitab`}
                          label={t('fields.kitab')}
                          value={day.kitab}
                          onChange={(v) => setDay(date, { kitab: v })}
                          options={options.kitabs}
                        />
                        <div className="space-y-2">
                          <Label htmlFor={`wr-${date}-topic`}>{t('fields.topic')}</Label>
                          <Input
                            id={`wr-${date}-topic`}
                            placeholder={t('fields.topicPlaceholder')}
                            value={day.topic}
                            onChange={(e) => setDay(date, { topic: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    {saturday && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="wr-review">{t('fields.review')}</Label>
                        <Textarea
                          id="wr-review"
                          rows={4}
                          placeholder={t('fields.reviewPlaceholder')}
                          value={form.review}
                          onChange={(e) => {
                            const review = e.target.value
                            setForm((f) => (f ? { ...f, review } : f))
                            setDirty(true)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </fieldset>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!locked && (
            <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => persist(false)} disabled={saving || !dirty}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  {t('actions.saveDraft')}
                </Button>
                <Button type="button" onClick={() => persist(true)} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
                  {t('actions.submit')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
