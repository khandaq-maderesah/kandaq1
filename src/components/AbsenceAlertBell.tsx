'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { getConsecutiveAbsentCount } from '@/lib/absentAlert'
import { useLiveData } from '@/lib/dataStore'
import { daysAgoISO, ATTENDANCE_RECENT_DAYS } from '@/lib/utils'
import { Bell, CheckCircle2, Loader2, Phone, X, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Attendance, Class, Student, AbsentAlert } from '@/types'

const ABSENT_STREAK = 5

export function AbsenceAlertBell({
  teacherOnly = false,
}: {
  teacherOnly?: boolean
  /** @deprecated Kept for backward compatibility; the bell always matches the light top bar. */
  dark?: boolean
}) {
  const t = useTranslations('notifications.absence')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [classList, setClassList] = useState<Class[]>([])
  const [studentsAll, setStudentsAll] = useState<Student[]>([])
  const [attendanceAll, setAttendanceAll] = useState<Attendance[]>([])
  const [alertRecords, setAlertRecords] = useState<AbsentAlert[]>([])
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Shared realtime store: the admin/teacher navs all read the SAME channel, so
  // `students`, `classes`, recent `attendance` and `absentAlerts` are downloaded
  // once per screen instead of once per component. Attendance is date-scoped to
  // the last 14 days — the 5-day streak check never needs older records.
  const sinceKey = useMemo(() => daysAgoISO(ATTENDANCE_RECENT_DAYS), [])
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeStudents = useLiveData<Student[]>(
    teacherOnly ? null : 'students',
    (emit) => rtdb.subscribeToStudents(emit)
  )
  const storeAttendanceRecent = useLiveData<Attendance[]>(
    teacherOnly ? null : `attendance:since:${sinceKey}`,
    (emit) => rtdb.subscribeToAttendanceSince(sinceKey, emit)
  )
  const teacherAttendance = useLiveData<Attendance[]>(
    teacherOnly && user?.uid ? `attendance:teacher:${user.uid}` : null,
    (emit) => rtdb.subscribeToAttendanceByTeacher(user?.uid || '', emit)
  )
  const storeAlerts = useLiveData<AbsentAlert[]>(
    'absentAlerts',
    (emit) => rtdb.subscribeToAbsentAlerts(emit)
  )

  // Teacher mode keeps ONLY their classes' students (server-scoped per-class
  // query), instead of downloading the whole school (which includes every
  // student photo). Swaps automatically when the class list changes.
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([])
  useEffect(() => {
    if (!teacherOnly || !storeClasses.data) return
    const classSubs: Record<string, () => void> = {}
    const byClass: Record<string, Student[]> = {}
    const myClassIds = storeClasses.data
      .filter((c) => c.teacherId === user?.uid)
      .map((c) => c.id)
    myClassIds.forEach((cid) => {
      classSubs[cid] = rtdb.subscribeToStudentsByClass(cid, (students) => {
        byClass[cid] = students
        setTeacherStudents(Object.values(byClass).flat())
      })
    })
    if (myClassIds.length === 0) {
      setTeacherStudents([])
    }
    return () => {
      Object.values(classSubs).forEach((u) => u())
    }
  }, [teacherOnly, user?.uid, storeClasses.data])

  // Mirror the store snapshots into local state so the rest of this component
  // (alert computation, dropdown rendering) stays unchanged.
  useEffect(() => {
    setClassList(storeClasses.data ?? [])
  }, [storeClasses.data])
  useEffect(() => {
    setStudentsAll(teacherOnly ? teacherStudents : (storeStudents.data ?? []))
  }, [teacherOnly, teacherStudents, storeStudents.data])
  useEffect(() => {
    setAttendanceAll(
      teacherOnly ? (teacherAttendance.data ?? []) : (storeAttendanceRecent.data ?? [])
    )
  }, [teacherOnly, teacherAttendance.data, storeAttendanceRecent.data])
  useEffect(() => {
    setAlertRecords(storeAlerts.data ?? [])
    if (storeAlerts.data) setLoading(false)
  }, [storeAlerts.data])

  // Compute active alerts reactively from live data
  const alerts = useMemo(() => {
    const classInfo: Record<string, { name: string; section?: string }> = {}
    classList.forEach((c) => {
      classInfo[c.id] = { name: c.name, section: c.section }
    })

    const byStudent: Record<string, Attendance[]> = {}
    attendanceAll.forEach((r) => {
      if (!byStudent[r.studentId]) byStudent[r.studentId] = []
      byStudent[r.studentId].push(r)
    })

    const alertMap: Record<string, AbsentAlert> = {}
    alertRecords.forEach((a) => {
      alertMap[a.studentId] = a
    })

    return studentsAll
      .filter((s) => s.isActive)
      .map((s) => {
        const streak = getConsecutiveAbsentCount(byStudent[s.id] || [])
        const rec = alertMap[s.id]
        // An acknowledgment cancels the alert until a new streak forms
        const suppressed =
          rec?.resolved === true && streak <= (rec.streakAtResolve ?? rec.streak ?? 0)
        const isActive = streak >= ABSENT_STREAK && !suppressed
        return {
          studentId: s.id,
          name: s.name,
          className: s.className || classInfo[s.classId]?.name || '—',
          section: s.section || classInfo[s.classId]?.section || '',
          classId: s.classId,
          streak,
          parentPhone: s.parentPhone || '',
          isActive,
        }
      })
      .filter((x) => x.isActive)
      .sort((a, b) => b.streak - a.streak)
  }, [studentsAll, attendanceAll, alertRecords, classList])

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

  const myClassIds = useMemo(() => {
    if (!user) return new Set<string>()
    return new Set(classList.filter((c) => c.teacherId === user.uid).map((c) => c.id))
  }, [classList, user])

  const displayAlerts = useMemo(() => {
    if (teacherOnly || scope === 'mine') {
      return alerts.filter((a) => myClassIds.has(a.classId))
    }
    return alerts
  }, [alerts, scope, teacherOnly, myClassIds])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCancel = async () => {
    if (selected.size === 0) return
    setSaving(true)
    const now = new Date().toISOString()
    const resolvedBy = user?.uid || 'admin'
    try {
      const ids = [...selected]
      for (const id of ids) {
        const row = alerts.find((a) => a.studentId === id)
        await rtdb.acknowledgeAbsentAlert(id, {
          studentId: id,
          name: row?.name,
          className: row?.className,
          section: row?.section,
          resolved: true,
          streakAtResolve: row?.streak || 0,
          resolvedAt: now,
          resolvedBy,
          updatedAt: now,
        })
      }
      // The acknowledgment updates realtime data, so the alert disappears automatically
      setSelected(new Set())
      toast.success(t('dismissed', { count: ids.length }))
    } catch (err) {
      console.error('Failed to dismiss absence alert', err)
      toast.error(t('dismissFailed'))
    } finally {
      setSaving(false)
    }
  }

  const count = displayAlerts.length

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="relative text-muted-foreground"
        aria-label={count > 0 ? `${t('label')} (${count})` : t('label')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t('label')}
      >
        <Bell />
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
          aria-label={t('title')}
          className="fixed end-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-start gap-3 border-b px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {t('title')}
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium tabular-nums text-destructive">
                  {count}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{t('description', { streak: ABSENT_STREAK })}</p>
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

          {!teacherOnly && (
            <div role="radiogroup" aria-label={t('scopeLabel')} className="grid grid-cols-2 gap-1 border-b bg-muted/50 p-2">
              {(['all', 'mine'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  onClick={() => setScope(value)}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    scope === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  {value === 'all' ? t('scopeAll') : t('scopeMine')}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ) : count === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-success" />
                {t('empty', { streak: ABSENT_STREAK })}
              </div>
            ) : (
              <ul className="divide-y">
                {displayAlerts.map((a) => {
                  const checkboxId = `absence-${a.studentId}`
                  return (
                    <li key={a.studentId} className="flex items-center gap-3 px-4 py-3">
                      {!teacherOnly && (
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={selected.has(a.studentId)}
                          onChange={() => toggle(a.studentId)}
                          aria-label={t('select', { name: a.name })}
                          className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        {teacherOnly ? (
                          <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                        ) : (
                          <label htmlFor={checkboxId} className="block cursor-pointer truncate text-sm font-medium text-foreground">
                            {a.name}
                          </label>
                        )}
                        <p className="truncate text-xs text-muted-foreground">
                          {a.section ? t('classWithSection', { className: a.className, section: a.section }) : a.className}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-destructive">{t('streak', { count: a.streak })}</p>
                      </div>
                      {a.parentPhone ? (
                        <a
                          href={`tel:${a.parentPhone}`}
                          aria-label={t('callParent', { name: a.name })}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          <Phone className="h-3.5 w-3.5 text-success" />
                          {t('call')}
                        </a>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {!teacherOnly && (
            <div className="border-t bg-muted/30 p-3">
              <Button type="button" onClick={handleCancel} disabled={saving || selected.size === 0} className="w-full">
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {t('dismiss', { count: selected.size })}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
