'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { ATTENDANCE_RECENT_DAYS, daysAgoISO } from '@/lib/utils'
import { ClipboardList, CheckCircle2, Loader2, X, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Class, Attendance, User, MissingAttendanceAlert } from '@/types'
import { runMissingAttendanceCheck, CHECK_INTERVAL_MS } from '@/lib/attendanceReminder'

export function AttendanceReminderBell(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: {
    /** @deprecated Kept for backward compatibility; the bell always matches the light top bar. */
    dark?: boolean
  } = {}
) {
  const t = useTranslations('notifications')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [savingId, setSavingId] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Shared realtime store: the nav bells + dashboards all read the SAME channel,
  // so `students`/`classes`/`users`/recent `attendance` are each downloaded once
  // instead of once-per-component. Attendance is date-scoped to the last 7 days
  // (only recent records are needed to detect "no attendance taken today").
  const sinceKey = useMemo(() => daysAgoISO(ATTENDANCE_RECENT_DAYS), [])
  const classesData = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const usersData = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))
  const attendanceData = useLiveData<Attendance[]>(
    `attendance:since:${sinceKey}`,
    (emit) => rtdb.subscribeToAttendanceSince(sinceKey, emit)
  )
  const alertsData = useLiveData<MissingAttendanceAlert[]>(
    'missingAttendanceAlerts',
    (emit) => rtdb.subscribeToMissingAttendanceAlerts(emit)
  )

  // Refs hold the latest store snapshots so the interval checker always runs
  // against up-to-date data without re-registering the timer.
  const classesRef = useRef<Class[]>([])
  const attendanceRef = useRef<Attendance[]>([])
  const usersRef = useRef<User[]>([])
  const alertsRef = useRef<MissingAttendanceAlert[]>([])
  const runningRef = useRef(false)

  useEffect(() => {
    classesRef.current = classesData.data ?? []
  }, [classesData.data])
  useEffect(() => {
    attendanceRef.current = attendanceData.data ?? []
  }, [attendanceData.data])
  useEffect(() => {
    usersRef.current = usersData.data ?? []
  }, [usersData.data])
  useEffect(() => {
    alertsRef.current = alertsData.data ?? []
  }, [alertsData.data])

  const runCheck = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      await runMissingAttendanceCheck(
        classesRef.current,
        attendanceRef.current,
        usersRef.current,
        new Date(),
        alertsRef.current
      )
    } catch (e) {
      console.error('Missing attendance reminder check failed', e)
    } finally {
      runningRef.current = false
    }
  }, [])

  // Run once on mount, then on a fixed interval while the app is open.
  useEffect(() => {
    runCheck()
    const id = setInterval(runCheck, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runCheck])

  // Re-check as soon as the shared store has delivered real data, so reminders
  // appear right after login instead of waiting for the first interval tick.
  const storeReady =
    classesData.data !== undefined &&
    usersData.data !== undefined &&
    attendanceData.data !== undefined &&
    alertsData.data !== undefined
  useEffect(() => {
    if (storeReady) runCheck()
  }, [storeReady, runCheck])

  // Close the panel when clicking outside or pressing Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const isAdmin = user?.role === 'admin'

  // Stabilize the empty fallback: `data ?? []` re-creates a new array reference
  // on every render while data hasn't arrived, which would re-run the useMemo
  // below every render. Wrapping it keeps the reference stable.
  const alerts = useMemo(() => alertsData.data ?? [], [alertsData.data])
  const loading = alertsData.data === undefined

  // Admin sees every reminder once it has been flagged for admins (18:30).
  // A teacher only sees reminders for their own classes once flagged (18:00).
  const visible = useMemo(() => {
    if (!user) return []
    return alerts
      .filter((a) => !a.resolved)
      .filter((a) =>
        isAdmin ? a.adminNotified : a.teacherId === user.uid && a.teacherNotified
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [alerts, user, isAdmin])

  const count = visible.length

  const handleResolve = async (id: string) => {
    setSavingId(id)
    try {
      await rtdb.updateMissingAttendanceAlert(id, {
        resolved: true,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      toast.success(t('reminders.resolved'))
    } catch (e) {
      console.error('Failed to resolve reminder', e)
      toast.error(t('reminders.resolveFailed'))
    } finally {
      setSavingId('')
    }
  }

  // Reminder dates are calendar days (YYYY-MM-DD); noon avoids time-zone shifts.
  const formatDay = (day: string) => {
    const d = new Date(`${day}T12:00:00`)
    return Number.isNaN(d.getTime()) ? day : format.dateTime(d, { dateStyle: 'medium' })
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="relative text-muted-foreground"
        aria-label={count > 0 ? `${t('reminders.label')} (${count})` : t('reminders.label')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('reminders.label')}
      >
        <ClipboardList />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -end-0.5 -top-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-card"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={t('reminders.title')}
          className="fixed end-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t('reminders.title')}</p>
              <p className="text-xs text-muted-foreground">{t('reminders.description')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              className="-me-1 shrink-0 text-muted-foreground"
              aria-label={tc('actions.close')}
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-success" />
                {isAdmin ? t('reminders.emptyAdmin') : t('reminders.emptyTeacher')}
              </div>
            ) : (
              <ul className="divide-y">
                {visible.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <GraduationCap className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {isAdmin ? t('reminders.adminLine', { teacher: a.teacherName }) : t('reminders.teacherLine')}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.section ? t('absence.classWithSection', { className: a.className, section: a.section }) : a.className}
                        {' · '}
                        <time dateTime={a.date}>{formatDay(a.date)}</time>
                      </p>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleResolve(a.id)}
                          disabled={savingId === a.id}
                        >
                          {savingId === a.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="text-success" />}
                          {t('reminders.markResolved')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
