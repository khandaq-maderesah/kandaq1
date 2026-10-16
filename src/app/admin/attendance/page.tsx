'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  ClipboardList,
  Calendar,
  Check,
  X,
  Clock,
  Save,
  RotateCcw,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { cn, daysAgoISO } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard, TableContainer } from '@/components/ui/page'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import type { Attendance, Class, Student, AttendanceStatus } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_META: Record<
  AttendanceStatus,
  { icon: LucideIcon; badge: 'success' | 'destructive' | 'warning' | 'info'; active: string; idle: string }
> = {
  present: {
    icon: Check,
    badge: 'success',
    active: 'border-success bg-success text-success-foreground',
    idle: 'border-input bg-card text-success hover:bg-success/10',
  },
  absent: {
    icon: X,
    badge: 'destructive',
    active: 'border-destructive bg-destructive text-destructive-foreground',
    idle: 'border-input bg-card text-destructive hover:bg-destructive/10',
  },
  late: {
    icon: Clock,
    badge: 'warning',
    active: 'border-warning bg-warning text-warning-foreground',
    idle: 'border-input bg-card text-warning hover:bg-warning/10',
  },
  excused: {
    icon: ShieldCheck,
    badge: 'info',
    active: 'border-info bg-info text-info-foreground',
    idle: 'border-input bg-card text-info hover:bg-info/10',
  },
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export default function AttendancePage() {
  const t = useTranslations('adminAttendance')
  const format = useFormatter()
  const eth = useEthiopianDate()
  const { user } = useAuth()

  const [tab, setTab] = useState<'mark' | 'records'>('mark')

  const [classes, setClasses] = useState<Class[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClassId, setFilterClassId] = useState('')
  const [filterDate, setFilterDate] = useState(today())
  const [loadError, setLoadError] = useState(false)

  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today())
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [attendanceList, classList] = await Promise.all([
        rtdb.getAllAttendanceSince(daysAgoISO(90)),
        rtdb.getAllClasses(),
      ])
      setRecords(attendanceList)
      setClasses(classList)
      setLoadError(false)
      setClassId((current) => (classList.length > 0 && !current ? classList[0].id : current))
    } catch {
      setLoadError(true)
      toast.error(t('toast.loadFailed'))
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  // Load students + existing attendance for the selected class/date (admin can mark any class).
  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return
      setLoadingStudents(true)
      try {
        const studentList = await rtdb.getStudentsByClass(classId)
        // Archived students (isActive === false) are never offered for attendance.
        setStudents(studentList.filter((s) => s.isActive !== false))
        const existing = await rtdb.getAttendanceByClassAndDate(classId, date)
        const map: Record<string, AttendanceStatus> = {}
        existing.forEach((r) => {
          map[r.studentId] = r.status
        })
        setStatusMap(map)
      } catch {
        toast.error(t('toast.studentsFailed'))
      } finally {
        setLoadingStudents(false)
      }
    }
    loadClassData()
  }, [classId, date, t])

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

  const handleSave = async () => {
    if (!classId || !user) return
    setSaving(true)
    try {
      const classInfo = classes.find((c) => c.id === classId)
      // Admin may mark any class. teacherId = assigned teacher so the record shows in
      // that teacher's history; markedBy records who actually took it (the admin).
      const teacherId = classInfo?.teacherId || user.uid
      for (const s of students) {
        const status = statusMap[s.id]
        if (!status) continue
        const attendanceId = classId + '_' + date + '_' + s.id
        const existing = await rtdb.getAttendance(attendanceId)
        const record = {
          studentId: s.id,
          classId,
          date,
          status,
          studentName: s.name,
          className: classInfo?.name || '',
          teacherId,
          markedBy: user.uid,
          markedAt: new Date().toISOString(),
        }
        if (existing) {
          await rtdb.updateAttendance(attendanceId, { ...record, id: attendanceId })
        } else {
          await rtdb.createAttendance(attendanceId, { ...record, id: attendanceId })
        }
      }
      toast.success(t('toast.saved'))
      await loadData(false) // quietly refresh records overview
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const gDate = (d: string) => {
    const parsed = new Date(d)
    if (!d || Number.isNaN(parsed.getTime())) return d || '—'
    return format.dateTime(parsed, { dateStyle: 'medium', timeZone: 'UTC' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-72 max-w-full rounded-lg" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const filtered = records.filter(
    (r) => (!filterClassId || r.classId === filterClassId) && (!filterDate || r.date === filterDate)
  )
  const counts = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: filtered.filter((r) => r.status === s).length }),
    {} as Record<AttendanceStatus, number>
  )
  const markedCount = students.filter((s) => statusMap[s.id]).length
  const ethDate = eth.format(date)

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Tabs */}
      <div role="tablist" aria-label={t('tabs.label')} className="inline-flex rounded-lg border bg-muted p-1">
        {(
          [
            ['mark', ClipboardList, t('tabs.mark')],
            ['records', Calendar, t('tabs.records')],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{t('toast.loadFailed')}</AlertDescription>
        </Alert>
      )}

      {tab === 'mark' ? (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mark-class">{t('mark.class')}</Label>
                <Select id="mark-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.name, c.section, c.teacherName].filter(Boolean).join(' • ')}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mark-date">{t('mark.date')}</Label>
                <Input id="mark-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {ethDate && <p className="text-xs text-muted-foreground">{t('mark.ethiopianDate', { date: ethDate })}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <Button type="button" size="sm" variant="success" onClick={() => markAll('present')}>
                <Check /> {t('mark.allPresent')}
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => markAll('absent')}>
                <X /> {t('mark.allAbsent')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => markAll('excused')}>
                <ShieldCheck /> {t('mark.allExcused')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => markAll(null)}>
                <RotateCcw /> {t('mark.clear')}
              </Button>
              {students.length > 0 && (
                <span className="ms-auto text-sm text-muted-foreground">
                  {t('mark.progress', { marked: markedCount, total: students.length })}
                </span>
              )}
            </div>
          </div>

          {/* Student list */}
          {classes.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('mark.noClasses')} />
          ) : loadingStudents ? (
            <div className="space-y-2 rounded-xl border bg-card p-4 shadow-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title={t('mark.noStudents')} />
          ) : (
            <ul className="divide-y rounded-xl border bg-card shadow-sm">
              {students.map((s) => {
                const current = statusMap[s.id]
                return (
                  <li key={s.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{s.name}</p>
                      {s.rollNumber && (
                        <p className="text-xs text-muted-foreground">{t('mark.roll', { roll: s.rollNumber })}</p>
                      )}
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={t('mark.statusGroup', { name: s.name })}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                      {STATUSES.map((status) => {
                        const meta = STATUS_META[status]
                        const Icon = meta.icon
                        const selected = current === status
                        return (
                          <button
                            key={status}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setStatus(s.id, status)}
                            className={cn(
                              'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              selected ? meta.active : meta.idle
                            )}
                          >
                            <Icon className="h-4 w-4" /> {t(`status.${status}`)}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !classId || students.length === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {t('mark.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="records-class">{t('records.class')}</Label>
              <Select id="records-class" value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}>
                <option value="">{t('records.allClasses')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.section ? `${c.name} • ${c.section}` : c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="records-date">{t('records.date')}</Label>
              <Input id="records-date" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {filterDate && eth.format(filterDate) ? t('mark.ethiopianDate', { date: eth.format(filterDate)! }) : t('records.dateHint')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('status.present')} value={format.number(counts.present)} icon={Check} tone="success" />
            <StatCard label={t('status.absent')} value={format.number(counts.absent)} icon={X} tone="destructive" />
            <StatCard label={t('status.late')} value={format.number(counts.late)} icon={Clock} tone="warning" />
            <StatCard label={t('status.excused')} value={format.number(counts.excused)} icon={ShieldCheck} tone="info" />
          </div>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              {t('records.title')}
              <Badge variant="secondary">{t('records.count', { count: filtered.length })}</Badge>
            </h2>
            {filtered.length === 0 ? (
              <EmptyState icon={Calendar} title={t('records.empty')} />
            ) : (
              <TableContainer>
                <thead>
                  <tr>
                    <th>{t('records.table.date')}</th>
                    <th>{t('records.table.student')}</th>
                    <th>{t('records.table.class')}</th>
                    <th>{t('records.table.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.absent
                    const Icon = meta.icon
                    const e = eth.format(r.date)
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">
                          <span className="block text-foreground">{gDate(r.date)}</span>
                          {e && <span className="block text-xs text-muted-foreground">{e}</span>}
                        </td>
                        <td className="font-medium text-foreground">{r.studentName}</td>
                        <td>{r.className || r.classId}</td>
                        <td>
                          <Badge variant={meta.badge}>
                            <Icon /> {STATUSES.includes(r.status) ? t(`status.${r.status}`) : r.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableContainer>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
