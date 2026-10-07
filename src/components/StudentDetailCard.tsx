'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Phone, Pencil, X, Maximize2, CalendarDays, Filter } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { EthDateTime, type MonthEth } from 'ethiopian-calendar-date-converter'
import type { Student, Class, User, Attendance } from '@/types'
import { rtdb } from '@/lib/database'
import { ethiopianDateLabel, ETHIOPIAN_MONTHS } from '@/lib/ethiopianDate'
import { StudentAvatar } from '@/components/StudentAvatar'
import { useStudentPhoto } from '@/hooks/useStudentPhoto'

interface StudentDetailCardProps {
  student: Student
  classes?: Class[]
  /** Optional user directory used to resolve the creator's name for students
   * that were registered before the creator's name was stored on the record. */
  users?: User[]
  /** When provided the card renders as a modal overlay with a close button. */
  onClose?: () => void
  /** Optional "Edit" action that jumps to the edit form for this student. */
  onEdit?: (s: Student) => void
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const shown =
    value !== undefined && value !== null && value !== '' ? String(value) : undefined
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-800">{shown || '—'}</dd>
    </div>
  )
}

function formatDate(d?: string) {
  if (!d) return undefined
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Add (or subtract) a number of days to a Gregorian 'YYYY-MM-DD' date key. */
function shiftGregorianDay(dateKey: string, delta: number): string {
  const d = new Date(dateKey + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return dateKey
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function capitalize(s?: string) {
  if (!s) return undefined
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case 'present':
      return 'bg-green-100 text-green-700'
    case 'absent':
      return 'bg-red-100 text-red-700'
    case 'late':
      return 'bg-amber-100 text-amber-700'
    case 'excused':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function creatorLabel(student: Student, cls: Class | undefined, users?: User[]) {
  // Primary: the Ustaz who is assigned to this student's class.
  const teacherId = cls?.teacherId
  const teacherNameRaw = cls?.teacherName
  if (teacherId) {
    const u = users?.find((x) => x.uid === teacherId)
    if (u && u.name && String(u.name).trim()) {
      return u.role === 'teacher' ? `Ustaz ${u.name}` : u.name
    }
  }
  if (teacherNameRaw && String(teacherNameRaw).trim()) {
    return `Ustaz ${teacherNameRaw}`
  }
  // Fallback: whoever created the student record (already stored, may include
  // a "Ustaz" prefix from the backfill).
  const storedName = student.createdByName && String(student.createdByName).trim()
  if (storedName) {
    if (/^ustaz\s/i.test(storedName) || student.createdByRole !== 'teacher') return storedName
    return `Ustaz ${storedName}`
  }
  if (student.createdBy === 'system:auto-recover') return 'System (auto-recovered)'
  return 'Admin'
}
/**
 * Shows ALL of a student's information on one card. Rendered either inline or
 * as a modal overlay (when onClose is provided).
 */
export function StudentDetailCard({ student, classes = [], users, onClose, onEdit }: StudentDetailCardProps) {
  const cls = classes.find((c) => c.id === student.classId)

  const [showPhoto, setShowPhoto] = useState(false)
  const [attendance, setAttendance] = useState<Attendance[]>([])

  const photo = useStudentPhoto(student.id, student.photoUrl)

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

  const ethYears =
    ethYear > 0 ? Array.from({ length: 6 }, (_, i) => ethYear - i) : []

  // Resolve the selected Ethiopian period into an inclusive Gregorian [start, end]
  // range (our attendance records are stored with Gregorian 'YYYY-MM-DD' dates).
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
    return attendance.filter(
      (r) => r.date && r.date >= ethiopianRange.start && r.date <= ethiopianRange.end
    )
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
  const chartData = [
    { name: 'Present', value: summary['present'] || 0, color: '#22c55e' },
    { name: 'Absent', value: summary['absent'] || 0, color: '#ef4444' },
    { name: 'Late', value: summary['late'] || 0, color: '#f59e0b' },
    { name: 'Excused', value: summary['excused'] || 0, color: '#3b82f6' },
  ].filter((d) => d.value > 0)

  // Close the modal when the Escape key is pressed.
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const classLabel = cls
    ? `${cls.name}${cls.section ? ` • Section ${cls.section}` : ''}${cls.grade ? ` (${cls.grade})` : ''}`
    : student.className || undefined

  const card = (
    <Card className="w-full border-0 shadow-2xl">
      {showPhoto && photo && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowPhoto(false)}
        >
          <button
            type="button"
            aria-label="Close photo"
            className="absolute right-4 top-4 text-white/80 transition hover:text-white"
            onClick={() => setShowPhoto(false)}
          >
            <X className="h-7 w-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={student.name}
            className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <CardHeader className="relative rounded-t-xl bg-gradient-to-r from-green-700 to-emerald-800 text-white">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student details"
            className="absolute right-4 top-4 text-white/80 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-4 pr-10">
          {photo ? (
            <button
              type="button"
              onClick={() => setShowPhoto(true)}
              title="View photo"
              aria-label="View photo"
              className="group relative shrink-0"
            >
              <StudentAvatar photoUrl={photo} studentId={student.id} name={student.name} size="lg" className="ring-4 ring-white/30" />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-black/50 p-1 text-white/90 transition group-hover:bg-black/70">
                <Maximize2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <StudentAvatar photoUrl={photo} studentId={student.id} name={student.name} size="lg" className="ring-4 ring-white/30" />
          )}
          <div>
            <CardTitle className="text-2xl">{student.name}</CardTitle>
            <p className="mt-1 text-sm text-green-100">
              {classLabel || 'Class not assigned'}
              {student.rollNumber ? ` • Roll ${student.rollNumber}` : ''}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                student.isActive ? 'bg-green-400/20 text-green-100' : 'bg-gray-500/30 text-gray-200'
              }`}
            >
              {student.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Roll Number" value={student.rollNumber} />
          <Field label="Age" value={student.age} />
          <Field label="Gender" value={capitalize(student.gender)} />
          <Field label="Class" value={cls?.name || student.className} />
          <Field label="Section" value={student.section || cls?.section} />
          <Field label="Student ID" value={student.id} />
        </div>
        <h3 className="mt-6 border-t border-gray-100 pt-4 text-xs font-semibold uppercase tracking-wide text-green-600">
          Phone
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Parent Phone</dt>
            <dd className="mt-1 text-sm text-gray-800">
              {student.parentPhone ? (
                <a href={`tel:${student.parentPhone}`} className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {student.parentPhone}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Alternative Phone</dt>
            <dd className="mt-1 text-sm text-gray-800">
              {student.alternativePhone ? (
                <a href={`tel:${student.alternativePhone}`} className="inline-flex items-center gap-1 font-medium text-teal-600 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {student.alternativePhone}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </div>

        <h3 className="mt-6 border-t border-gray-100 pt-4 text-xs font-semibold uppercase tracking-wide text-green-600">
          Registration
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Registered On" value={formatDate(student.createdAt)} />
          <Field label="Last Updated" value={formatDate(student.updatedAt)} />
          <Field label="Created By" value={creatorLabel(student, cls, users)} />
        </div>

        <h3 className="mt-6 border-t border-gray-100 pt-4 text-xs font-semibold uppercase tracking-wide text-green-600">
          Attendance History
        </h3>

        <div className="mt-3">
          {attendance.length === 0 ? (
            <p className="text-sm text-gray-400">No attendance records yet for this student.</p>
          ) : (
            <>
              <Card className="border border-gray-200 bg-gray-50/60 shadow-none">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Filter className="h-3.5 w-3.5" /> Ethiopian Calendar Filter
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="eth-year" className="text-xs text-gray-500">
                        Ethiopian Year
                      </Label>
                      <Select
                        id="eth-year"
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
                    <div className="space-y-1.5">
                      <Label htmlFor="eth-month" className="text-xs text-gray-500">
                        Ethiopian Month
                      </Label>
                      <Select
                        id="eth-month"
                        value={String(ethMonth)}
                        onChange={(e) => setEthMonth(Number(e.target.value))}
                      >
                        <option value="0">All Year</option>
                        {ETHIOPIAN_MONTHS.map((m, i) => (
                          <option key={i + 1} value={String(i + 1)}>
                            {i + 1}. {m}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {filteredAttendance.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">
                  No attendance recorded in the selected Ethiopian period.
                </p>
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
                          label={(entry: any) => `${entry.name}: ${entry.value}`}
                        >
                          {chartData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-800">{filteredAttendance.length}</span>
                      <span className="text-xs text-gray-400">records</span>
                    </div>
                  </div>

                  <div className="mb-3 mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {chartData.map((d) => (
                      <span
                        key={d.name}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}: {d.value}
                      </span>
                    ))}
                  </div>

                  <ul className="max-h-52 divide-y divide-gray-100 overflow-y-auto">
                    {sortedAttendance.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm text-gray-800">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            {formatDate(r.date)}
                          </div>
                          <div className="text-xs font-medium text-green-600">
                            {ethiopianDateLabel(r.date) || '—'} <span className="text-gray-400">(Ethiopian)</span>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(r.status)}`}>
                          {capitalize(r.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {student.parentPhone && (
            <a href={`tel:${student.parentPhone}`}>
              <Button type="button" variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1.5" /> Call Parent
              </Button>
            </a>
          )}
          {onEdit && (
            <Button type="button" size="sm" onClick={() => onEdit(student)}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          {onClose && (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4 mr-1.5" /> Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!onClose) return card

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {card}
      </div>
    </div>
  )
}
