'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { Users, GraduationCap, Shield, ClipboardList, Download, Printer, X, BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard, TableContainer } from '@/components/ui/page'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import { LOCALE_DIR } from '@/i18n/config'
import type { Student, Class, Attendance, User, AttendanceStatus } from '@/types'

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: 'hsl(var(--success))',
  absent: 'hsl(var(--destructive))',
  late: 'hsl(var(--warning))',
  excused: 'hsl(var(--info))',
}

const AXIS = 'hsl(var(--muted-foreground))'
const GRID = 'hsl(var(--border))'

type Counts = Record<AttendanceStatus, number>
const emptyCounts = (): Counts => ({ present: 0, absent: 0, late: 0, excused: 0 })

export default function ReportsPage() {
  const t = useTranslations('adminReports')
  const tc = useTranslations('common')
  const format = useFormatter()
  const locale = useLocale()
  const isRtl = LOCALE_DIR[locale] === 'rtl'
  const eth = useEthiopianDate()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Realtime data via the shared store — the report updates live as data changes,
  // without adding duplicate subscriptions on top of the shell bells.
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeAttendance = useLiveData<Attendance[]>('attendance:all', (emit) => rtdb.subscribeToAttendance(emit))
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))

  const students = useMemo(() => storeStudents.data ?? [], [storeStudents.data])
  const classes = useMemo(() => storeClasses.data ?? [], [storeClasses.data])
  const attendance = useMemo(() => storeAttendance.data ?? [], [storeAttendance.data])
  const teacherCount = useMemo(
    () => (storeUsers.data ?? []).filter((x) => x.role === 'teacher').length,
    [storeUsers.data]
  )
  // Archived students (isActive === false) are not counted as active.
  const activeStudents = useMemo(() => students.filter((s) => s.isActive !== false), [students])
  const loading = !storeStudents.data

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
    const totals = emptyCounts()
    const dayMap: Record<string, Counts> = {}
    filtered.forEach((a) => {
      if (!STATUSES.includes(a.status)) return
      totals[a.status]++
      if (!dayMap[a.date]) dayMap[a.date] = emptyCounts()
      dayMap[a.date][a.status]++
    })
    const dailyData = Object.keys(dayMap)
      .sort()
      .slice(-7)
      .map((date) => ({ date, ...dayMap[date] }))
    return { ...totals, totalRecords: filtered.length, dailyData }
  }, [filtered])

  const studentSummary = useMemo(() => {
    const map: Record<string, Counts> = {}
    filtered.forEach((a) => {
      if (!STATUSES.includes(a.status)) return
      if (!map[a.studentId]) map[a.studentId] = emptyCounts()
      map[a.studentId][a.status]++
    })
    const classInfo: Record<string, string> = {}
    classes.forEach((c) => {
      classInfo[c.id] = c.name
    })
    return activeStudents
      .map((s) => {
        const m = map[s.id] || emptyCounts()
        const total = m.present + m.absent + m.late + m.excused
        const rate = total > 0 ? Math.round((m.present / total) * 100) : 0
        return { id: s.id, name: s.name, className: s.className || classInfo[s.classId] || '—', ...m, total, rate }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [filtered, activeStudents, classes])

  const statusLabel = (s: AttendanceStatus) => t(`status.${s}`)
  const totalForPct = STATUSES.reduce((acc, s) => acc + stats[s], 0)
  const pct = (n: number) => (totalForPct > 0 ? Math.round((n / totalForPct) * 100) : 0)
  const statusData = STATUSES.map((s) => ({ key: s, name: statusLabel(s), value: stats[s] }))

  const handleExport = () => {
    exportToCsv(`attendance-report-${dateStamp()}.csv`, [t('csv.metric'), t('csv.value')], [
      [t('csv.totalStudents'), activeStudents.length],
      [t('csv.totalClasses'), classes.length],
      [t('csv.totalTeachers'), teacherCount],
      [t('csv.records'), stats.totalRecords],
      [t('csv.present'), stats.present],
      [t('csv.absent'), stats.absent],
      [t('csv.late'), stats.late],
      [t('csv.excused'), stats.excused],
    ])
  }

  const handleExportStudents = () => {
    exportToCsv(
      `student-attendance-${dateStamp()}.csv`,
      [
        t('csv.name'),
        t('csv.class'),
        t('csv.present'),
        t('csv.absent'),
        t('csv.late'),
        t('csv.excused'),
        t('csv.total'),
        t('csv.rate'),
      ],
      studentSummary.map((r) => [r.name, r.className, r.present, r.absent, r.late, r.excused, r.total, r.rate])
    )
  }

  const gDate = (d: string, short = false) => {
    const parsed = new Date(d)
    if (!d || Number.isNaN(parsed.getTime())) return d || '—'
    return short
      ? format.dateTime(parsed, { month: 'short', day: 'numeric', timeZone: 'UTC' })
      : format.dateTime(parsed, { dateStyle: 'medium', timeZone: 'UTC' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  const fromEth = eth.format(fromDate)
  const toEth = eth.format(toDate)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportStudents}>
              <Download /> {t('actions.studentCsv')}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download /> {t('actions.summaryCsv')}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {tc('actions.print')}
            </Button>
          </div>
        }
      />

      {/* Date range toolbar */}
      <div className="no-print rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="report-from">{t('filters.from')}</Label>
            <Input id="report-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-to">{t('filters.to')}</Label>
            <Input id="report-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFromDate('')
              setToDate('')
            }}
            disabled={!fromDate && !toDate}
          >
            <X /> {t('filters.clear')}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('filters.hint')}
          {(fromEth || toEth) && (
            <span className="block">
              {fromEth && toEth
                ? t('filters.ethRange', { from: fromEth, to: toEth })
                : fromEth
                ? t('filters.ethFrom', { date: fromEth })
                : t('filters.ethTo', { date: toEth! })}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('kpi.students')} value={format.number(activeStudents.length)} icon={Users} />
        <StatCard label={t('kpi.classes')} value={format.number(classes.length)} icon={GraduationCap} tone="warning" />
        <StatCard label={t('kpi.teachers')} value={format.number(teacherCount)} icon={Shield} tone="success" />
        <StatCard
          label={t('kpi.records')}
          value={format.number(stats.totalRecords)}
          hint={totalForPct > 0 ? t('kpi.rateHint', { percent: pct(stats.present) }) : undefined}
          icon={ClipboardList}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('charts.byStatusTitle')}</CardTitle>
            <CardDescription>{t('charts.byStatusDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {totalForPct === 0 ? (
              <EmptyState icon={BarChart3} title={t('charts.noData')} className="border-0" />
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                <div className="h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="95%"
                        paddingAngle={1}
                        stroke="hsl(var(--card))"
                        isAnimationActive={false}
                      >
                        {statusData.map((d) => (
                          <Cell key={d.key} fill={STATUS_COLOR[d.key]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null
                          const p = payload[0]
                          return (
                            <div className="rounded-lg border bg-card px-3 py-2 text-xs text-card-foreground shadow-md">
                              {t('charts.pieTooltip', { name: p.name, value: p.value, percent: pct(p.value) })}
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full max-w-xs space-y-3">
                  {statusData.map((d) => (
                    <li key={d.key} className="flex items-center gap-3 text-sm">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS_COLOR[d.key] }} />
                      <span className="flex-1 font-medium text-foreground">{d.name}</span>
                      <span className="font-semibold tabular-nums text-foreground">{format.number(d.value)}</span>
                      <span className="w-12 text-end tabular-nums text-muted-foreground">
                        {t('charts.percent', { percent: pct(d.value) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t('charts.dailyTitle')}</CardTitle>
            <CardDescription>{t('charts.dailyDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.dailyData.length === 0 ? (
              <EmptyState icon={BarChart3} title={t('charts.noData')} className="border-0" />
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                    <XAxis
                      dataKey="date"
                      reversed={isRtl}
                      tick={{ fontSize: 11, fill: AXIS }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => (d ? gDate(d, true) : '')}
                    />
                    <YAxis
                      allowDecimals={false}
                      orientation={isRtl ? 'right' : 'left'}
                      tick={{ fontSize: 11, fill: AXIS }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null
                        const get = (key: string) => payload.find((p: any) => p.dataKey === key)?.value ?? 0
                        const ethLabel = eth.format(label)
                        return (
                          <div
                            className="rounded-lg border bg-card px-3 py-2 text-xs text-card-foreground shadow-md"
                            dir={isRtl ? 'rtl' : 'ltr'}
                          >
                            <p className="font-semibold">{gDate(label)}</p>
                            {ethLabel && <p className="mb-1 text-muted-foreground">{ethLabel}</p>}
                            {STATUSES.map((s) => (
                              <p key={s} className="flex items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                                <span className="text-muted-foreground">{statusLabel(s)}</span>
                                <span className="ms-auto font-medium tabular-nums">{get(s)}</span>
                              </p>
                            ))}
                            <p className="mt-1 border-t pt-1 font-medium">
                              {t('charts.total', { count: STATUSES.reduce((acc, s) => acc + get(s), 0) })}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {STATUSES.map((s) => (
                      <Bar key={s} dataKey={s} name={statusLabel(s)} fill={STATUS_COLOR[s]} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-student attendance summary */}
      <section className="space-y-3">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
          {t('summary.title')}
          <Badge variant="secondary">{t('summary.count', { count: studentSummary.length })}</Badge>
        </h2>
        {studentSummary.length === 0 ? (
          <EmptyState icon={Users} title={t('summary.empty')} />
        ) : (
          <TableContainer>
            <thead>
              <tr>
                <th>{t('summary.table.student')}</th>
                <th>{t('summary.table.class')}</th>
                <th className="!text-end">{t('summary.table.present')}</th>
                <th className="!text-end">{t('summary.table.absent')}</th>
                <th className="!text-end">{t('summary.table.late')}</th>
                <th className="!text-end">{t('summary.table.excused')}</th>
                <th className="!text-end">{t('summary.table.total')}</th>
                <th className="!text-end">{t('summary.table.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {studentSummary.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-foreground">{r.name}</td>
                  <td>{r.className}</td>
                  <td className="text-end tabular-nums">{r.present}</td>
                  <td className="text-end tabular-nums">{r.absent}</td>
                  <td className="text-end tabular-nums">{r.late}</td>
                  <td className="text-end tabular-nums">{r.excused}</td>
                  <td className="text-end tabular-nums">{r.total}</td>
                  <td className="text-end">
                    <Badge variant={r.total === 0 ? 'secondary' : r.rate >= 90 ? 'success' : r.rate >= 75 ? 'warning' : 'destructive'}>
                      {t('charts.percent', { percent: r.rate })}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
        )}
      </section>
    </div>
  )
}
