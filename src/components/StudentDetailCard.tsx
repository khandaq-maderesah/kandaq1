'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { CalendarDays, Filter, Maximize2, Pencil, Phone } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { EthDateTime, type MonthEth } from 'ethiopian-calendar-date-converter'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Student, Class, User, Attendance, AttendanceStatus } from '@/types'
import { rtdb } from '@/lib/database'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import { PARENT_LANGUAGES } from '@/lib/smsMessage'
import { StudentAvatar } from '@/components/StudentAvatar'
import { useStudentPhoto } from '@/hooks/useStudentPhoto'
import { cn } from '@/lib/utils'

interface StudentDetailCardProps {
  student: Student
  classes?: Class[]
  /** Optional user directory used to resolve the creator's name for students
   * that were registered before the creator's name was stored on the record. */
  users?: User[]
  /** When provided the card renders as a modal dialog with a close button. */
  onClose?: () => void
  /** Optional "Edit" action that jumps to the edit form for this student. */
  onEdit?: (s: Student) => void
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const shown = value !== undefined && value !== null && value !== '' ? value : undefined
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{shown ?? '—'}</dd>
    </div>
  )
}

/** Add (or subtract) a number of days to a Gregorian 'YYYY-MM-DD' date key. */
function shiftGregorianDay(dateKey: string, delta: number): string {
  const d = new Date(dateKey + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return dateKey
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: 'hsl(var(--success))',
  absent: 'hsl(var(--destructive))',
  late: 'hsl(var(--warning))',
  excused: 'hsl(var(--info))',
}

const STATUS_BADGE: Record<AttendanceStatus, BadgeProps['variant']> = {
  present: 'success',
  absent: 'destructive',
  late: 'warning',
  excused: 'info',
}

const isStatus = (s: string): s is AttendanceStatus => (STATUS_ORDER as string[]).includes(s)

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 border-t pt-4 text-sm font-semibold text-foreground">{children}</h3>
}

/**
 * Shows ALL of a student's information on one card. Rendered either inline or
 * as a modal dialog (when onClose is provided).
 */
