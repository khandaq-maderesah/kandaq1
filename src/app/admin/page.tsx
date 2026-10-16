'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Calendar,
  Copy,
  GraduationCap,
  Loader2,
  MessageSquare,
  Phone,
  School,
  Search,
  Trash2,
  User,
  UserX,
  Users,
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
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { cn, daysAgoISO, ATTENDANCE_RECENT_DAYS } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard, TableContainer } from '@/components/ui/page'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { generateSmsMessage } from '@/lib/smsMessage'
import { useAuth } from '@/context/AuthContext'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import { LOCALE_DIR } from '@/i18n/config'

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
  todayAbsentCount: number
  classGender: { name: string; male: number; female: number; teacherName?: string }[]
  classes: { id: string; name: string; section?: string }[]
  classDailyStatus: Record<string, { date: string; present: number; absent: number; late: number; excused: number }[]>
  absentStudents: AbsentStudent[]
}

type AbsentRange = 'today' | 'this-week' | 'last-week' | 'last-2-weeks' | 'last-3-weeks' | 'this-month'

const PERIOD_KEYS: Record<AbsentRange, 'today' | 'thisWeek' | 'lastWeek' | 'last2Weeks' | 'last3Weeks' | 'thisMonth'> = {
  today: 'today',
  'this-week': 'thisWeek',
  'last-week': 'lastWeek',
  'last-2-weeks': 'last2Weeks',
  'last-3-weeks': 'last3Weeks',
  'this-month': 'thisMonth',
}

/** Archived (deleted) students have isActive === false and are left out of every active count/list. */
const isActiveStudent = (s: any) => s?.isActive !== false

const CHART = {
  male: 'hsl(var(--primary))',
  female: 'hsl(var(--info))',
  present: 'hsl(var(--success))',
  absent: 'hsl(var(--destructive))',
  late: 'hsl(var(--warning))',
  excused: 'hsl(var(--muted-foreground))',
  axis: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
  teacher: 'hsl(var(--primary))',
}

