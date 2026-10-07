'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Users,
  GraduationCap,
  Shield,
  ClipboardList,
  Download,
  Printer,
  Calendar,
  Filter,
} from 'lucide-react'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import type { Student, Class, Attendance, User } from '@/types'
import { useLiveData } from '@/lib/dataStore'

export default function ReportsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [teacherCount, setTeacherCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Realtime data via the shared store — the report updates live as data changes,
  // without adding duplicate subscriptions on top of the navbar bells.
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeAttendance = useLiveData<Attendance[]>(
    'attendance:all',
    (emit) => rtdb.subscribeToAttendance(emit)
  )
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))

  useEffect(() => {
    if (storeStudents.data) {
      setStudents(storeStudents.data)
      setLoading(false)
    }
  }, [storeStudents.data])
  useEffect(() => {
    setClasses(storeClasses.data ?? [])
  }, [storeClasses.data])
  useEffect(() => {
    setAttendance(storeAttendance.data ?? [])
  }, [storeAttendance.data])
  useEffect(() => {
    setTeacherCount((storeUsers.data ?? []).filter((x) => x.role === 'teacher').length)
  }, [storeUsers.data])
  // Attendance filtered by the selected date range (empty = all)
  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return attendance
    return attendance.filter((a) => {
      if (fromDate && a.date < fromDate) return false
      if (toDate && a.date > toDate) return false
      return true
    })
  }, [attendance, fromDate, toDate])

  const stats = useMemo(() => {
    const present = filtered.filter((a) => a.status === 'present').length
    const absent = filtered.filter((a) => a.status === 'absent').length
    const late = filtered.filter((a) => a.status === 'late').length
    const excused = filtered.filter((a) => a.status === 'excused').length

    const dayMap: Record<string, { present: number; absent: number; late: number; excused: number }> = {}
    filtered.forEach((a) => {
      if (!dayMap[a.date]) dayMap[a.date] = { present: 0, absent: 0, late: 0, excused: 0 }
      dayMap[a.date][a.status]++
    })
    const dailyData = Object.keys(dayMap)
      .sort()
      .slice(-7)
      .map((date) => ({ date, ...dayMap[date] }))

    return {
      present,
      absent,
      late,
      excused,
      totalRecords: filtered.length,
      dailyData,
      statusData: [
        { name: 'Present', value: present },
        { name: 'Absent', value: absent },
        { name: 'Late', value: late },
        { name: 'Excused', value: excused },
      ],
    }
  }, [filtered])

  const studentSummary = useMemo(() => {
    const map: Record<string, { present: number; absent: number; late: number; excused: number }> = {}
    filtered.forEach((a) => {
      if (!map[a.studentId]) map[a.studentId] = { present: 0, absent: 0, late: 0, excused: 0 }
      map[a.studentId][a.status]++
    })
    const classInfo: Record<string, string> = {}
    classes.forEach((c) => {
      classInfo[c.id] = c.name
    })
    return students
      .filter((s) => s.isActive)
      .map((s) => {
        const m = map[s.id] || { present: 0, absent: 0, late: 0, excused: 0 }
        const total = m.present + m.absent + m.late + m.excused
        const rate = total > 0 ? Math.round((m.present / total) * 100) : 0
        return {
          id: s.id,
          name: s.name,
          className: s.className || classInfo[s.classId] || '—',
          ...m,
          total,
          rate,
        }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [filtered, students, classes])

  const handleExport = () => {
    exportToCsv(`attendance-report-${dateStamp()}.csv`, ['Metric', 'Value'], [
      ['Total Students', students.length],
      ['Total Classes', classes.length],
      ['Total Teachers', teacherCount],
      ['Attendance Records (range)', stats.totalRecords],
      ['Present', stats.present],
      ['Absent', stats.absent],
      ['Late', stats.late],
      ['Excused', stats.excused],
    ])
  }

  const handleExportStudents = () => {
    exportToCsv(
      `student-attendance-${dateStamp()}.csv`,
      ['Name', 'Class', 'Present', 'Absent', 'Late', 'Excused', 'Total', 'Rate %'],
      studentSummary.map((r) => [r.name, r.className, r.present, r.absent, r.late, r.excused, r.total, r.rate])
    )
  }

  const handlePrint = () => window.print()
  const COLORS = ['#22c55e', '#ef4444', '#eab308', '#8b5cf6']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports and Analytics</h1>
          <p className="text-gray-600 mt-1">Overview of your school&apos;s attendance data</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportStudents}>
            <Download className="h-4 w-4 mr-2" /> Student CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Summary CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Date range filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Date Range
          </CardTitle>
          <CardDescription>Filter all numbers below by the selected range (leave blank for all time)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => { setFromDate(''); setToDate('') }}>
              <Calendar className="h-4 w-4 mr-2" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Students</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{students.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Classes</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{classes.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Teachers</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{teacherCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Records</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.totalRecords}</p></CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Attendance by Status</CardTitle></CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-8 p-6">
            <svg viewBox="0 0 200 200" className="h-52 w-52">
              <circle cx="100" cy="100" r="80" fill="none" strokeWidth="26" className="text-gray-100" />
              {(() => {
                const total = stats.statusData.reduce((a: number, d: any) => a + d.value, 0)
                const C = 2 * Math.PI * 80
                let offset = 0
                return stats.statusData.map((d: any, i: number) => {
                  const len = total > 0 ? (d.value / total) * C : 0
                  const seg = (
                    <circle
                      key={d.name}
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      strokeWidth="26"
                      stroke={COLORS[i % COLORS.length]}
                      strokeDasharray={`${len} ${C - len}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 100 100)"
                    />
                  )
                  offset += len
                  return seg
                })
              })()}
            </svg>
            <ul className="space-y-3">
              {stats.statusData.map((d: any, i: number) => (
                <li key={d.name} className="flex items-center gap-3 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="w-20 capitalize font-medium text-gray-700">{d.name}</span>
                  <span className="font-bold text-gray-900">{d.value}</span>
                  <span className="text-gray-500">
                    ({(() => {
                      const t = stats.statusData.reduce((a: number, x: any) => a + x.value, 0)
                      return t > 0 ? Math.round((d.value / t) * 100) : 0
                    })()}%)
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Daily Attendance</CardTitle></CardHeader>
          <CardContent className="h-72">
            {stats.dailyData.length === 0 ? (
              <p className="text-gray-500 text-center pt-20">No attendance data available yet.</p>
            ) : (
              <>
              <div className="flex h-64 items-end gap-3 border-b border-gray-100 pb-6 pt-2">
                {stats.dailyData.map((d: { date: string; present: number; late: number; absent: number; excused: number }) => {
                  const max = Math.max(d.present, d.late, d.absent, d.excused, 1)
                  return (
                    <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="flex h-[80%] w-full items-end justify-center gap-1.5">
                        <div title={`Present ${d.present}`} className="w-3 rounded-t bg-green-500" style={{ height: `${(d.present / max) * 100}%` }} />
                        <div title={`Late ${d.late}`} className="w-3 rounded-t bg-amber-500" style={{ height: `${(d.late / max) * 100}%` }} />
                        <div title={`Absent ${d.absent}`} className="w-3 rounded-t bg-red-500" style={{ height: `${(d.absent / max) * 100}%` }} />
                        <div title={`Excused ${d.excused}`} className="w-3 rounded-t bg-amber-500" style={{ height: `${(d.excused / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{d.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" /> Present</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Late</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Absent</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Excused</span>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Per-student attendance summary */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Student Attendance Summary</CardTitle>
          <span className="text-sm text-gray-500">{studentSummary.length} active students</span>
        </CardHeader>
        <CardContent>
          {studentSummary.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No students in the selected range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Present</th>
                    <th className="pb-3 pr-4 font-medium">Absent</th>
                    <th className="pb-3 pr-4 font-medium">Late</th>
                    <th className="pb-3 pr-4 font-medium">Excused</th>
                    <th className="pb-3 pr-4 font-medium">Total</th>
                    <th className="pb-3 font-medium">Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummary.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{r.name}</td>
                      <td className="py-3 pr-4">{r.className}</td>
                      <td className="py-3 pr-4 text-green-700">{r.present}</td>
                      <td className="py-3 pr-4 text-red-700">{r.absent}</td>
                      <td className="py-3 pr-4 text-amber-700">{r.late}</td>
                      <td className="py-3 pr-4 text-amber-700">{r.excused}</td>
                      <td className="py-3 pr-4">{r.total}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            r.rate >= 90
                              ? 'bg-green-100 text-green-700'
                              : r.rate >= 75
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {r.rate}%
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
    </div>
  )
}