export function StudentDetailCard({ student, classes = [], users, onClose, onEdit }: StudentDetailCardProps) {
  const t = useTranslations('students.detail')
  const tc = useTranslations('common')
  const eth = useEthiopianDate()
  const format = useFormatter()
  const cls = classes.find((c) => c.id === student.classId)

  const [showPhoto, setShowPhoto] = useState(false)
  const [attendance, setAttendance] = useState<Attendance[]>([])

  const photo = useStudentPhoto(student.id, student.photoUrl)

  const formatDate = (d?: string) => {
    if (!d) return undefined
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return d
    return format.dateTime(parsed, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const creatorLabel = () => {
    // Primary: the Ustaz who is assigned to this student's class.
    const teacherId = cls?.teacherId
    const teacherNameRaw = cls?.teacherName
    if (teacherId) {
      const u = users?.find((x) => x.uid === teacherId)
      if (u && u.name && String(u.name).trim()) {
        return u.role === 'teacher' ? t('ustaz', { name: u.name }) : u.name
      }
    }
    if (teacherNameRaw && String(teacherNameRaw).trim()) return t('ustaz', { name: teacherNameRaw })
    // Fallback: whoever created the student record (may already include a
    // "Ustaz" prefix from the backfill).
    const storedName = student.createdByName && String(student.createdByName).trim()
    if (storedName) {
      if (/^ustaz\s/i.test(storedName) || student.createdByRole !== 'teacher') return storedName
      return t('ustaz', { name: storedName })
    }
    if (student.createdBy === 'system:auto-recover') return t('systemRecovered')
    return t('admin')
  }

  // Load this student's attendance history (shown with Ethiopian calendar dates
  // below). Server-filtered by studentId, so only one student's records transfer.
  useEffect(() => {
    let active = true
    rtdb
      .getAttendanceByStudent(student.id)
      .then((records) => {
        if (active) setAttendance(records)
      })
      .catch(() => {
        if (active) setAttendance([])
      })
    return () => {
      active = false
    }
  }, [student.id])

  // Ethiopian calendar filter for this student's attendance history.
  const [ethYear, setEthYear] = useState<number>(0)
  const [ethMonth, setEthMonth] = useState<number>(0) // 0 = All Year

  useEffect(() => {
    setEthYear((curr) => (curr === 0 ? EthDateTime.now().year : curr))
  }, [])

  const ethYears = ethYear > 0 ? Array.from({ length: 6 }, (_, i) => ethYear - i) : []

  // Resolve the selected Ethiopian period into an inclusive Gregorian [start, end]
  // range (attendance records are stored with Gregorian 'YYYY-MM-DD' dates).
  const ethiopianRange = useMemo(() => {
    if (ethYear <= 0) return null
    const toKey = (y: number, m: number) =>
      new EthDateTime(y, m as MonthEth, 1).toEuropeanDate().toISOString().slice(0, 10)
    const start = ethMonth === 0 ? toKey(ethYear, 1) : toKey(ethYear, ethMonth)
    const nextStart = ethMonth === 0 || ethMonth === 13 ? toKey(ethYear + 1, 1) : toKey(ethYear, ethMonth + 1)
    return { start, end: shiftGregorianDay(nextStart, -1) }
  }, [ethYear, ethMonth])

  const filteredAttendance = useMemo(() => {
    if (!ethiopianRange) return []
    return attendance.filter((r) => r.date && r.date >= ethiopianRange.start && r.date <= ethiopianRange.end)
  }, [attendance, ethiopianRange])

  const sortedAttendance = [...filteredAttendance].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const summary = sortedAttendance.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Recharts donut data — statuses with a zero count are omitted.
  const chartData = STATUS_ORDER.map((s) => ({
    key: s,
    name: t(`status.${s}`),
    value: summary[s] || 0,
    color: STATUS_COLOR[s],
  })).filter((d) => d.value > 0)

  const sectionLabel = student.section || cls?.section
  const className = cls?.name || student.className
  const classLabel = className
    ? sectionLabel
      ? t('classWithSection', { name: className, section: sectionLabel })
      : className
    : t('classNotAssigned')
  const languageLabel = PARENT_LANGUAGES.find((l) => l.value === student.parentLanguage)?.label ?? student.parentLanguage
  const isActive = student.isActive !== false

  const body = (
    <div className="w-full">
      <div className="flex items-center gap-4 border-b pb-5 pe-8">
        {photo ? (
          <button
            type="button"
            onClick={() => setShowPhoto(true)}
            aria-label={t('viewPhoto')}
            className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StudentAvatar photoUrl={photo} studentId={student.id} name={student.name} size="lg" />
            <span className="absolute -bottom-1 -end-1 rounded-full border bg-card p-1 text-muted-foreground shadow-sm transition-colors group-hover:text-foreground">
              <Maximize2 className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : (
          <StudentAvatar photoUrl={photo} studentId={student.id} name={student.name} size="lg" />
        )}
        <div className="min-w-0">
          {onClose ? (
            <DialogTitle className="text-xl">{student.name}</DialogTitle>
          ) : (
            <h2 className="text-xl font-semibold leading-tight text-foreground">{student.name}</h2>
          )}
          {onClose ? (
            <DialogDescription className="mt-1">
              {classLabel}
              {student.rollNumber ? ` · ${t('roll', { roll: student.rollNumber })}` : ''}
            </DialogDescription>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {classLabel}
              {student.rollNumber ? ` · ${t('roll', { roll: student.rollNumber })}` : ''}
            </p>
          )}
          <Badge variant={isActive ? 'success' : 'secondary'} className="mt-2">
            {isActive ? tc('status.active') : tc('status.inactive')}
          </Badge>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label={t('rollNumber')} value={student.rollNumber} />
        <Field label={t('age')} value={student.age !== undefined ? format.number(student.age) : undefined} />
        <Field
          label={t('gender')}
          value={
            student.gender === 'male' ? tc('gender.male') : student.gender === 'female' ? tc('gender.female') : undefined
          }
        />
        <Field label={t('class')} value={className} />
        <Field label={t('section')} value={sectionLabel} />
        <Field label={t('parentLanguage')} value={languageLabel} />
        <Field label={t('studentId')} value={<span className="font-mono text-xs">{student.id}</span>} />
      </dl>

      <SectionHeading>{t('phoneHeading')}</SectionHeading>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field
          label={t('parentPhone')}
          value={
            student.parentPhone ? (
              <a
                href={`tel:${student.parentPhone}`}
                dir="ltr"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> {student.parentPhone}
              </a>
            ) : undefined
          }
        />
        <Field
          label={t('alternativePhone')}
          value={
            student.alternativePhone ? (
              <a
                href={`tel:${student.alternativePhone}`}
                dir="ltr"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> {student.alternativePhone}
              </a>
            ) : undefined
          }
        />
      </dl>

      <SectionHeading>{t('registrationHeading')}</SectionHeading>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label={t('registeredOn')} value={formatDate(student.createdAt)} />
        <Field label={t('lastUpdated')} value={formatDate(student.updatedAt)} />
        <Field label={t('createdBy')} value={creatorLabel()} />
      </dl>

      <SectionHeading>{t('attendanceHeading')}</SectionHeading>
      <div className="mt-3">
        {attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noAttendance')}</p>
        ) : (
          <>
            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> {t('calendarFilter')}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`eth-year-${student.id}`}>{t('ethYear')}</Label>
                  <Select
                    id={`eth-year-${student.id}`}
                    value={String(ethYear)}
                    onChange={(e) => setEthYear(Number(e.target.value))}
                  >
                    {ethYears.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`eth-month-${student.id}`}>{t('ethMonth')}</Label>
                  <Select
                    id={`eth-month-${student.id}`}
                    value={String(ethMonth)}
                    onChange={(e) => setEthMonth(Number(e.target.value))}
                  >
                    <option value="0">{t('allYear')}</option>
                    {eth.months.map((m, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {i + 1}. {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {filteredAttendance.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t('noAttendanceInPeriod')}</p>
            ) : (
              <>
                <div className="relative mt-3 h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="hsl(var(--card))"
                      >
                        {chartData.map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {format.number(filteredAttendance.length)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('records', { count: filteredAttendance.length })}
                    </span>
                  </div>
                </div>

                <div className="mb-3 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {chartData.map((d) => (
                    <span key={d.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      {t('legendItem', { status: d.name, count: d.value })}
                    </span>
                  ))}
                </div>

                <ul className="max-h-52 divide-y overflow-y-auto">
                  {sortedAttendance.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {formatDate(r.date)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('ethiopianSuffix', { date: eth.format(r.date) || '—' })}
                        </div>
                      </div>
                      <Badge variant={isStatus(r.status) ? STATUS_BADGE[r.status] : 'secondary'} className="shrink-0">
                        {isStatus(r.status) ? t(`status.${r.status}`) : r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
        {student.parentPhone && (
          <a href={`tel:${student.parentPhone}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Phone /> {t('callParent')}
          </a>
        )}
        {onEdit && (
          <Button type="button" size="sm" onClick={() => onEdit(student)}>
            <Pencil /> {tc('actions.edit')}
          </Button>
        )}
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {tc('actions.close')}
          </Button>
        )}
      </div>

      {photo && (
        <Dialog open={showPhoto} onOpenChange={setShowPhoto}>
          <DialogContent className="max-w-2xl bg-black p-2 text-white">
            <DialogTitle className="sr-only">{t('viewPhoto')}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={student.name}
              className="mx-auto max-h-[85dvh] w-auto max-w-full rounded-lg object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )

  if (!onClose) {
    return <div className={cn('rounded-xl border bg-card p-5 shadow-sm sm:p-6')}>{body}</div>
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">{body}</DialogContent>
    </Dialog>
  )
}
