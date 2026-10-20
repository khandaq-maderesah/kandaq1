'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Check,
  ClipboardCheck,
  Clock,
  Loader2,
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
import {
  enqueueOfflineAttendance,
  isBrowserOnline,
  type QueuedAttendanceRecord,
} from '@/lib/offlineAttendance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import type { Class, Student, AttendanceStatus } from '@/types'

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
  const { user } = useAuth()
  const { isOnline, pendingCount, isSyncing, syncNow, refreshPending } = useOfflineAttendanceSync()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today())
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [savedMap, setSavedMap] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        setClasses(myClasses)
        try {
          localStorage.setItem(`kmms_teacher_classes_${user.uid}`, JSON.stringify(myClasses))
        } catch {
          /* ignore */
        }
        if (myClasses.length > 0) {
          setClassId(myClasses[0].id)
        }
      } catch {
        // Fallback to offline cached classes for Ustaz
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`kmms_teacher_classes_${user.uid}`) : null
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Class[]
            setClasses(parsed)
            if (parsed.length > 0) setClassId(parsed[0].id)
          } catch {
            toast.error(t('toast.loadClassesFailed'))
          }
        } else {
          toast.error(t('toast.loadClassesFailed'))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Load students + existing attendance for selected class/date
  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return
      setLoadingStudents(true)
      try {
        const [studentList, existing] = await Promise.all([
          rtdb.getStudentsByClass(classId),
          rtdb.getAttendanceByClassAndDate(classId, date),
        ])
        // Archived (deleted) students never appear in attendance taking.
        const activeStudents = studentList
          .filter((s) => s.isActive !== false)
          .sort((a, b) =>
            (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true })
          )
        setStudents(activeStudents)
        try {
          localStorage.setItem(`kmms_class_students_${classId}`, JSON.stringify(activeStudents))
        } catch {
          /* ignore */
        }

        const activeIds = new Set(activeStudents.map((s) => s.id))
        const map: Record<string, AttendanceStatus> = {}
        existing.forEach((r) => {
          if (activeIds.has(r.studentId)) map[r.studentId] = r.status
        })
        setStatusMap(map)
        setSavedMap(map)
      } catch {
        // Fallback to offline cached students for this class
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`kmms_class_students_${classId}`) : null
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Student[]
            setStudents(parsed)
          } catch {
            toast.error(t('toast.loadStudentsFailed'))
          }
        } else {
          toast.error(t('toast.loadStudentsFailed'))
        }
      } finally {
        setLoadingStudents(false)
      }
    }
    loadClassData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date])

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
  const dirty = students.some((s) => statusMap[s.id] !== savedMap[s.id])

  const handleSave = async () => {
    if (!classId) return
    if (marked === 0) {
      toast.error(t('toast.nothingToSave'))
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
      setSavedMap(statusMap)
      refreshPending()
      setSaving(false)
      toast.success(t('offline.savedLocally'))
      return
    }

    // If online, try direct cloud save with offline fallback
    try {
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
      setSavedMap(statusMap)
      refreshPending()
      toast.warning(t('offline.savedAfterConnectionLoss'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        <Skeleton className="mb-4 h-24 rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
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
              <Select id="att-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="h-11">
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
                onChange={(e) => setDate(e.target.value || today())}
                className="h-11"
              />
            </div>
          </div>

          {loadingStudents ? (
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
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('present')}>
                  <Check /> {t('markAll.present')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('absent')}>
                  <X /> {t('markAll.absent')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('excused')}>
                  <ShieldCheck /> {t('markAll.excused')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => markAll(null)}>
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
                  <Button size="lg" onClick={handleSave} disabled={saving || !dirty} className="shrink-0">
                    {saving ? <Loader2 className="animate-spin" /> : <Save />}
                    {t('saveBar.save')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
