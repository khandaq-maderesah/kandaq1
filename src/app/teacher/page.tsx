'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, UserX, Phone, Calendar, Users, Search, UserCheck } from 'lucide-react'
import type { Student, Class, Attendance } from '@/types'

export default function TeacherPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10))
  const [showAllDates, setShowAllDates] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter((c) => c.teacherId === user.uid && c.isActive !== false)

        // Only download what belongs to this teacher: their attendance plus the
        // students of their own classes (queried server-side, in parallel).
        const [attList, myStudents] = await Promise.all([
          rtdb.getAttendanceByTeacher(user.uid),
          Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id))).then((lists) =>
            lists.flat()
          ),
        ])

        setClasses(myClasses)
        setStudents(myStudents)
        setAttendance(attList)
        setSelectedClass((current) => current || (myClasses.length > 0 ? myClasses[0].id : ''))
      } catch {
        setError('Failed to load dashboard data. Check your connection.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const myClassIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes])

  const classById = useMemo(() => {
    const m: Record<string, Class> = {}
    classes.forEach((c) => {
      m[c.id] = c
    })
    return m
  }, [classes])

  const studentById = useMemo(() => {
    const m: Record<string, Student> = {}
    students.forEach((s) => {
      m[s.id] = s
    })
    return m
  }, [students])

  const absentRows = useMemo(() => {
    return attendance
      .filter((r) => r.status === 'absent')
      .filter((r) => myClassIds.has(r.classId))
      .filter((r) => !selectedClass || r.classId === selectedClass)
      .map((r) => {
        const stu = studentById[r.studentId]
        const cls = classById[r.classId]
        return {
          id: r.id,
          date: r.date,
          studentName: stu?.name || r.studentName,
          className: stu?.className || cls?.name || r.className,
          section: cls?.section || '',
          parentPhone: stu?.parentPhone || '',
          alternativePhone: stu?.alternativePhone || '',
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [attendance, studentById, classById, myClassIds, selectedClass])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Current day by default; "All dates" + search to browse previous absences.
  const filteredAbsent = absentRows.filter((r) => {
    if (!showAllDates && r.date !== dateFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.parentPhone.toLowerCase().includes(q) ||
      r.className.toLowerCase().includes(q)
    )
  })

  // Today's headline numbers for the KPI cards.
  const today = new Date().toISOString().slice(0, 10)
  const totalStudents = students.filter((s) => s.isActive && myClassIds.has(s.classId)).length
  const todayAtt = attendance.filter((r) => myClassIds.has(r.classId) && r.date === today)
  const absentToday = todayAtt.filter((r) => r.status === 'absent').length
  const presentToday = todayAtt.filter((r) => r.status === 'present').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-500 mt-1">Absent students in your classes, ready to contact</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-md">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">Total Students</span>
              <div className="rounded-lg bg-white/20 p-2"><Users className="h-5 w-5 text-white" /></div>
            </div>
            <p className="mt-3 text-4xl font-extrabold text-white">{totalStudents}</p>
          </div>
        </Card>
        <Card className="border-0 shadow-md">
          <div className="bg-gradient-to-br from-rose-600 to-red-800 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">Absent Today</span>
              <div className="rounded-lg bg-white/20 p-2"><UserX className="h-5 w-5 text-white" /></div>
            </div>
            <p className="mt-3 text-4xl font-extrabold text-white">{absentToday}</p>
          </div>
        </Card>
        <Card className="border-0 shadow-md">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">Present Today</span>
              <div className="rounded-lg bg-white/20 p-2"><UserCheck className="h-5 w-5 text-white" /></div>
            </div>
            <p className="mt-3 text-4xl font-extrabold text-white">{presentToday}</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 shadow-md bg-gradient-to-br from-rose-50 to-rose-100/70">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="inline-flex items-center justify-center rounded-lg bg-red-100 p-2">
                <UserX className="h-5 w-5 text-red-600" />
              </span>
              Absent Students (My Classes)
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-600">
                {filteredAbsent.length}
              </span>
            </CardTitle>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All My Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.section ? ` • ${c.section}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
              <input
                type="checkbox"
                checked={showAllDates}
                onChange={(e) => setShowAllDates(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              All dates
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              disabled={showAllDates}
              className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student, parent or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <CardDescription>
            {showAllDates
              ? 'Absent students from your classes with parent contact details. Tap a phone number to call directly.'
              : `Absent students in your classes for ${dateFilter}, with parent contact details. Pick a date or tick "All dates" to see previous absences.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-gray-500 text-center py-10">No classes have been assigned to you yet.</p>
          ) : filteredAbsent.length === 0 ? (
            <div className="text-center py-10">
              <UserX className="h-10 w-10 mx-auto text-red-200 mb-2" />
              <p className="text-gray-500">
                {search
                  ? 'No absent students match your search.'
                  : showAllDates
                  ? 'No absent students recorded yet in your classes.'
                  : `No absent students recorded for ${dateFilter}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />Date
                    </th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Parent Phone</th>
                    <th className="pb-3 font-medium">Alternative Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsent.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">{r.date}</td>
                      <td className="py-3 pr-4 font-medium text-gray-900">{r.studentName}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {r.className}
                          {r.section ? ` • ${r.section}` : ''}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {r.parentPhone ? (
                          <a
                            href={`tel:${r.parentPhone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-blue-700 transition hover:bg-blue-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> {r.parentPhone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        {r.alternativePhone ? (
                          <a
                            href={`tel:${r.alternativePhone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 font-medium text-teal-700 transition hover:bg-teal-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> {r.alternativePhone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-lg bg-blue-100 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </span>
            <div>
              <p className="text-sm text-gray-500">My Classes</p>
              <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


