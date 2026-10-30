'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { ChevronRight, ClipboardList, GraduationCap, MessageSquare, Phone, Search, UserCheck, UserPlus, Users, UserX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { generateGroupSmsMessage, generateSmsMessage } from '@/lib/smsMessage'
import { detectSmsPlatform, dominantLanguage, groupSmsHref, smsHref } from '@/lib/smsLink'
import { useMyRequests } from '@/hooks/useRequestBadges'
import { useMyAttendance, useMyClasses, useStudentsOfClasses, useTeacherCheckIns } from '@/hooks/useTeacherData'
import { OfflineNotice } from '@/components/OfflineNotice'
import { CheckInCard } from '@/components/teacher/CheckInCard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { badgeVariants } from '@/components/ui/badge'
import { EmptyState, PageHeader, StatCard, TableContainer } from '@/components/ui/page'
import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge'
import { cn } from '@/lib/utils'
import type { Student, Class, Attendance } from '@/types'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function TeacherPage() {
  const t = useTranslations('teacherDashboard')
  const tAdd = useTranslations('teacherClasses')
  const tr = useTranslations('requests')
  const format = useFormatter()
  const { user, offline, school } = useAuth()
  // Live, offline-first data shared with every other teacher screen: it is
  // on screen from the first frame (last known snapshot) and refreshes itself.
  const liveClasses = useMyClasses()
  const liveStudents = useStudentsOfClasses(liveClasses)
  const liveAttendance = useMyAttendance()
  const liveCheckIns = useTeacherCheckIns(todayIso())
  const classes = useMemo<Class[]>(() => liveClasses ?? [], [liveClasses])
  const students = useMemo<Student[]>(() => liveStudents ?? [], [liveStudents])
  const attendance = useMemo<Attendance[]>(() => liveAttendance ?? [], [liveAttendance])
  const loading = liveClasses === undefined || liveStudents === undefined || liveAttendance === undefined
  // null = the first class (the default), '' = all classes.
  const [classChoice, setClassChoice] = useState<string | null>(null)
  const selectedClass = classChoice ?? (classes.length > 0 ? classes[0].id : '')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(todayIso)
  const [showAllDates, setShowAllDates] = useState(false)
  const myRequests = useMyRequests(user?.uid)

  const myClassIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes])

  // Archived (deleted) students are hidden everywhere in the teacher area.
  const archivedIds = useMemo(
    () => new Set(students.filter((s) => s.isActive === false).map((s) => s.id)),
    [students]
  )

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

  const myAttendance = useMemo(
    () => attendance.filter((r) => myClassIds.has(r.classId) && !archivedIds.has(r.studentId)),
    [attendance, myClassIds, archivedIds]
  )

  const absentRows = useMemo(() => {
    return myAttendance
      .filter((r) => r.status === 'absent')
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
          gender: stu?.gender,
          parentLanguage: stu?.parentLanguage,
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [myAttendance, studentById, classById, selectedClass])

  const requestSummary = useMemo(() => {
    const list = myRequests ?? []
    return {
      pending: list.filter((r) => r.status === 'pending').length,
      recent: list
        .filter((r) => r.status === 'approved' || r.status === 'rejected')
        .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
        .slice(0, 3),
    }
  }, [myRequests])

  const formatDay = (d: string) => {
    const parsed = new Date(`${d}T00:00:00`)
    return isNaN(parsed.getTime()) ? d : format.dateTime(parsed, { dateStyle: 'medium' })
  }
  const formatStamp = (iso?: string) => {
    if (!iso) return ''
    const parsed = new Date(iso)
    return isNaN(parsed.getTime()) ? iso : format.dateTime(parsed, { dateStyle: 'medium' })
  }

  // Current day by default; "All dates" + search to browse previous absences.
  const filteredAbsent = absentRows.filter((r) => {
    if (!showAllDates && r.date !== dateFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.parentPhone.toLowerCase().includes(q) ||
      (r.className || '').toLowerCase().includes(q)
    )
  })

  // Today's headline numbers for the KPI cards (active students only).
  const today = todayIso()
  const totalStudents = students.filter((s) => s.isActive !== false && myClassIds.has(s.classId)).length
  const todayAtt = myAttendance.filter((r) => r.date === today)
  const absentToday = todayAtt.filter((r) => r.status === 'absent').length
  const presentToday = todayAtt.filter((r) => r.status === 'present').length

  // SMS from the Ustaz's own phone: one per parent, or one group text to
  // every parent of the absent students shown.
  const rowSmsHref = (r: (typeof filteredAbsent)[number]) =>
    smsHref(r.parentPhone, generateSmsMessage(r.studentName, r.gender, r.parentLanguage, school))
  const groupHref = groupSmsHref(
    filteredAbsent.map((r) => r.parentPhone),
    generateGroupSmsMessage(dominantLanguage(filteredAbsent.map((r) => r.parentLanguage)), school),
    detectSmsPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent)
  )
  const groupCount = new Set(filteredAbsent.map((r) => r.parentPhone).filter(Boolean)).size

  const phoneLink = (phone: string) =>
    phone ? (
      <a
        href={`tel:${phone}`}
        aria-label={t('absent.callNumber', { phone })}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span dir="ltr">{phone}</span>
      </a>
    ) : (
      <span className="text-muted-foreground">–</span>
    )

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        {offline ? (
          <OfflineNotice />
        ) : (
        <>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        </>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link href="/teacher/classes#student-form" className={buttonVariants()}>
            <UserPlus /> {tAdd('form.submitAdd')}
          </Link>
        }
      />

      {liveCheckIns !== undefined && <CheckInCard classes={classes} checkIns={liveCheckIns} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('stats.students')} value={totalStudents} icon={Users} />
        <StatCard label={t('stats.absentToday')} value={absentToday} icon={UserX} tone="destructive" />
        <StatCard label={t('stats.presentToday')} value={presentToday} icon={UserCheck} tone="success" />
        <StatCard label={t('stats.classes')} value={classes.length} icon={GraduationCap} tone="info" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* Absent students */}
        <section className="rounded-xl border bg-card shadow-sm lg:col-span-2">
          <div className="space-y-4 border-b p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('absent.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('absent.description')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={badgeVariants({ variant: 'destructive' })}>
                  {t('absent.count', { count: filteredAbsent.length })}
                </span>
                {groupHref ? (
                  <a href={groupHref} title={t('absent.sendSmsAllHint')} className={buttonVariants({ size: 'sm', variant: 'success' })}>
                    <MessageSquare /> {t('absent.sendSmsAll', { count: groupCount })}
                  </a>
                ) : (
                  filteredAbsent.length > 0 && <span className="text-xs text-muted-foreground">{t('absent.noNumbers')}</span>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dash-class">{t('absent.class')}</Label>
                <Select id="dash-class" value={selectedClass} onChange={(e) => setClassChoice(e.target.value)}>
                  <option value="">{t('absent.allClasses')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.section ? `${c.name} · ${c.section}` : c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="dash-date">{t('absent.date')}</Label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showAllDates}
                      onChange={(e) => setShowAllDates(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    {t('absent.allDates')}
                  </label>
                </div>
                <Input
                  id="dash-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value || todayIso())}
                  disabled={showAllDates}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-search">{t('absent.search')}</Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="dash-search"
                    type="search"
                    placeholder={t('absent.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ps-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5">
            {classes.length === 0 ? (
              <EmptyState icon={GraduationCap} title={t('absent.noClasses')} />
            ) : filteredAbsent.length === 0 ? (
              <EmptyState
                icon={UserX}
                title={
                  search
                    ? t('absent.emptySearch')
                    : showAllDates
                      ? t('absent.emptyAll')
                      : t('absent.emptyDate', { date: formatDay(dateFilter) })
                }
              />
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <ul className="space-y-2 md:hidden">
                  {filteredAbsent.map((r) => (
                    <li key={r.id} className="rounded-xl border bg-card p-3">
                      <p className="font-medium text-foreground">{r.studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDay(r.date)} · {r.section ? `${r.className} · ${r.section}` : r.className}
                      </p>
                      {(r.parentPhone || r.alternativePhone) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {r.parentPhone && phoneLink(r.parentPhone)}
                          {r.alternativePhone && phoneLink(r.alternativePhone)}
                          {r.parentPhone && (
                            <a
                              href={rowSmsHref(r)}
                              title={t('absent.sendSmsHint')}
                              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'ms-auto')}
                            >
                              <MessageSquare /> {t('absent.sendSms')}
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Desktop: table */}
                <TableContainer className="hidden shadow-none md:block">
                  <thead>
                    <tr>
                      <th>{t('table.date')}</th>
                      <th>{t('table.student')}</th>
                      <th>{t('table.class')}</th>
                      <th>{t('table.parentPhone')}</th>
                      <th>{t('table.alternativePhone')}</th>
                      <th>{t('table.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAbsent.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-muted-foreground">{formatDay(r.date)}</td>
                        <td className="font-medium text-foreground">{r.studentName}</td>
                        <td className="text-muted-foreground">
                          {r.section ? `${r.className} · ${r.section}` : r.className}
                        </td>
                        <td>{phoneLink(r.parentPhone)}</td>
                        <td>{phoneLink(r.alternativePhone)}</td>
                        <td>
                          {r.parentPhone ? (
                            <a href={rowSmsHref(r)} title={t('absent.sendSmsHint')} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                              <MessageSquare /> {t('absent.sendSms')}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableContainer>
              </>
            )}
          </div>
        </section>

        {/* My requests */}
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{t('requests.title')}</h2>
              {myRequests === undefined ? (
                <Skeleton className="mt-1 h-4 w-40" />
              ) : (
                <p className="text-sm text-muted-foreground">{t('requests.pending', { count: requestSummary.pending })}</p>
              )}
            </div>
          </div>

          <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('requests.recent')}
          </h3>
          {myRequests === undefined ? (
            <div className="mt-2 space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : requestSummary.recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('requests.noRecent')}</p>
          ) : (
            <ul className="mt-2 divide-y">
              {requestSummary.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{tr(`types.${r.type}`)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t('requests.decided', { student: r.studentName, date: formatStamp(r.reviewedAt) })}
                    </p>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/teacher/requests"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 w-full justify-between')}
          >
            {t('requests.viewAll')}
            <ChevronRight className="rtl:rotate-180" />
          </Link>
        </section>
      </div>
    </div>
  )
}
