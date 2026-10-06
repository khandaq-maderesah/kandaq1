'use client'

import { useCallback, useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { daysAgoISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'
import type { Attendance, Class, Student, AttendanceStatus } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

export default function AttendancePage() {
  const { user } = useAuth()

  const [tab, setTab] = useState<'mark' | 'records'>('mark')

  const [classes, setClasses] = useState<Class[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClassId, setFilterClassId] = useState('')
  const [filterDate, setFilterDate] = useState(today())
  const [error, setError] = useState('')

  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today())
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [attendanceList, classList] = await Promise.all([
        rtdb.getAllAttendanceSince(daysAgoISO(90)),
        rtdb.getAllClasses(),
      ])
      setRecords(attendanceList)
      setClasses(classList)
      setError('')
      setClassId((current) => (classList.length > 0 && !current ? classList[0].id : current))
    } catch {
      setError('Failed to load attendance data')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(true)
  }, [loadData])

  // Load students + existing attendance for the selected class/date (admin can mark any class)
  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return
      setLoadingStudents(true)
      setError('')
      setSuccess('')
      try {
        const studentList = await rtdb.getStudentsByClass(classId)
        const activeStudents = studentList.filter((s) => s.isActive)
        setStudents(activeStudents)
        const existing = await rtdb.getAttendanceByClassAndDate(classId, date)
        const map: Record<string, AttendanceStatus> = {}
        existing.forEach((r) => {
          map[r.studentId] = r.status
        })
        setStatusMap(map)
      } catch {
        setError('Failed to load students')
      } finally {
        setLoadingStudents(false)
      }
    }
    loadClassData()
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

  const handleSave = async () => {
    if (!classId || !user) return
    setSaving(true)
    setError('')
    setSuccess('')
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
      setSuccess('Attendance saved successfully')
      await loadData(false) // quietly refresh records overview
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const filtered = records.filter(
    (r) => (!filterClassId || r.classId === filterClassId) && (!filterDate || r.date === filterDate)
  )
  const present = filtered.filter((r) => r.status === 'present').length
  const absent = filtered.filter((r) => r.status === 'absent').length
  const late = filtered.filter((r) => r.status === 'late').length
  const excused = filtered.filter((r) => r.status === 'excused').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-1">Mark attendance for any class and monitor records</p>
        </div>
        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button onClick={() => setTab('mark')} className={cn_tab(tab === 'mark')}>
            <ClipboardList className="h-4 w-4" /> Mark Attendance
          </button>
          <button onClick={() => setTab('records')} className={cn_tab(tab === 'records')}>
            <Calendar className="h-4 w-4" /> Records
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {tab === 'mark' ? (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg">Mark Attendance</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.section ? ' • ' + c.section : ''}
                      {c.teacherName ? ' — ' + c.teacherName : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" size="sm" onClick={() => markAll('present')}>
                <Check className="h-4 w-4 mr-1" /> All Present
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => markAll('absent')}>
                <X className="h-4 w-4 mr-1" /> All Absent
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => markAll('excused')}>
                <ShieldCheck className="h-4 w-4 mr-1" /> All Excused
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => markAll(null)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-gray-500 text-center py-16">No active students in this class.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-4 font-medium">Student</th>
                      <th className="pb-3 pr-4 font-medium">Roll</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const status = statusMap[s.id]
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">{s.name}</td>
                          <td className="py-3 pr-4">{s.rollNumber || '—'}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => setStatus(s.id, 'present')} className={cn_status('present', status)}>
                                <Check className="h-3.5 w-3.5" /> Present
                              </button>
                              <button onClick={() => setStatus(s.id, 'absent')} className={cn_status('absent', status)}>
                                <X className="h-3.5 w-3.5" /> Absent
                              </button>
                              <button onClick={() => setStatus(s.id, 'late')} className={cn_status('late', status)}>
                                <Clock className="h-3.5 w-3.5" /> Late
                              </button>
                              <button onClick={() => setStatus(s.id, 'excused')} className={cn_status('excused', status)}>
                                <ShieldCheck className="h-3.5 w-3.5" /> Excused
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6">
              <Button onClick={handleSave} disabled={saving || !classId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Class</label>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-green-200">
              <CardHeader><CardTitle className="text-green-700">Present</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{present}</p></CardContent>
            </Card>
            <Card className="border-red-200">
              <CardHeader><CardTitle className="text-red-700">Absent</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{absent}</p></CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardHeader><CardTitle className="text-yellow-700">Late</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{late}</p></CardContent>
            </Card>
            <Card className="border-violet-200">
              <CardHeader><CardTitle className="text-violet-700">Excused</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{excused}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Records ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No attendance records for the selected filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 pr-4 font-medium">Student</th>
                        <th className="pb-3 pr-4 font-medium">Class</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" /> {r.date}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-medium">{r.studentName}</td>
                          <td className="py-3 pr-4">{r.className || r.classId}</td>
                          <td className="py-3">
                            <span
                              className={
                                r.status === 'present'
                                  ? 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700'
                                  : r.status === 'late'
                                  ? 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700'
                                  : r.status === 'excused'
                                  ? 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700'
                                  : 'inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700'
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function cn_tab(active: boolean): string {
  return active
    ? 'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white shadow'
    : 'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100'
}

function cn_status(status: AttendanceStatus, current?: AttendanceStatus): string {
  const base = 'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border '
  if (status === 'present') {
    return current === status
      ? base + 'bg-green-500 text-white border-green-500'
      : base + 'bg-white text-green-600 border-green-300 hover:bg-green-50'
  }
  if (status === 'absent') {
    return current === status
      ? base + 'bg-red-500 text-white border-red-500'
      : base + 'bg-white text-red-600 border-red-300 hover:bg-red-50'
  }
  if (status === 'excused') {
    return current === status
      ? base + 'bg-violet-500 text-white border-violet-500'
      : base + 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50'
  }
  return current === status
    ? base + 'bg-yellow-500 text-white border-yellow-500'
    : base + 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50'
}