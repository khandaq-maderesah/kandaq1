'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { ATTENDANCE_RECENT_DAYS, daysAgoISO } from '@/lib/utils'
import { Bell, CheckCircle2, Loader2, X, GraduationCap, AlertTriangle } from 'lucide-react'
import type { Class, Attendance, User, MissingAttendanceAlert } from '@/types'
import { runMissingAttendanceCheck, CHECK_INTERVAL_MS } from '@/lib/attendanceReminder'

export function AttendanceReminderBell({ dark = true }: { dark?: boolean }) {
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

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
    } catch (e) {
      console.error('Failed to resolve reminder', e)
    } finally {
      setSavingId('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Attendance reminders"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${
          dark
            ? 'bg-white/15 text-white hover:bg-white hover:text-amber-600'
            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-2 top-16 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <span className="inline-flex items-center justify-center rounded-lg bg-amber-100 p-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Attendance Reminders</p>
              <p className="text-xs text-gray-500">Classes where attendance was not taken</p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-gray-500">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                {isAdmin
                  ? 'All classes have attendance recorded so far.'
                  : 'You have taken attendance for all your classes.'}
              </div>
            ) : (
              visible.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
                >
                  <span className="mt-0.5 inline-flex items-center justify-center rounded-lg bg-red-50 p-1.5">
                    <GraduationCap className="h-4 w-4 text-red-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {isAdmin ? (
                      <p className="text-sm font-medium text-gray-900">
                        Uataz {a.teacherName}{' '}
                        <span className="text-red-600">has not taken today&apos;s attendance</span>
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">
                        Dear Ustaz {a.teacherName},{' '}
                        <span className="text-red-600">
                          please take today&apos;s attendance &mdash; you haven&apos;t taken it yet
                        </span>
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-500">
                      {a.className}
                      {a.section ? ` • ${a.section}` : ''} · {a.date}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleResolve(a.id)}
                        disabled={savingId === a.id}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {savingId === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Mark resolved
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-right">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}