export default function AdminPage() {
  const t = useTranslations('adminDashboard')
  const tc = useTranslations('common')
  const format = useFormatter()
  const locale = useLocale()
  const isRtl = LOCALE_DIR[locale] === 'rtl'
  const eth = useEthiopianDate()
  const { school } = useAuth()

  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10))
  const [showAllDates, setShowAllDates] = useState(false)
  // Period filter for the absent list.
  const [absentRange, setAbsentRange] = useState<AbsentRange>('today')
  // Which list is currently shown under the KPI cards (inline, no redirect).
  const [activeSection, setActiveSection] = useState<'students' | 'teachers' | 'classes' | 'absent'>('absent')
  const [viewStudent, setViewStudent] = useState<any | null>(null)
  const [studentsSearch, setStudentsSearch] = useState('')
  // Which gender the inline student list shows — driven by the KPI cards.
  const [studentGenderFilter, setStudentGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [teachersSearch, setTeachersSearch] = useState('')
  const [classesSearch, setClassesSearch] = useState('')
  const [staleToClear, setStaleToClear] = useState<any[] | null>(null)
  const [clearing, setClearing] = useState(false)

  // Shared realtime store: `students`, `classes` and `users` are read from the
  // same channels as the shell bells, so each node is downloaded ONCE per screen.
  // Attendance defaults to the shared recent window; "All dates" opens a second
  // full-history channel on demand.
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

  const unassignedLabel = t('charts.unassigned')

  const data = useMemo<DashboardData>(() => {
    const students = studentsAll
    const classes = classesAll
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

    // Student lookup; archived students' attendance is left out of the dashboard.
    const studentById: Record<string, any> = {}
    students.forEach((s: any) => {
      studentById[s.id] = s
    })
    const attendance = attendanceAll.filter((a: any) => isActiveStudent(studentById[a.studentId]))

    const activeStudents = students.filter(isActiveStudent)
    const totalTeachers = users.filter((u: any) => u.role === 'teacher').length
    const maleStudents = activeStudents.filter((s: any) => s.gender === 'male').length
    const femaleStudents = activeStudents.filter((s: any) => s.gender === 'female').length

    // Male / Female per class + section (e.g. "Grade 1 A", "Grade 1 B")
    const genderMap: Record<string, { male: number; female: number; name: string; teacherName: string }> = {}
    activeStudents.forEach((s: any) => {
      const cid = s.classId || 'none'
      const baseName = s.className || classInfo[cid]?.name || unassignedLabel
      const section = s.section || classInfo[cid]?.section || ''
      const key = `${cid}::${section}`
      const name = section ? `${baseName} ${section}` : baseName
      if (!genderMap[key]) {
        genderMap[key] = { male: 0, female: 0, name, teacherName: classInfo[cid]?.teacherName || '' }
      }
      if (s.gender === 'male') genderMap[key].male++
      else if (s.gender === 'female') genderMap[key].female++
    })
    const classGender = Object.values(genderMap)

    // Daily attendance status per class (last 7 recorded days).
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
    const classDailyStatus: DashboardData['classDailyStatus'] = {}
    Object.keys(classDayMap).forEach((cid) => {
      classDailyStatus[cid] = Object.keys(classDayMap[cid])
        .filter(Boolean)
        .sort()
        .slice(-7)
        .map((date) => ({ date, ...classDayMap[cid][date] }))
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

    const classList = classes.map((c: any) => ({ id: c.id, name: c.name, section: c.section }))

    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const todayStr = today.toISOString().slice(0, 10)
    const weeklyAbsentCount = attendance.filter((a: any) => a.status === 'absent' && a.date >= weekStartStr).length
    const todayAbsentCount = attendance.filter((a: any) => a.status === 'absent' && a.date === todayStr).length

    return {
      totalStudents: activeStudents.length,
      maleStudents,
      femaleStudents,
      totalTeachers,
      totalClasses: classes.length,
      absentCount: absentStudents.length,
      weeklyAbsentCount,
      todayAbsentCount,
      classGender,
      classes: classList,
      classDailyStatus,
      absentStudents,
    }
  }, [studentsAll, classesAll, attendanceAll, usersAll, unassignedLabel])

  // Select the first class by default (once class data arrives)
  useEffect(() => {
    if (!selectedClass && data.classes.length > 0) {
      setSelectedClass(data.classes[0].id)
    }
  }, [data.classes, selectedClass])

  const classById = useMemo(() => {
    const map: Record<string, any> = {}
    classesAll.forEach((c: any) => {
      map[c.id] = c
    })
    return map
  }, [classesAll])

  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase()
    return studentsAll
      .filter(isActiveStudent)
      .filter((s: any) => studentGenderFilter === 'all' || s.gender === studentGenderFilter)
      .filter((s: any) => {
        if (!q) return true
        const cls = classById[s.classId]
        return (
          (s.name || '').toLowerCase().includes(q) ||
          (s.rollNumber || '').toLowerCase().includes(q) ||
          (s.parentPhone || '').toLowerCase().includes(q) ||
          (cls?.name || '').toLowerCase().includes(q)
        )
      })
      .sort((a: any, b: any) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
  }, [studentsAll, classById, studentsSearch, studentGenderFilter])

  const filteredTeachers = useMemo(() => {
    const q = teachersSearch.trim().toLowerCase()
    return usersAll
      .filter((u: any) => u.role === 'teacher')
      .filter((u: any) => {
        if (!q) return true
        return (
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
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
          (c.name || '').toLowerCase().includes(q) ||
          (c.section || '').toLowerCase().includes(q) ||
          (c.teacherName || '').toLowerCase().includes(q)
        )
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
  }, [classesAll, classesSearch])

  // Gregorian date (locale-aware) for a YYYY-MM-DD string.
  const gDate = (d: string, style: 'medium' | 'short' = 'medium') => {
    const date = new Date(d)
    if (!d || Number.isNaN(date.getTime())) return d || '—'
    return style === 'short'
      ? format.dateTime(date, { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : format.dateTime(date, { dateStyle: 'medium', timeZone: 'UTC' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  // Inclusive ISO date bounds for the period dropdown.
  const absentRangeBounds = (range: AbsentRange): [string, string] => {
    const base = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const daysAgo = (n: number) => {
      const d = new Date(base)
      d.setDate(base.getDate() - n)
      return iso(d)
    }
    if (range === 'this-week') return [daysAgo(6), iso(base)]
    if (range === 'last-week') return [daysAgo(13), daysAgo(7)]
    if (range === 'last-2-weeks') return [daysAgo(13), iso(base)]
    if (range === 'last-3-weeks') return [daysAgo(20), iso(base)]
    if (range === 'this-month')
      return [iso(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))), iso(base)]
    return ['', ''] // 'today' follows the date picker
  }

  const filteredAbsent = data.absentStudents.filter((r) => {
    if (!showAllDates) {
      if (absentRange === 'today') {
        if (r.date !== dateFilter) return false
      } else {
        const [from, to] = absentRangeBounds(absentRange)
        if (r.date < from || r.date > to) return false
      }
    }
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      (r.studentName || '').toLowerCase().includes(q) ||
      r.parentPhone.toLowerCase().includes(q) ||
      r.className.toLowerCase().includes(q) ||
      (r.section || '').toLowerCase().includes(q)
    )
  })

  // Absence records that belong to students who have since been deleted entirely.
  const handleClearStaleAbsences = () => {
    const studentIds = new Set(studentsAll.map((s: any) => s.id))
    const stale = attendanceAll.filter((a: any) => a.status === 'absent' && !studentIds.has(a.studentId))
    if (stale.length === 0) {
      toast.info(t('absent.toast.nothingStale'))
      return
    }
    setStaleToClear(stale)
  }

  const confirmClearStale = async () => {
    if (!staleToClear) return
    setClearing(true)
    try {
      for (const r of staleToClear) await rtdb.deleteAttendance(r.id)
      toast.success(t('absent.toast.cleared', { count: staleToClear.length }))
      setStaleToClear(null)
    } catch {
      toast.error(t('absent.toast.clearFailed'))
    } finally {
      setClearing(false)
    }
  }

  // Copy every visible parent phone number as a comma-separated list so the
  // admin can paste them into a group SMS / WhatsApp broadcast.
  const handleCopyAllNumbers = async () => {
    const numbers = filteredAbsent.map((r) => r.parentPhone).filter((p): p is string => !!p && p !== '—')
    if (numbers.length === 0) {
      toast.info(t('absent.toast.noNumbers'))
      return
    }
    const text = numbers.join(', ')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success(t('absent.toast.copied', { count: numbers.length }))
    } catch {
      toast.error(t('absent.toast.copyBlocked'))
    }
  }

  const dailyStatus = data.classDailyStatus[selectedClass] || []
  const selectedClassInfo = data.classes.find((c) => c.id === selectedClass)
  const selectedName = selectedClassInfo
    ? selectedClassInfo.section
      ? `${selectedClassInfo.name} ${selectedClassInfo.section}`
      : selectedClassInfo.name
    : ''

  const scrollTo = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))

  const handleShowTodayAbsent = () => {
    setAbsentRange('today')
    setDateFilter(new Date().toISOString().slice(0, 10))
    setShowAllDates(false)
    setActiveSection('absent')
    scrollTo('absent-students')
  }

  const showSection = (section: 'teachers' | 'classes') => {
    setActiveSection(section)
    scrollTo(`dash-${section}`)
  }

  const showStudents = (gender: 'all' | 'male' | 'female') => {
    setStudentGenderFilter(gender)
    setActiveSection('students')
    scrollTo('dash-students')
  }

  const pct = (n: number) => (data.totalStudents ? Math.round((n / data.totalStudents) * 100) : 0)
  const selectedRing = 'border-primary ring-1 ring-primary/30'
  const todayIso = new Date().toISOString().slice(0, 10)
  const ethToday = eth.format(todayIso)

  const teacherLabel = (name?: string) => {
    if (!name) return ''
    return name.toLowerCase().startsWith('ustaz') ? name : t('charts.teacherLabel', { name })
  }

  const absentDescription = showAllDates
    ? t('absent.descriptionAll')
    : absentRange !== 'today'
    ? t('absent.descriptionPeriod')
    : t('absent.descriptionDay', { date: gDate(dateFilter) })

  const absentEmpty = search
    ? t('absent.emptySearch')
    : showAllDates
    ? t('absent.emptyAll')
    : absentRange !== 'today'
    ? t('absent.emptyPeriod')
    : t('absent.emptyDay', { date: gDate(dateFilter) })

  const smsHref = (r: AbsentStudent) =>
    `sms:${r.parentPhone}?body=${encodeURIComponent(
      generateSmsMessage(r.studentName, r.gender, r.parentLanguage, school)
    )}`

  const studentListTitle =
    studentGenderFilter === 'male'
      ? t('students.titleMale')
      : studentGenderFilter === 'female'
      ? t('students.titleFemale')
      : t('students.title')

  const tooltipBox = 'rounded-lg border bg-card px-3 py-2 text-xs text-card-foreground shadow-md'
  const axisTick = { fontSize: 11, fill: CHART.axis }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
            <span>
              {ethToday
                ? t('todayDate', {
                    gregorian: format.dateTime(new Date(), { dateStyle: 'full' }),
                    ethiopian: ethToday,
                  })
                : format.dateTime(new Date(), { dateStyle: 'full' })}
            </span>
          </div>
        }
      />

      {/* KPI row — selecting a card shows its list below (no redirect). */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t('kpi.totalStudents')}
          value={format.number(data.totalStudents)}
          hint={t('kpi.totalHint', { male: data.maleStudents, female: data.femaleStudents })}
          icon={Users}
          onClick={() => showStudents('all')}
          className={cn(activeSection === 'students' && studentGenderFilter === 'all' && selectedRing)}
        />
        <StatCard
          label={t('kpi.maleStudents')}
          value={format.number(data.maleStudents)}
          hint={t('kpi.percentOfTotal', { percent: pct(data.maleStudents) })}
          icon={User}
          tone="info"
          onClick={() => showStudents('male')}
          className={cn(activeSection === 'students' && studentGenderFilter === 'male' && selectedRing)}
        />
        <StatCard
          label={t('kpi.femaleStudents')}
          value={format.number(data.femaleStudents)}
          hint={t('kpi.percentOfTotal', { percent: pct(data.femaleStudents) })}
          icon={User}
          tone="info"
          onClick={() => showStudents('female')}
          className={cn(activeSection === 'students' && studentGenderFilter === 'female' && selectedRing)}
        />
        <StatCard
          label={t('kpi.teachers')}
          value={format.number(data.totalTeachers)}
          icon={GraduationCap}
          tone="success"
          onClick={() => showSection('teachers')}
          className={cn(activeSection === 'teachers' && selectedRing)}
        />
        <StatCard
          label={t('kpi.classes')}
          value={format.number(data.totalClasses)}
          icon={School}
          tone="warning"
          onClick={() => showSection('classes')}
          className={cn(activeSection === 'classes' && selectedRing)}
        />
        <StatCard
          label={t('kpi.absentToday')}
          value={format.number(data.todayAbsentCount)}
          hint={t('kpi.absentWeekHint', { count: data.weeklyAbsentCount })}
          icon={UserX}
          tone="destructive"
          onClick={handleShowTodayAbsent}
          className={cn(activeSection === 'absent' && selectedRing)}
        />
      </div>

      {/* Inline lists shown by the KPI cards */}
      {activeSection === 'students' && (
        <section id="dash-students" className="space-y-4 scroll-mt-20">
          <SectionHeader
            title={studentListTitle}
            count={filteredStudents.length}
            description={t('students.description')}
          >
            <SearchField
              id="dash-students-search"
              label={t('students.searchLabel')}
              placeholder={t('students.searchPlaceholder')}
              value={studentsSearch}
              onChange={setStudentsSearch}
            />
          </SectionHeader>
          {filteredStudents.length === 0 ? (
            <EmptyState icon={Users} title={t('students.empty')} />
          ) : (
            <TableContainer>
              <thead>
                <tr>
                  <th>{t('students.table.photo')}</th>
                  <th>{t('students.table.name')}</th>
                  <th>{t('students.table.roll')}</th>
                  <th>{t('students.table.age')}</th>
                  <th>{t('students.table.class')}</th>
                  <th>{t('students.table.section')}</th>
                  <th>{t('students.table.parentPhone')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s: any) => {
                  const cls = classById[s.classId]
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setViewStudent(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setViewStudent(s)
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <td>
                        <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                      </td>
                      <td className="font-medium text-foreground">{s.name}</td>
                      <td className="tabular-nums">{s.rollNumber || '—'}</td>
                      <td className="tabular-nums">{s.age ?? '—'}</td>
                      <td>{s.className || cls?.name || s.classId}</td>
                      <td>{s.section || cls?.section || '—'}</td>
                      <td className="whitespace-nowrap tabular-nums" dir="ltr">
                        {s.parentPhone || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </TableContainer>
          )}
        </section>
      )}

      {activeSection === 'teachers' && (
        <section id="dash-teachers" className="space-y-4 scroll-mt-20">
          <SectionHeader
            title={t('teachers.title')}
            count={filteredTeachers.length}
            description={t('teachers.description')}
          >
            <SearchField
              id="dash-teachers-search"
              label={t('teachers.searchLabel')}
              placeholder={t('teachers.searchPlaceholder')}
              value={teachersSearch}
              onChange={setTeachersSearch}
            />
          </SectionHeader>
          {filteredTeachers.length === 0 ? (
            <EmptyState icon={GraduationCap} title={t('teachers.empty')} />
          ) : (
            <TableContainer>
              <thead>
                <tr>
                  <th>{t('teachers.table.name')}</th>
                  <th>{t('teachers.table.email')}</th>
                  <th>{t('teachers.table.phone')}</th>
                  <th>{t('teachers.table.classes')}</th>
                  <th>{t('teachers.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((u: any) => (
                  <tr key={u.uid}>
                    <td className="font-medium text-foreground">{u.name}</td>
                    <td>{u.email || '—'}</td>
                    <td className="whitespace-nowrap tabular-nums" dir="ltr">
                      {u.phone || '—'}
                    </td>
                    <td>
                      {classesAll
                        .filter((c: any) => c.teacherId === u.uid)
                        .map((c: any) => c.name)
                        .join(', ') || '—'}
                    </td>
                    <td>
                      <Badge variant={u.status === 'active' ? 'success' : 'secondary'}>
                        {u.status === 'active' ? tc('status.active') : tc('status.inactive')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableContainer>
          )}
        </section>
      )}

      {activeSection === 'classes' && (
        <section id="dash-classes" className="space-y-4 scroll-mt-20">
          <SectionHeader
            title={t('classes.title')}
            count={filteredClasses.length}
            description={t('classes.description')}
          >
            <SearchField
              id="dash-classes-search"
              label={t('classes.searchLabel')}
              placeholder={t('classes.searchPlaceholder')}
              value={classesSearch}
              onChange={setClassesSearch}
            />
          </SectionHeader>
          {filteredClasses.length === 0 ? (
            <EmptyState icon={School} title={t('classes.empty')} />
          ) : (
            <TableContainer>
              <thead>
                <tr>
                  <th>{t('classes.table.class')}</th>
                  <th>{t('classes.table.grade')}</th>
                  <th>{t('classes.table.section')}</th>
                  <th>{t('classes.table.teacher')}</th>
                  <th>{t('classes.table.students')}</th>
                  <th>{t('classes.table.academicYear')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c: any) => {
                  const teacher = usersAll.find((u: any) => u.uid === c.teacherId)
                  const count = studentsAll.filter((s: any) => s.classId === c.id && isActiveStudent(s)).length
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-foreground">{c.name}</td>
                      <td>{c.grade || '—'}</td>
                      <td>{c.section || '—'}</td>
                      <td>{c.teacherName || teacher?.name || '—'}</td>
                      <td className="tabular-nums">{format.number(count)}</td>
                      <td>{c.academicYear || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </TableContainer>
          )}
        </section>
      )}

      {/* Absent students */}
      <section id="absent-students" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {t('absent.title')}
            <Badge variant="destructive">{format.number(filteredAbsent.length)}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">{absentDescription}</p>
        </div>

        {/* Toolbar */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_auto_minmax(0,1fr)] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="absent-period">{t('absent.period')}</Label>
              <Select
                id="absent-period"
                value={absentRange}
                onChange={(e) => {
                  setAbsentRange(e.target.value as AbsentRange)
                  setShowAllDates(false)
                }}
              >
                {(Object.keys(PERIOD_KEYS) as AbsentRange[]).map((key) => (
                  <option key={key} value={key}>
                    {t(`absent.periods.${PERIOD_KEYS[key]}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="absent-date">{t('absent.date')}</Label>
              <Input
                id="absent-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                disabled={showAllDates || absentRange !== 'today'}
              />
            </div>
            <label
              htmlFor="absent-all-dates"
              className="flex h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground"
            >
              <input
                id="absent-all-dates"
                type="checkbox"
                checked={showAllDates}
                onChange={(e) => setShowAllDates(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              />
              {t('absent.allDates')}
            </label>
            <SearchField
              id="absent-search"
              label={t('absent.searchLabel')}
              placeholder={t('absent.searchPlaceholder')}
              value={search}
              onChange={setSearch}
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            {showAllDates && <p className="text-xs text-muted-foreground">{t('absent.allDatesOverrides')}</p>}
            <div className="ms-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAllNumbers}
                title={t('absent.copyNumbersHint')}
              >
                <Copy className="h-4 w-4" /> {t('absent.copyNumbers')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearStaleAbsences}
                title={t('absent.clearStaleHint')}
              >
                <Trash2 className="h-4 w-4" /> {t('absent.clearStale')}
              </Button>
            </div>
          </div>
        </div>

        {filteredAbsent.length === 0 ? (
          <EmptyState icon={UserX} title={absentEmpty} />
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="space-y-3 md:hidden">
              {filteredAbsent.map((r) => (
                <li key={r.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{r.studentName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.section ? `${r.className} · ${r.section}` : r.className}
                      </p>
                    </div>
                    <div className="shrink-0 text-end text-xs">
                      <p className="font-medium text-foreground">{gDate(r.date)}</p>
                      {eth.format(r.date) && <p className="text-muted-foreground">{eth.format(r.date)}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PhoneLinks r={r} callLabel={(phone) => t('absent.call', { phone })} altLabel={(phone) => t('absent.altPhone', { phone })} />
                    {r.parentPhone !== '—' && (
                      <a
                        href={smsHref(r)}
                        title={t('absent.sendSmsHint')}
                        className={cn(buttonVariants({ size: 'sm', variant: 'success' }), 'ms-auto')}
                      >
                        <MessageSquare /> {t('absent.sendSms')}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <TableContainer className="hidden md:block">
              <thead>
                <tr>
                  <th>{t('absent.table.date')}</th>
                  <th>{t('absent.table.student')}</th>
                  <th>{t('absent.table.class')}</th>
                  <th>{t('absent.table.section')}</th>
                  <th>{t('absent.table.parentPhone')}</th>
                  <th>{t('absent.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAbsent.map((r) => {
                  const ethDate = eth.format(r.date)
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <span className="block text-foreground">{gDate(r.date)}</span>
                        {ethDate && <span className="block text-xs text-muted-foreground">{ethDate}</span>}
                      </td>
                      <td className="font-medium text-foreground">{r.studentName}</td>
                      <td>
                        <Badge variant="outline">{r.className}</Badge>
                      </td>
                      <td>{r.section || '—'}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <PhoneLinks r={r} callLabel={(phone) => t('absent.call', { phone })} altLabel={(phone) => t('absent.altPhone', { phone })} />
                        </div>
                      </td>
                      <td>
                        {r.parentPhone !== '—' ? (
                          <a
                            href={smsHref(r)}
                            title={t('absent.sendSmsHint')}
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                          >
                            <MessageSquare /> {t('absent.sendSms')}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </TableContainer>
          </>
        )}
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('charts.byClassTitle')}</CardTitle>
            <CardDescription>{t('charts.byClassDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.classGender.length === 0 ? (
              <EmptyState icon={Users} title={t('charts.noStudents')} className="border-0" />
            ) : (
              <div className="h-80 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classGender} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      height={112}
                      reversed={isRtl}
                      tickLine={false}
                      axisLine={{ stroke: CHART.grid }}
                      tick={({ x, y, payload }: any) => {
                        const entry = data.classGender.find((d) => d.name === payload.value)
                        const label = teacherLabel(entry?.teacherName)
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={12} transform="rotate(-45 0 12)" textAnchor="middle" fill={CHART.axis} fontSize={11} fontWeight={500}>
                              {payload.value}
                            </text>
                            {label && (
                              <text x={0} y={44} transform="rotate(-45 0 44)" textAnchor="middle" fill={CHART.teacher} fontSize={10} fontWeight={600}>
                                {label}
                              </text>
                            )}
                          </g>
                        )
                      }}
                    />
                    <YAxis allowDecimals={false} orientation={isRtl ? 'right' : 'left'} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || payload.length === 0) return null
                        const male = payload.find((p: any) => p.dataKey === 'male')?.value ?? 0
                        const female = payload.find((p: any) => p.dataKey === 'female')?.value ?? 0
                        return (
                          <div className={tooltipBox} dir={isRtl ? 'rtl' : 'ltr'}>
                            <p className="mb-1 font-semibold">{label}</p>
                            <TooltipRow color={CHART.male} label={t('charts.male')} value={male} />
                            <TooltipRow color={CHART.female} label={t('charts.female')} value={female} />
                            <p className="mt-1 border-t pt-1 font-medium">{t('charts.total', { count: male + female })}</p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="male" name={t('charts.male')} fill={CHART.male} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="female" name={t('charts.female')} fill={CHART.female} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">{t('charts.statusTitle')}</CardTitle>
                <CardDescription className="mt-1">
                  {t('charts.statusDescription', { className: selectedName || '—' })}
                </CardDescription>
              </div>
              <div className="sm:w-48">
                <Label htmlFor="status-class" className="sr-only">
                  {t('charts.classLabel')}
                </Label>
                <Select id="status-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.section ? `${c.name} • ${c.section}` : c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dailyStatus.length === 0 ? (
              <EmptyState icon={Calendar} title={t('charts.noAttendance')} className="border-0" />
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStatus} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                    <XAxis
                      dataKey="date"
                      reversed={isRtl}
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => (d ? gDate(d, 'short') : '')}
                    />
                    <YAxis allowDecimals={false} orientation={isRtl ? 'right' : 'left'} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload || payload.length === 0) return null
                        const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0
                        const present = get('present')
                        const absent = get('absent')
                        const late = get('late')
                        const excused = get('excused')
                        const ethLabel = eth.format(label)
                        return (
                          <div className={tooltipBox} dir={isRtl ? 'rtl' : 'ltr'}>
                            <p className="font-semibold">{gDate(label)}</p>
                            {ethLabel && <p className="mb-1 text-muted-foreground">{ethLabel}</p>}
                            <TooltipRow color={CHART.present} label={t('charts.present')} value={present} />
                            <TooltipRow color={CHART.absent} label={t('charts.absent')} value={absent} />
                            <TooltipRow color={CHART.late} label={t('charts.late')} value={late} />
                            <TooltipRow color={CHART.excused} label={t('charts.excused')} value={excused} />
                            <p className="mt-1 border-t pt-1 font-medium">
                              {t('charts.total', { count: present + absent + late + excused })}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="present" name={t('charts.present')} fill={CHART.present} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="absent" name={t('charts.absent')} fill={CHART.absent} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="late" name={t('charts.late')} fill={CHART.late} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="excused" name={t('charts.excused')} fill={CHART.excused} radius={[4, 4, 0, 0]} maxBarSize={16} />
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

      <Dialog open={!!staleToClear} onOpenChange={(open) => !open && !clearing && setStaleToClear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('absent.confirm.title')}</DialogTitle>
            <DialogDescription>
              {t('absent.confirm.description', { count: staleToClear?.length ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaleToClear(null)} disabled={clearing}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmClearStale} disabled={clearing}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('absent.confirm.action')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionHeader({
  title,
  count,
  description,
  children,
}: {
  title: string
  count: number
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {title}
          <Badge variant="secondary">{count}</Badge>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children && <div className="w-full sm:w-72">{children}</div>}
    </div>
  )
}

function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ps-9"
        />
      </div>
    </div>
  )
}

function PhoneLinks({
  r,
  callLabel,
  altLabel,
}: {
  r: AbsentStudent
  callLabel: (phone: string) => string
  altLabel: (phone: string) => string
}) {
  const linkClass =
    'inline-flex min-h-8 items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
  return (
    <>
      {r.parentPhone !== '—' ? (
        <a href={`tel:${r.parentPhone}`} className={linkClass} aria-label={callLabel(r.parentPhone)}>
          <Phone className="h-3.5 w-3.5" />
          <span dir="ltr" className="tabular-nums">
            {r.parentPhone}
          </span>
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {r.alternativePhone && (
        <a href={`tel:${r.alternativePhone}`} className={linkClass} aria-label={callLabel(r.alternativePhone)}>
          <Phone className="h-3.5 w-3.5" />
          <span>{altLabel(r.alternativePhone)}</span>
        </a>
      )}
    </>
  )
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center gap-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto font-medium tabular-nums">{value}</span>
    </p>
  )
}
