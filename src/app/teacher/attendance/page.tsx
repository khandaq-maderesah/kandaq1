'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Check,
  ClipboardCheck,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useOfflineAttendanceSync } from '@/hooks/useOfflineAttendanceSync'
import { useAbsenceSmsLogs, useMyAttendance, useMyClasses, useStudentsOfClass } from '@/hooks/useTeacherData'
import { AbsenceSmsDialog } from '@/components/teacher/AbsenceSmsDialog'
import { SaveAttendanceConfirm } from '@/components/attendance/SaveAttendanceConfirm'
import { absenceSmsId } from '@/lib/absenceSms'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { useMySessionLogs } from '@/hooks/useWeeklyReports'
import {
  enqueueOfflineAttendance,
  getOfflineAttendanceQueue,
  isBrowserOnline,
  type QueuedAttendanceRecord,
} from '@/lib/offlineAttendance'
import { enqueueOfflineSession, getOfflineSessionQueue } from '@/lib/offlineSessions'
import {
  answersFromLog,
  EMPTY_SESSION_ANSWERS,
  isSaturday,
  sessionLogId,
  sessionsAnswered,
  type SessionAnswers,
} from '@/lib/weeklyReport'
import type { SessionLog } from '@/types'
import { OfflineNotice } from '@/components/OfflineNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import type { Class, Student, AttendanceStatus } from '@/types'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const today = () => new Date().toISOString().slice(0, 10)

const STATUSES: {
  value: AttendanceStatus
  icon: LucideIcon
  active: string
  idle: string
  chip: string
}[] = [
  {
    value: 'present',
    icon: Check,
    active: 'border-success bg-success text-success-foreground',
    idle: 'hover:border-success/50 hover:bg-success/10 hover:text-success',
    chip: 'bg-success/10 text-success',
  },
  {
    value: 'absent',
    icon: X,
    active: 'border-destructive bg-destructive text-destructive-foreground',
    idle: 'hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive',
    chip: 'bg-destructive/10 text-destructive',
  },
  {
    value: 'late',
    icon: Clock,
    active: 'border-warning bg-warning text-warning-foreground',
    idle: 'hover:border-warning/50 hover:bg-warning/10 hover:text-warning',
    chip: 'bg-warning/10 text-warning',
  },
  {
    value: 'excused',
    icon: ShieldCheck,
    active: 'border-info bg-info text-info-foreground',
    idle: 'hover:border-info/50 hover:bg-info/10 hover:text-info',
    chip: 'bg-info/10 text-info',
  },
]

