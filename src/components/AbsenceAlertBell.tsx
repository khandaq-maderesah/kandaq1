'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { getConsecutiveAbsentCount } from '@/lib/absentAlert'
import { useLiveData } from '@/lib/dataStore'
import { daysAgoISO, ATTENDANCE_RECENT_DAYS } from '@/lib/utils'
import { Bell, CheckCircle2, Loader2, Phone, X, GraduationCap } from 'lucide-react'
import type { Attendance, Class, Student, AbsentAlert } from '@/types'

const ABSENT_STREAK = 5

export function AbsenceAlertBell({
  teacherOnly = false,
  dark = true,
}: {
  teacherOnly?: boolean
  dark?: boolean
}) {
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
  const [message, setMessage] = useState('')
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    setMessage('')
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
      setMessage(`Alert${ids.length > 1 ? 's' : ''} cancelled.`)
    } catch {
      setMessage('Failed to cancel alert.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-all duration-200 ${
          dark
            ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
            : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-label="Absence alerts"
        title="Absence alerts"
      >
        <Bell className="h-5 w-5" />
        {displayAlerts.length > 0 && (
          <span className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ${dark ? 'ring-indigo-700' : 'ring-white'}`}>
            {displayAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-2 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Bell className="h-4 w-4" />
              Absence Alerts
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {displayAlerts.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!teacherOnly && (
            <div className="flex gap-1 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  scope === 'all' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> All classes
              </button>
              <button
                type="button"
                onClick={() => setScope('mine')}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  scope === 'mine' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> My classes
              </button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : displayAlerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No students have reached {ABSENT_STREAK} consecutive absent days.
              </div>
            ) : (
              displayAlerts.map((a) => (
                <div
                  key={a.studentId}
                  className="flex items-start gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
                >
                  {!teacherOnly && (
                    <input
                      type="checkbox"
                      checked={selected.has(a.studentId)}
                      onChange={() => toggle(a.studentId)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.className}
                      {a.section ? ` · Section ${a.section}` : ''} &middot;{' '}
                      <span className="font-semibold text-red-600">{a.streak} days</span>
                    </p>
                  </div>
                  {a.parentPhone ? (
                    <a
                      href={`tel:${a.parentPhone}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
          {message && (
            <div className="border-t border-gray-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
              {message}
            </div>
          )}

          {!teacherOnly && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || selected.size === 0}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark Contacted &amp; Cancel ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
