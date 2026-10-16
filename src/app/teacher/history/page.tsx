'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { History, X } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, TableContainer } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import type { Attendance, AttendanceStatus, Class } from '@/types'

const STATUS_VALUES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

const statusTone: Record<AttendanceStatus, string> = {
  present: 'border-success/40 bg-success/10 text-success',
  absent: 'border-destructive/40 bg-destructive/10 text-destructive',
  late: 'border-warning/40 bg-warning/10 text-warning',
  excused: 'border-info/40 bg-info/10 text-info',
}

export default function TeacherHistoryPage() {
  const t = useTranslations('teacherHistory')
  const format = useFormatter()
  const { user } = useAuth()
  const [records, setRecords] = useState<Attendance[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const classList = await rtdb.getAllClasses()
        // Teachers only see history for the classes assigned to them.
        const myClasses = classList.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        const myClassIds = new Set(myClasses.map((c) => c.id))
        setClasses(myClasses)
        // Server-side filtered: only this teacher's own attendance is downloaded.
        const [attendanceList, myStudents] = await Promise.all([
          rtdb.getAttendanceByTeacher(user.uid),
          Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id))).then((l) => l.flat()),
        ])
        // Archived (deleted) students are hidden everywhere in the teacher area.
        const archivedIds = new Set(myStudents.filter((s) => s.isActive === false).map((s) => s.id))
        setRecords(
          attendanceList
            .filter((r) => myClassIds.has(r.classId) && !archivedIds.has(r.studentId))
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        )
      } catch {
        toast.error(t('toast.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const classById = useMemo(() => {
    const m: Record<string, Class> = {}
    classes.forEach((c) => {
      m[c.id] = c
    })
    return m
  }, [classes])

  const filtered = records.filter((r) => (!classId || r.classId === classId) && (!date || r.date === date))

  const formatDate = (d: string) => {
    const parsed = new Date(`${d}T00:00:00`)
    return isNaN(parsed.getTime()) ? d : format.dateTime(parsed, { dateStyle: 'medium' })
  }

  const handleStatusChange = async (r: Attendance, status: AttendanceStatus) => {
    try {
      await rtdb.updateAttendance(r.id, {
        status,
        markedAt: new Date().toISOString(),
      })
      setRecords((prev) => prev.map((rec) => (rec.id === r.id ? { ...rec, status } : rec)))
      toast.success(t('toast.updated'))
    } catch {
      toast.error(t('toast.updateFailed'))
    }
  }

  const statusSelect = (r: Attendance, label: string) => (
    <Select
      aria-label={label}
      value={r.status}
      onChange={(e) => handleStatusChange(r, e.target.value as AttendanceStatus)}
      className={cn('h-10 w-auto min-w-[8.5rem] font-medium', statusTone[r.status])}
    >
      {STATUS_VALUES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </Select>
  )

  const className = (r: Attendance) => {
    const cls = classById[r.classId]
    const name = cls?.name || r.className || r.classId
    return cls?.section ? `${name} · ${cls.section}` : name
  }

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="hist-class">{t('filters.class')}</Label>
          <Select id="hist-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('filters.allClasses')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.section ? `${c.name} · ${c.section}` : c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hist-date">{t('filters.date')}</Label>
          <div className="flex gap-2">
            <Input id="hist-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {date && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDate('')}
                aria-label={t('filters.clearDate')}
                title={t('filters.clearDate')}
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{t('records', { count: filtered.length })}</p>

          {/* Mobile: stacked cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.studentName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(r.date)} · {className(r)}
                  </p>
                </div>
                {statusSelect(r, t('table.changeStatus', { name: r.studentName, date: formatDate(r.date) }))}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>{t('table.date')}</th>
                <th>{t('table.student')}</th>
                <th>{t('table.class')}</th>
                <th>{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="font-medium text-foreground">{r.studentName}</td>
                  <td className="text-muted-foreground">{className(r)}</td>
                  <td>{statusSelect(r, t('table.changeStatus', { name: r.studentName, date: formatDate(r.date) }))}</td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
        </>
      )}
    </div>
  )
}
