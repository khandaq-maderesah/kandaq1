'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { daysAgoISO, ATTENDANCE_RECENT_DAYS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Users,
  User,
  GraduationCap,
  UserX,
  Calendar,
  Phone,
  Search,
  Trash2,
  Copy,
  MessageSquare,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { generateSmsMessage } from '@/lib/smsMessage'

interface AbsentStudent {
  id: string
  date: string
  studentName: string
  className: string
  section: string
  parentPhone: string
  alternativePhone?: string
  gender?: string
  parentLanguage?: string
}

interface DashboardData {
  totalStudents: number
  maleStudents: number
  femaleStudents: number
  totalTeachers: number
  totalClasses: number
  absentCount: number
  weeklyAbsentCount: number
  classGender: { name: string; male: number; female: number; teacherName?: string }[]
  classes: { id: string; name: string; section?: string }[]
  classDailyStatus: Record<string, { date: string; present: number; absent: number; late: number; excused: number }[]>
  absentStudents: AbsentStudent[]
}

export default function AdminPage() {
  const [error] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10))
  const [showAllDates, setShowAllDates] = useState(false)
  const [weeklyOnly, setWeeklyOnly] = useState(false)
  // Which list is currently shown under the KPI cards (inline, no redirect).
  const [activeSection, setActiveSection] = useState<'students' | 'teachers' | 'classes' | 'absent'>('absent')
  const [viewStudent, setViewStudent] = useState<any | null>(null)
  const [studentsSearch, setStudentsSearch] = useState('')
  // Which gender the inline Student List shows — driven by the KPI cards
  // (Total = all, Male = boys, Female = girls).
  const [studentGenderFilter, setStudentGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [teachersSearch, setTeachersSearch] = useState('')
  const [classesSearch, setClassesSearch] = useState('')

  // Shared realtime store: `students`, `classes` and `users` are read from the
  // same channels as the navbar bells, so each node is downloaded ONCE per
  // screen instead of once per component (3x attendance / 2x students before).
  // Attendance defaults to the shared recent window (one channel for the whole
  // app); toggling "show all dates" opens a second full-history channel on
  // demand instead of always paying for it.
  const attendanceSinceKey = useMemo(() => daysAgoISO(ATTENDANCE_RECENT_DAYS), [])
  const studentsData = useLiveData<any[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const classesData = useLiveData<any[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const usersData = useLiveData<any[]>('users', (emit) => rtdb.subscribeToUsers(emit))
  const recentAttendance = useLiveData<any[]>(
    `attendance:since:${attendanceSinceKey}`,
    (emit) => rtdb.subscribeToAttendanceSince(attendanceSinceKey, emit)
  )
  const allAttendance = useLiveData<any[]>(
    showAllDates ? 'attendance:all' : null,
    (emit) => rtdb.subscribeToAttendance(emit)
  )

  // Stabilize the fallback references: `data ?? []` re-creates a new array on
  // every render while data hasn't arrived, which would re-run the memoized
  // computations below on every render.
  const studentsAll = useMemo(() => studentsData.data ?? [], [studentsData.data])
  const classesAll = useMemo(() => classesData.data ?? [], [classesData.data])
  const usersAll = useMemo(() => usersData.data ?? [], [usersData.data])
  const attendanceAll = useMemo(
    () => (showAllDates ? allAttendance.data : recentAttendance.data) ?? [],
    [showAllDates, allAttendance.data, recentAttendance.data]
  )
  const loading =
    !studentsData.data ||
    !classesData.data ||
    !usersData.data ||
    (showAllDates ? allAttendance.data === undefined : recentAttendance.data === undefined)

  const data = useMemo<DashboardData>(() => {
    const students = studentsAll
    const classes = classesAll
    const attendance = attendanceAll
    const users = usersAll

    // Class lookup (name / section / teacher)
    const userById = new Map(users.map((u: any) => [u.uid, u]))
    const classInfo: Record<string, { name: string; section?: string; teacherName?: string }> = {}
    classes.forEach((c) => {
      const teacher = userById.get(c.teacherId)
      classInfo[c.id] = {
        name: c.name,
        section: c.section,
        teacherName: c.teacherName || teacher?.name || '',
      }
    })

    const activeStudents = students.filter((s: any) => s.isActive)
    const totalTeachers = users.filter((u: any) => u.role === 'teacher').length

    // Gender totals for the whole student body (shown in the Total Students hover)
    const maleStudents = activeStudents.filter((s: any) => s.gender === 'male').length
    const femaleStudents = activeStudents.filter((s: any) => s.gender === 'female').length

    // Male / Female per class + section (e.g. "Grade 1 A", "Grade 1 B")
    const genderMap: Record<string, { male: number; female: number; name: string; teacherName: string }> = {}
    activeStudents.forEach((s: any) => {
      const cid = s.classId || 'none'
      const baseName = s.className || classInfo[cid]?.name || 'Unassigned'
      const section = s.section || classInfo[cid]?.section || ''
      const key = `${cid}::${section}`
      const name = section ? `${baseName} ${section}` : baseName
      if (!genderMap[key]) {
        genderMap[key] = { male: 0, female: 0, name, teacherName: classInfo[cid]?.teacherName || '' }
      }
      if (s.gender === 'male') genderMap[key].male++
      else if (s.gender === 'female') genderMap[key].female++
    })
    const classGender = Object.keys(genderMap).map((key) => ({
      name: genderMap[key].name,
      male: genderMap[key].male,
      female: genderMap[key].female,
      teacherName: genderMap[key].teacherName,
    }))

    // Daily attendance status per class (last 7 days) — drives the Student Status
    // chart so each day shows how many students were present / absent / late /
    // excused, instead of a single all-time rate for the whole class.
    const classDayMap: Record<string, Record<string, { present: number; absent: number; late: number; excused: number }>> = {}
    attendance.forEach((a: any) => {
      const cid = a.classId || 'none'
      const date = a.date || ''
      if (!classDayMap[cid]) classDayMap[cid] = {}
      if (!classDayMap[cid][date]) classDayMap[cid][date] = { present: 0, absent: 0, late: 0, excused: 0 }
      const entry = classDayMap[cid][date]
      if (a.status === 'present') entry.present += 1
      else if (a.status === 'absent') entry.absent += 1
      else if (a.status === 'late') entry.late += 1
      else if (a.status === 'excused') entry.excused += 1
    })
    const classDailyStatus: Record<string, { date: string; present: number; absent: number; late: number; excused: number }[]> = {}
    Object.keys(classDayMap).forEach((cid) => {
      classDailyStatus[cid] = Object.keys(classDayMap[cid])
        .filter(Boolean)
        .sort()
        .slice(-7)
        .map((date) => ({ date, ...classDayMap[cid][date] }))
    })

    // Student lookup for absent join
    const studentById: Record<string, any> = {}
    students.forEach((s: any) => {
      studentById[s.id] = s
    })
    const absentStudents = attendance
      .filter((r: any) => r.status === 'absent')
      .map((r: any) => {
        const stu = studentById[r.studentId]
        const cid = stu?.classId || r.classId
        return {
          id: r.id,
          date: r.date,
          studentName: r.studentName,
          className: r.className || classInfo[cid]?.name || '—',
          section: classInfo[cid]?.section || '',
          parentPhone: stu?.parentPhone || '—',
          alternativePhone: stu?.alternativePhone || '',
          gender: stu?.gender,
          parentLanguage: stu?.parentLanguage,
        }
      })

    const classList = classes.map((c: any) => ({
      id: c.id,
      name: c.name,
      section: c.section,
    }))

    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const weeklyAbsentCount = attendance.filter(
      (a: any) => a.status === 'absent' && a.date >= weekStartStr
    ).length

    return {
      totalStudents: activeStudents.length,
      maleStudents,
      femaleStudents,
      totalTeachers,
      totalClasses: classes.length,
      absentCount: absentStudents.length,
      weeklyAbsentCount,
      classGender,
      classes: classList,
      classDailyStatus,
      absentStudents,
    }
  }, [studentsAll, classesAll, attendanceAll, usersAll])

  // Select the first class by default (once class data arrives)
  useEffect(() => {
    if (!selectedClass && data.classes.length > 0) {
      setSelectedClass(data.classes[0].id)
    }
  }, [data.classes, selectedClass])

// Inline lists for the Students/Teachers/Classes KPI cards (hooks must be
  // declared before the loading early-return).
  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase()
    const classById: Record<string, any> = {}
    classesAll.forEach((c: any) => {
      classById[c.id] = c
    })
    return studentsAll
      .filter((s: any) => s.isActive !== false)
      .filter((s: any) => studentGenderFilter === 'all' || s.gender === studentGenderFilter)
      .filter((s: any) => {
        if (!q) return true
        const cls = classById[s.classId]
        return (
          s.name.toLowerCase().includes(q) ||
          (s.rollNumber || '').toLowerCase().includes(q) ||
          (s.parentPhone || '').toLowerCase().includes(q) ||
          (cls?.name || '').toLowerCase().includes(q)
        )
      })
      .sort((a: any, b: any) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
  }, [studentsAll, classesAll, studentsSearch, studentGenderFilter])

  const filteredTeachers = useMemo(() => {
    const q = teachersSearch.trim().toLowerCase()
    return usersAll
      .filter((u: any) => u.role === 'teacher')
      .filter((u: any) => {
        if (!q) return true
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
        )
      })
  }, [usersAll, teachersSearch])

  const filteredClasses = useMemo(() => {
    const q = classesSearch.trim().toLowerCase()
    return classesAll
      .filter((c: any) => c.isActive !== false)
      .filter((c: any) => {
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          (c.section || '').toLowerCase().includes(q) ||
          (c.teacherName || '').toLowerCase().includes(q)
        )
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [classesAll, classesSearch])

if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const nowDate = new Date()
  const weekStart = new Date(nowDate)
  weekStart.setDate(nowDate.getDate() - 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  const filteredAbsent = data.absentStudents.filter((r) => {
    // Weekly view (triggered by clicking the "Absent (This Week)" KPI card).
    if (weeklyOnly && r.date < weekStartStr) return false
    // Default view: current day only. Toggle "All dates" to browse history.
    if (!showAllDates && r.date !== dateFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.parentPhone.toLowerCase().includes(q) ||
      r.className.toLowerCase().includes(q) ||
      (r.section || '').toLowerCase().includes(q)
    )
  })

  // Remove absence records that belong to students who have since been deleted,
  // so they stop appearing in the table and in the weekly count.
  const handleClearStaleAbsences = async () => {
    const studentIds = new Set(studentsAll.map((s: any) => s.id))
    const stale = attendanceAll.filter(
      (a: any) => a.status === 'absent' && !studentIds.has(a.studentId)
    )
    if (stale.length === 0) {
      setNotice('Nothing to clear — all absences belong to existing students.')
      return
    }
    if (
      !window.confirm(
        `Delete ${stale.length} absence record(s) for students that no longer exist? This cannot be undone.`
      )
    ) {
      return
    }
    setNotice('')
    try {
      for (const r of stale) await rtdb.deleteAttendance(r.id)
      setNotice(`Cleared ${stale.length} stale absence record(s).`)
    } catch (e: any) {
      setNotice(e.message || 'Failed to clear stale absences.')
    }
  }

  // Copy every visible parent phone number as a comma-separated list so the
  // admin can paste them into a group SMS / WhatsApp broadcast.
  const handleCopyAllNumbers = async () => {
    const numbers = filteredAbsent
      .map((r) => r.parentPhone)
      .filter((p): p is string => !!p && p !== '—')
    if (numbers.length === 0) {
      setNotice('No parent phone numbers available to copy.')
      return
    }
    const text = numbers.join(', ')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers / non-secure contexts.
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setNotice(`Copied ${numbers.length} parent phone number(s) to clipboard.`)
    } catch {
      setNotice('Clipboard access was blocked by the browser. Please copy the numbers manually.')
    }
  }

  const dailyStatus = data.classDailyStatus[selectedClass] || []
  const selectedName = data.classes.find((c) => c.id === selectedClass)?.name || 'Class'

  // Clicking the "Absent (This Week)" KPI card jumps to the absent list filtered
  // down to the last 7 days.
  const handleShowWeeklyAbsent = () => {
    setWeeklyOnly(true)
    setShowAllDates(true)
    document.getElementById('absent-students')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Clicking the Students/Teachers/Classes cards reveals their list right here
  // on the dashboard and scrolls down to it (no page redirect).
  const showSection = (section: 'students' | 'teachers' | 'classes') => {
    setActiveSection(section)
    requestAnimationFrame(() => {
      document.getElementById(`dash-${section}`)?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  // KPI gender cards: apply the filter AND open the Student List below.
  const showStudents = (gender: 'all' | 'male' | 'female') => {
    setStudentGenderFilter(gender)
    setActiveSection('students')
    requestAnimationFrame(() => {
      document.getElementById('dash-students')?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const malePct = data.totalStudents ? Math.round((data.maleStudents / data.totalStudents) * 100) : 0
  const femalePct = data.totalStudents ? Math.round((data.femaleStudents / data.totalStudents) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of students, teachers and attendance</p>
        </div>
        <div className="inline-flex items-center gap-3 self-start md:self-auto rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm">
          <Calendar className="h-4 w-4 text-green-600" />
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}


      {/* KPI cards - click to show the matching list right below (no redirect) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <button type="button" className="block w-full text-left" onClick={() => showStudents('all')}>
          <div className="group relative rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0">
            <div className={`${activeSection === 'students' && studentGenderFilter === 'all' ? 'ring-4 ring-green-300' : ''} bg-gradient-to-br from-green-600 to-green-700 p-5`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Total Students</span>
                <div className="rounded-lg bg-white/20 p-2"><Users className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.totalStudents}</p>
            </div>
            {/* Hover: gender breakdown */}
            <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-2xl opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-xs font-medium text-gray-400">Total Students · Gender</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Boys
                  </span>
                  <span className="font-bold">{data.maleStudents}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> Girls
                  </span>
                  <span className="font-bold">{data.femaleStudents}</span>
                </div>
                <div className="my-1 border-t border-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Unspecified</span>
                  <span className="font-bold">{data.totalStudents - data.maleStudents - data.femaleStudents}</span>
                </div>
              </div>
            </div>
          </div>
        </button>
        <button type="button" className="block w-full text-left" onClick={() => showStudents('male')}>
          <div className={`rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0 ${studentGenderFilter === 'male' ? 'ring-4 ring-blue-300' : ''}`}>
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Male Students</span>
                <div className="rounded-lg bg-white/20 p-2"><User className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.maleStudents}</p>
              <p className="mt-1 text-xs font-medium text-white/70">{malePct}% of total students</p>
            </div>
          </div>
        </button>
        <button type="button" className="block w-full text-left" onClick={() => showStudents('female')}>
          <div className={`rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0 ${studentGenderFilter === 'female' ? 'ring-4 ring-pink-300' : ''}`}>
            <div className="bg-gradient-to-br from-pink-500 to-pink-700 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Female Students</span>
                <div className="rounded-lg bg-white/20 p-2"><User className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.femaleStudents}</p>
              <p className="mt-1 text-xs font-medium text-white/70">{femalePct}% of total students</p>
            </div>
          </div>
        </button>
        <button type="button" className="block w-full text-left" onClick={() => showSection('teachers')}>
          <div className={`rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0 ${activeSection === 'teachers' ? 'ring-4 ring-emerald-300' : ''}`}>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Total Teachers</span>
                <div className="rounded-lg bg-white/20 p-2"><GraduationCap className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.totalTeachers}</p>
            </div>
          </div>
        </button>
        <button type="button" className="block w-full text-left" onClick={() => showSection('classes')}>
          <div className={`rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0 ${activeSection === 'classes' ? 'ring-4 ring-amber-300' : ''}`}>
            <div className="bg-gradient-to-br from-amber-600 to-amber-800 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Classes</span>
                <div className="rounded-lg bg-white/20 p-2"><GraduationCap className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.totalClasses}</p>
            </div>
          </div>
        </button>
        <button type="button" className="block w-full text-left" onClick={handleShowWeeklyAbsent}>
          <div className={`rounded-xl shadow-md transition hover:shadow-xl cursor-pointer overflow-hidden ring-0 ${activeSection === 'absent' ? 'ring-4 ring-rose-300' : ''}`}>
            <div className="bg-gradient-to-br from-rose-600 to-red-800 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Absent (This Week)</span>
                <div className="rounded-lg bg-white/20 p-2"><UserX className="h-5 w-5 text-white" /></div>
              </div>
              <p className="mt-3 text-4xl font-extrabold text-white">{data.weeklyAbsentCount}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Inline list sections - shown by the KPI cards above (no redirect) */}
      {activeSection === 'students' && (
        <Card id="dash-students" className="border-0 shadow-md">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="inline-flex items-center justify-center rounded-lg bg-green-100 p-2">
                  <Users className="h-5 w-5 text-green-600" />
                </span>
                Student List
              </CardTitle>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {filteredStudents.length}{' '}
                {studentGenderFilter === 'all'
                  ? 'students'
                  : studentGenderFilter === 'male'
                  ? 'male students'
                  : 'female students'}
              </span>
            </div>
            <CardDescription>Click any student to see their full details.</CardDescription>
            <Input
              placeholder="Search by name, roll number or phone..."
              value={studentsSearch}
              onChange={(e) => setStudentsSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filteredStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No students found.</p>
            ) : (
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-3 font-medium">Photo</th>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Roll</th>
                    <th className="p-3 font-medium">Age</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium">Section</th>
                    <th className="p-3 font-medium">Parent Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s: any) => {
                    const cls = classesAll.find((c: any) => c.id === s.classId)
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setViewStudent(s)}
                        className="cursor-pointer hover:bg-green-50/60"
                      >
                        <td className="p-3">
                          <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                        </td>
                        <td className="p-3 font-medium text-gray-900">{s.name}</td>
                        <td className="p-3">{s.rollNumber || '—'}</td>
                        <td className="p-3">{s.age ?? '—'}</td>
                        <td className="p-3">{s.className || cls?.name || s.classId}</td>
                        <td className="p-3">{s.section || cls?.section || '—'}</td>
                        <td className="p-3">{s.parentPhone || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
{activeSection === 'teachers' && (
        <Card id="dash-teachers" className="border-0 shadow-md">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="inline-flex items-center justify-center rounded-lg bg-emerald-100 p-2">
                  <GraduationCap className="h-5 w-5 text-emerald-600" />
                </span>
                Teachers
              </CardTitle>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                {filteredTeachers.length} teachers
              </span>
            </div>
            <CardDescription>All teacher accounts.</CardDescription>
            <Input
              placeholder="Search by name, email or phone..."
              value={teachersSearch}
              onChange={(e) => setTeachersSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filteredTeachers.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No teachers found.</p>
            ) : (
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Phone</th>
                    <th className="p-3 font-medium">Assigned Classes</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((t: any) => (
                    <tr key={t.uid} className="hover:bg-emerald-50/60">
                      <td className="p-3 font-medium text-gray-900">{t.name}</td>
                      <td className="p-3">{t.email || '—'}</td>
                      <td className="p-3">{t.phone || '—'}</td>
                      <td className="p-3">
                        {classesAll.filter((c: any) => c.teacherId === t.uid).map((c: any) => c.name).join(', ') || '—'}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {t.status === 'active' ? 'active' : 'inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'classes' && (
        <Card id="dash-classes" className="border-0 shadow-md">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="inline-flex items-center justify-center rounded-lg bg-amber-100 p-2">
                  <GraduationCap className="h-5 w-5 text-amber-600" />
                </span>
                Classes
              </CardTitle>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                {filteredClasses.length} classes
              </span>
            </div>
            <CardDescription>All classes and their assigned teachers.</CardDescription>
            <Input
              placeholder="Search class or teacher..."
              value={classesSearch}
              onChange={(e) => setClassesSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filteredClasses.length === 0 ? (
              <p className="text-gray-500 text-center py-10">No classes found.</p>
            ) : (
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium">Grade</th>
                    <th className="p-3 font-medium">Section</th>
                    <th className="p-3 font-medium">Teacher</th>
                    <th className="p-3 font-medium">Students</th>
                    <th className="p-3 font-medium">Academic Year</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((c: any) => {
                    const teacher = usersAll.find((u: any) => u.uid === c.teacherId)
                    const count = studentsAll.filter((s: any) => s.classId === c.id).length
                    return (
                      <tr key={c.id} className="hover:bg-amber-50/60">
                        <td className="p-3 font-medium text-gray-900">
                          {c.name}
                          {c.isActive === false ? ' (inactive)' : ''}
                        </td>
                        <td className="p-3">{c.grade || '—'}</td>
                        <td className="p-3">{c.section || '—'}</td>
                        <td className="p-3">{c.teacherName || teacher?.name || '—'}</td>
                        <td className="p-3">{count}</td>
                        <td className="p-3">{c.academicYear || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
<Card id="absent-students" className="border-0 shadow-md bg-gradient-to-br from-rose-50 to-rose-100/70">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="inline-flex items-center justify-center rounded-lg bg-red-100 p-2"><UserX className="h-5 w-5 text-red-600" /></span>
              Absent Students
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-600">{filteredAbsent.length}</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <input
                  type="checkbox"
                  checked={showAllDates}
                  onChange={(e) => setShowAllDates(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
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
              {weeklyOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWeeklyOnly(false)}
                  className="whitespace-nowrap text-rose-600"
                >
                  This week • Show all history
                </Button>
              )}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search student, parent, phone, class or section..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAllNumbers}
                className="whitespace-nowrap"
                title="Copy all parent phone numbers to the clipboard"
              >
                <Copy className="h-4 w-4 mr-2" /> Copy All Absent Numbers
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearStaleAbsences}
                className="whitespace-nowrap"
                title="Remove absences of students that were deleted"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Clear
              </Button>
            </div>
          </div>
          <CardDescription>
            {showAllDates
              ? 'Absent students collected from saved attendance across all classes, with parent contact details.'
              : `Absent students for ${dateFilter}, with parent contact details. Pick a date or tick "All dates" to see previous absences.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notice && (
            <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {notice}
            </p>
          )}
          {filteredAbsent.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              {search
                ? 'No absent students match your search.'
                : showAllDates
                ? 'No absent students recorded yet.'
                : `No absent students recorded for ${dateFilter}.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border-2 border-gray-400 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium"><Calendar className="h-3.5 w-3.5 inline mr-1" />Date</th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Section</th>
                    <th className="pb-3 pr-4 font-medium">Parent Phone</th>
                    <th className="pb-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsent.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">{r.date}</td>
                      <td className="py-3 pr-4 font-medium text-gray-900">{r.studentName}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{r.className}</span>
                      </td>
                      <td className="py-3 pr-4">{r.section || '—'}</td>
                      <td className="py-3">
                        {r.parentPhone !== '—' ? (
                          <a
                            href={`tel:${r.parentPhone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 font-medium text-green-700 transition hover:bg-green-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> {r.parentPhone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {r.alternativePhone && (
                          <a
                            href={`tel:${r.alternativePhone}`}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 font-medium text-teal-700 transition hover:bg-teal-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> Alt: {r.alternativePhone}
                          </a>
                        )}
                      </td>
                      <td className="py-3">
                        {r.parentPhone !== '—' ? (
                          <a
                            href={`sms:${r.parentPhone}?body=${encodeURIComponent(
                              generateSmsMessage(r.studentName, r.gender, r.parentLanguage)
                            )}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 font-medium text-green-700 transition hover:bg-green-100"
                            title="Open the SMS app with the absence message pre-filled"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Send SMS
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

<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar chart: Male / Female per class */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100/70">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">Students by Class</CardTitle>
            <CardDescription>Male vs Female students per class</CardDescription>
          </CardHeader>
          <CardContent>
            {data.classGender.length === 0 ? (
              <p className="text-gray-500 text-center py-16">No student data available yet.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classGender} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barGap={1}>
                    <defs>
                      <linearGradient id="maleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                      <linearGradient id="femaleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#be123c" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      height={112}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tick={({ x, y, payload }: any) => {
                        const entry = data.classGender.find((d) => d.name === payload.value)
                        const t = entry?.teacherName || ''
                        const teacherLabel = t
                          ? t.toLowerCase().startsWith('ustaz')
                            ? t
                            : `Ustaz ${t}`
                          : ''
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={12}
                              transform={`rotate(-45 0 12)`}
                              textAnchor="middle"
                              fill="#6b7280"
                              fontSize={11}
                              fontWeight={500}
                            >
                              {payload.value}
                            </text>
                            {teacherLabel && (
                              <text
                                x={0}
                                y={44}
                                transform={`rotate(-45 0 44)`}
                                textAnchor="middle"
                                fill="#7c3aed"
                                fontSize={10}
                                fontWeight={600}
                              >
                                {teacherLabel}
                              </text>
                            )}
                          </g>
                        )
                      }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(100, 116, 139, 0.08)' }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || payload.length === 0) return null
                        const male = payload.find((p: any) => p.dataKey === 'male')?.value ?? 0
                        const female = payload.find((p: any) => p.dataKey === 'female')?.value ?? 0
                        return (
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="mb-1 font-semibold text-gray-900">{label}</p>
                            <p className="text-blue-600">Male: {male}</p>
                            <p className="text-rose-600">Female: {female}</p>
                            <p className="mt-1 border-t border-gray-100 pt-1 font-medium text-gray-700">Total: {male + female}</p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 8 }} />
                    <Bar dataKey="male" name="Male" fill="url(#maleGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="female" name="Female" fill="url(#femaleGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
<Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/70">
          <CardHeader className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Student Status</CardTitle>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.section ? ` • ${c.section}` : ''}</option>
                ))}
              </select>
            </div>
            <CardDescription>Daily attendance status for {selectedName} · last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyStatus.length === 0 ? (
              <p className="text-gray-500 text-center py-16">No attendance recorded for this class yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStatus} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => (d ? d.slice(5) : '')}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(100, 116, 139, 0.08)' }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || payload.length === 0) return null
                        const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0
                        const present = get('present')
                        const absent = get('absent')
                        const late = get('late')
                        const excused = get('excused')
                        return (
                          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="mb-1 font-semibold text-gray-900">{label}</p>
                            <p className="text-green-600">Present: {present}</p>
                            <p className="text-red-600">Absent: {absent}</p>
                            <p className="text-amber-600">Late: {late}</p>
                            <p className="text-amber-600">Excused: {excused}</p>
                            <p className="mt-1 border-t border-gray-100 pt-1 font-medium text-gray-700">
                              Total: {present + absent + late + excused}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 8 }} />
                    <Bar dataKey="present" name="Present" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="late" name="Late" fill="#eab308" radius={[6, 6, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="excused" name="Excused" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {viewStudent && (
        <StudentDetailCard
          student={viewStudent}
          classes={classesAll}
          users={usersAll}
          onClose={() => setViewStudent(null)}
        />
      )}
    </div>
  )
}