export default function TeacherAttendancePage() {
  const t = useTranslations('teacherAttendance')
  const tSms = useTranslations('absenceSms')
  const tConfirm = useTranslations('confirm')
  const { user, offline } = useAuth()
  const { isOnline, pendingCount, isSyncing, syncNow, refreshPending } = useOfflineAttendanceSync()
  // Live, offline-first data shared with the other teacher screens: on screen
  // from the first frame (last known snapshot) and refreshed by itself.
  const liveClasses = useMyClasses()
  const classes = useMemo<Class[]>(() => liveClasses ?? [], [liveClasses])
  const [classChoice, setClassChoice] = useState('')
  const classId = classChoice || (classes.length > 0 ? classes[0].id : '')
  const liveStudents = useStudentsOfClass(classId || null)
  const liveAttendance = useMyAttendance()
  const [date, setDate] = useState(today())
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [savedMap, setSavedMap] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const format = useFormatter()
  const smsLogs = useAbsenceSmsLogs(date)
  const loading = liveClasses === undefined
  const loadingStudents = !!classId && liveStudents === undefined

  // Archived (deleted) students never appear in attendance taking.
  const students = useMemo<Student[]>(
    () =>
      (liveStudents ?? [])
        .filter((s) => s.isActive !== false)
        .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true })),
    [liveStudents]
  )

  // What is already marked for this class and day: the saved records, plus
  // the marks still queued on this device (they win: they are newer), so the
  // sheet always shows the truth, even reopened offline before a sync.
  const knownMap = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {}
    if (!classId) return map
    const activeIds = new Set(students.map((s) => s.id))
    ;(liveAttendance ?? []).forEach((r) => {
      if (r.classId === classId && r.date === date && activeIds.has(r.studentId)) map[r.studentId] = r.status
    })
    getOfflineAttendanceQueue().forEach((q) => {
      if (q.classId === classId && q.date === date && activeIds.has(q.studentId)) map[q.studentId] = q.status
    })
    return map
    // pendingCount changes whenever the device queue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, students, liveAttendance, pendingCount])

  // The daily session log (was the Qur'an session held? the Kitab session?)
  // is required with every attendance: the weekly report is built on it.
  const liveSessions = useMySessionLogs()
  const knownAnswers = useMemo<SessionAnswers>(() => {
    if (!classId) return EMPTY_SESSION_ANSWERS
    const id = sessionLogId(classId, date)
    const log = getOfflineSessionQueue().find((l) => l.id === id) ?? (liveSessions ?? []).find((l) => l.id === id)
    return answersFromLog(log)
    // pendingCount changes whenever the device queue changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, liveSessions, pendingCount])
  const [answers, setAnswers] = useState<SessionAnswers>(EMPTY_SESSION_ANSWERS)

  const dirty =
    students.some((s) => statusMap[s.id] !== savedMap[s.id]) ||
    answers.quran !== knownAnswers.quran ||
    answers.kitab !== knownAnswers.kitab
  useUnsavedChangesWarning(dirty)
  // Changing class or day throws away marks that are not saved: ask first.
  const [leave, setLeave] = useState<{ run: () => void } | null>(null)
  const guard = (run: () => void) => (dirty ? setLeave({ run }) : run())
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const scopeRef = useRef('')

  // Load the known marks into the sheet. A live update never wipes marks the
  // Ustaz is still entering; switching class or day always starts afresh.
  useEffect(() => {
    const scope = `${classId}|${date}`
    const scopeChanged = scope !== scopeRef.current
    scopeRef.current = scope
    if (!scopeChanged && dirtyRef.current) return
    setStatusMap(knownMap)
    setSavedMap(knownMap)
    setAnswers(knownAnswers)
  }, [knownMap, knownAnswers, classId, date])

  const secondSession = isSaturday(date) ? 'review' : 'kitab'

  const sessionLog = (): SessionLog => ({
    id: sessionLogId(classId, date),
    classId,
    date,
    teacherId: user?.uid || '',
    quran: answers.quran === true,
    kitab: answers.kitab === true,
    markedAt: new Date().toISOString(),
  })

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: AttendanceStatus | null) => {
    if (status === null) {
      setStatusMap({})
      return
    }
    const map: Record<string, AttendanceStatus> = {}
    students.forEach((s) => {
      map[s.id] = status
    })
    setStatusMap(map)
  }

  // "All present" etc. and "Clear" replace marks the Ustaz may have entered one by one: ask first.
  const [bulk, setBulk] = useState<AttendanceStatus | 'clear' | null>(null)
  const requestBulk = (status: AttendanceStatus | null) => {
    if (status === null) {
      if (students.some((s) => statusMap[s.id])) setBulk('clear')
      else markAll(null)
      return
    }
    if (students.some((s) => statusMap[s.id] && statusMap[s.id] !== status)) setBulk(status)
    else markAll(status)
  }

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus | 'unmarked', number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      unmarked: 0,
    }
    students.forEach((s) => {
      const st = statusMap[s.id]
      c[st ?? 'unmarked']++
    })
    return c
  }, [students, statusMap])

  const marked = students.length - counts.unmarked
  const bulkChanges = bulk && bulk !== 'clear' ? students.filter((s) => statusMap[s.id] && statusMap[s.id] !== bulk).length : 0

  // Texting the parents of the absent students: asked right after saving, and
  // still reachable from the save bar. Done when the SMS app was opened for all
  // of them (a later absentee is owed a new text).
  const absentStudents = useMemo(() => students.filter((s) => statusMap[s.id] === 'absent'), [students, statusMap])
  const smsLog = (smsLogs ?? []).find((l) => l.id === absenceSmsId(date, classId))
  const smsDone = !!smsLog && smsLog.absentCount >= absentStudents.length
  const offerSms = () => {
    if (absentStudents.length > 0 && !smsDone) setSmsOpen(true)
  }

  // The checks run before the "are you sure" so the Ustaz hears about a gap first, not after confirming.
  const requestSave = () => {
    if (!classId) return
    if (marked === 0) {
      toast.error(t('toast.nothingToSave'))
      return
    }
    if (counts.unmarked > 0) {
      toast.error(t('toast.incomplete', { count: counts.unmarked }))
      return
    }
    if (!sessionsAnswered(answers)) {
      toast.error(t('sessions.required'))
      return
    }
    setConfirmSave(true)
  }

  const handleSave = async () => {
    if (!classId) return
    if (marked === 0) {
      toast.error(t('toast.nothingToSave'))
      return
    }
    // Every student must be marked: a half-filled sheet is never saved.
    if (counts.unmarked > 0) {
      toast.error(t('toast.incomplete', { count: counts.unmarked }))
      return
    }
    if (!sessionsAnswered(answers)) {
      toast.error(t('sessions.required'))
      return
    }
    setSaving(true)
    const className = classes.find((c) => c.id === classId)?.name || ''
    const recordsToEnqueue: QueuedAttendanceRecord[] = []

    // If completely offline, save directly to device offline queue
    if (!isBrowserOnline()) {
      students.forEach((s) => {
        const status = statusMap[s.id]
        if (!status) return
        recordsToEnqueue.push({
          id: `${classId}_${date}_${s.id}`,
          studentId: s.id,
          classId,
          date,
          status,
          studentName: s.name,
          className,
          teacherId: user?.uid,
          markedBy: user?.uid,
          timestamp: Date.now(),
          retryCount: 0,
        })
      })
      enqueueOfflineAttendance(recordsToEnqueue)
      enqueueOfflineSession(sessionLog())
      setSavedMap(statusMap)
      refreshPending()
      setSaving(false)
      toast.success(t('offline.savedLocally'))
      offerSms()
      return
    }

    // If online, try direct cloud save with offline fallback
    try {
      await rtdb.setSessionLog(sessionLog())
      await Promise.all(
        students.map(async (s) => {
          const status = statusMap[s.id]
          if (!status) return
          const attendanceId = `${classId}_${date}_${s.id}`
          const record = {
            id: attendanceId,
            studentId: s.id,
            classId,
            date,
            status,
            studentName: s.name,
            className,
            teacherId: user?.uid,
            markedBy: user?.uid,
            markedAt: new Date().toISOString(),
          }
          const existing = await rtdb.getAttendance(attendanceId)
          if (existing) {
            await rtdb.updateAttendance(attendanceId, record)
          } else {
            await rtdb.createAttendance(attendanceId, record)
          }
        })
      )
      setSavedMap(statusMap)
      toast.success(t('toast.saved'))
      offerSms()
    } catch {
      // Network failed during save: fallback to offline device queue
      students.forEach((s) => {
        const status = statusMap[s.id]
        if (!status) return
        recordsToEnqueue.push({
          id: `${classId}_${date}_${s.id}`,
          studentId: s.id,
          classId,
          date,
          status,
          studentName: s.name,
          className,
          teacherId: user?.uid,
          markedBy: user?.uid,
          timestamp: Date.now(),
          retryCount: 0,
        })
      })
      enqueueOfflineAttendance(recordsToEnqueue)
      enqueueOfflineSession(sessionLog())
      setSavedMap(statusMap)
      refreshPending()
      toast.warning(t('offline.savedAfterConnectionLoss'))
      offerSms()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        {offline ? (
          <OfflineNotice />
        ) : (
          <>
            <Skeleton className="mb-4 h-24 rounded-xl" />
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <ConfirmDialog
        open={leave !== null}
        onOpenChange={(o) => !o && setLeave(null)}
        destructive
        title={tConfirm('discardAttendance.title')}
        description={tConfirm('discardAttendance.description')}
        confirmLabel={tConfirm('discardAttendance.confirm')}
        cancelLabel={tConfirm('discardAttendance.cancel')}
        onConfirm={() => leave?.run()}
      />
      <ConfirmDialog
        open={bulk !== null && bulk !== 'clear'}
        onOpenChange={(o) => !o && setBulk(null)}
        title={tConfirm('bulkMarks.title')}
        description={tConfirm('bulkMarks.description', { count: bulkChanges, status: bulk && bulk !== 'clear' ? t(`status.${bulk}`) : '' })}
        confirmLabel={tConfirm('bulkMarks.confirm')}
        cancelLabel={tConfirm('bulkMarks.cancel')}
        onConfirm={() => markAll(bulk && bulk !== 'clear' ? bulk : null)}
      />
      <ConfirmDialog
        open={bulk === 'clear'}
        onOpenChange={(o) => !o && setBulk(null)}
        destructive
        title={tConfirm('clearMarks.title')}
        description={tConfirm('clearMarks.description', { count: marked })}
        confirmLabel={tConfirm('clearMarks.confirm')}
        cancelLabel={tConfirm('clearMarks.cancel')}
        onConfirm={() => markAll(null)}
      />

      <PageHeader title={t('title')} description={t('description')} />

      {/* Offline & Sync Status Banner */}
      {(!isOnline || pendingCount > 0) && (
        <div
          className={cn(
            'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 shadow-sm transition-all sm:p-4',
            !isOnline
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200'
          )}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {!isOnline ? (
              <span className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <WifiOff className="h-3.5 w-3.5" /> {t('offline.mode')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                <Wifi className="h-3.5 w-3.5" /> {t('offline.reconnected')}
              </span>
            )}
            <span>
              {!isOnline
                ? t('offline.offlineNotice')
                : t('offline.reconnectedNotice')}
              {pendingCount > 0 && ` (${t('offline.queuedRecords', { count: pendingCount })})`}
            </span>
          </div>

          {pendingCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant={isOnline ? 'default' : 'outline'}
              disabled={isSyncing || !isOnline}
              onClick={() => syncNow()}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('offline.syncing')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> {t('offline.syncNow', { count: pendingCount })}
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('empty.noClasses')} description={t('empty.noClassesHint')} />
      ) : (
        <>
          <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="att-class">{t('filters.class')}</Label>
              <Select id="att-class" value={classId} onChange={(e) => {
                  const next = e.target.value
                  guard(() => setClassChoice(next))
                }}
                className="h-11">
                <option value="" disabled>
                  {t('filters.classPlaceholder')}
                </option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.section ? `${c.name} · ${c.section}` : c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-date">{t('filters.date')}</Label>
              <Input
                id="att-date"
                type="date"
                value={date}
                max={today()}
                onChange={(e) => {
                  const next = e.target.value || today()
                  guard(() => setDate(next))
                }}
                className="h-11"
              />
            </div>
          </div>

          {/* Daily session log: required with every attendance */}
          <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="sessions-title">
            <h2 id="sessions-title" className="text-sm font-semibold text-foreground">
              {t('sessions.title')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('sessions.hint')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(['quran', 'kitab'] as const).map((key) => {
                const label = key === 'kitab' ? t(`sessions.${secondSession}`) : t('sessions.quran')
                const value = answers[key]
                return (
                  <div key={key} role="radiogroup" aria-label={label} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <div className="grid grid-cols-2 gap-1">
                      {([true, false] as const).map((held) => (
                        <button
                          key={String(held)}
                          type="button"
                          role="radio"
                          aria-checked={value === held}
                          onClick={() => setAnswers((a) => ({ ...a, [key]: held }))}
                          className={cn(
                            'min-h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            value === held
                              ? held
                                ? 'border-success bg-success text-success-foreground'
                                : 'border-destructive bg-destructive text-destructive-foreground'
                              : 'bg-card text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {held ? t('sessions.held') : t('sessions.notHeld')}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {loadingStudents && offline ? (
            <OfflineNotice className="mt-6" />
          ) : loadingStudents ? (
            <div className="mt-6 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={Users}
              title={t('empty.noStudents')}
              description={t('empty.noStudentsHint')}
            />
          ) : (
            <>
              {/* Live counts */}
              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {STATUSES.map(({ value, icon: Icon, chip }) => (
                  <div key={value} className={cn('flex items-center gap-2 rounded-lg px-3 py-2', chip)}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold leading-none tabular-nums">{counts[value]}</p>
                      <p className="mt-0.5 truncate text-xs">{t(`status.${value}`)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-none tabular-nums">{counts.unmarked}</p>
                    <p className="mt-0.5 truncate text-xs">{t('status.unmarked')}</p>
                  </div>
                </div>
              </div>

              {/* Bulk actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('markAll.label')}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => requestBulk('present')}>
                  <Check /> {t('markAll.present')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => requestBulk('absent')}>
                  <X /> {t('markAll.absent')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => requestBulk('excused')}>
                  <ShieldCheck /> {t('markAll.excused')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => requestBulk(null)}>
                  <RotateCcw /> {t('markAll.clear')}
                </Button>
              </div>

              {/* Students */}
              <h2 className="sr-only">{t('list.title')}</h2>
              <ul className="mt-4 space-y-2">
                {students.map((s) => {
                  const current = statusMap[s.id]
                  return (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums text-muted-foreground">
                          {s.rollNumber || '–'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {current ? t(`status.${current}`) : t('status.unmarked')}
                          </p>
                        </div>
                      </div>
                      <div
                        role="radiogroup"
                        aria-label={t('list.statusGroup', { name: s.name })}
                        className="grid grid-cols-4 gap-2 sm:w-[26rem] sm:shrink-0"
                      >
                        {STATUSES.map(({ value, icon: Icon, active, idle }) => {
                          const selected = current === value
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setStatus(s.id, value)}
                              className={cn(
                                'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                selected ? active : cn('bg-card text-muted-foreground', idle)
                              )}
                            >
                              <Icon className="h-5 w-5" aria-hidden="true" />
                              <span className="max-w-full truncate">{t(`status.${value}`)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Sticky save bar */}
              <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {t('saveBar.progress', { marked, total: students.length })}
                    </p>
                    <p className={cn('text-xs', dirty ? 'text-warning' : 'text-muted-foreground')}>
                      {dirty ? t('saveBar.unsaved') : t('saveBar.allSaved')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!dirty && absentStudents.length > 0 && (
                      <Button type="button" size="lg" variant={smsDone ? 'ghost' : 'outline'} onClick={() => setSmsOpen(true)}>
                        {smsDone ? <Check className="text-success" /> : <MessageSquare />}
                        {smsDone ? tSms('saveBar.sent') : tSms('saveBar.send', { count: absentStudents.length })}
                      </Button>
                    )}
                    <Button size="lg" onClick={requestSave} disabled={saving || !dirty || counts.unmarked > 0}>
                      {saving ? <Loader2 className="animate-spin" /> : <Save />}
                      {t('saveBar.save')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <SaveAttendanceConfirm
        open={confirmSave}
        onOpenChange={setConfirmSave}
        // Closes first, then saves: the save bar shows the progress and the SMS dialog opens afterwards.
        onConfirm={() => {
          setConfirmSave(false)
          void handleSave()
        }}
        className={classes.find((c) => c.id === classId)?.name ?? ''}
        dateLabel={format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' })}
        isToday={date === today()}
        counts={counts}
        unmarked={counts.unmarked}
      />
      <AbsenceSmsDialog
        open={smsOpen}
        onOpenChange={setSmsOpen}
        classId={classId}
        className={classes.find((c) => c.id === classId)?.name ?? ''}
        date={date}
        absent={absentStudents}
      />
    </div>
  )
}
