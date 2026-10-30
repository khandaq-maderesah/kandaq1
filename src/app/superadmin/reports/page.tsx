'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Download,
  FileBarChart,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  School as ClassIcon,
  Search,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { usePlatformFigures, PLATFORM_ATTENDANCE_DAYS } from '@/hooks/usePlatformFigures'
import { REPORT_CARDS, reportNeeds, type PlatformTotals, type ReportCard, type SchoolFigures } from '@/lib/platformStats'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page'

type ColumnKey = 'students' | 'ustazes' | 'admins' | 'classes' | 'male' | 'female' | 'withoutUstaz' | 'orphans' | 'share' | 'came' | 'absent' | 'rate'

type Column = {
  key: ColumnKey
  get: (f: SchoolFigures) => string | number
  total: (t: PlatformTotals) => string | number
}

const pct = (n: number | null) => (n === null ? '—' : `${n}%`)
const share = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 1000) / 10}%`)

/** The columns of each report card; every row is one medreseh. */
const COLUMNS: Record<ReportCard, Column[]> = {
  overview: [
    { key: 'students', get: (f) => f.students, total: (t) => t.students },
    { key: 'ustazes', get: (f) => f.ustazes, total: (t) => t.ustazes },
    { key: 'admins', get: (f) => f.admins, total: (t) => t.admins },
    { key: 'classes', get: (f) => f.classes, total: (t) => t.classes },
  ],
  students: [
    { key: 'students', get: (f) => f.students, total: (t) => t.students },
    { key: 'male', get: (f) => f.male, total: (t) => t.male },
    { key: 'female', get: (f) => f.female, total: (t) => t.female },
  ],
  staff: [
    { key: 'ustazes', get: (f) => f.ustazes, total: (t) => t.ustazes },
    { key: 'admins', get: (f) => f.admins, total: (t) => t.admins },
  ],
  classes: [
    { key: 'classes', get: (f) => f.classes, total: (t) => t.classes },
    { key: 'withoutUstaz', get: (f) => f.classesWithoutUstaz, total: (t) => t.classesWithoutUstaz },
  ],
  orphans: [
    { key: 'orphans', get: (f) => f.orphans, total: (t) => t.orphans },
    { key: 'students', get: (f) => f.students, total: (t) => t.students },
    { key: 'share', get: (f) => share(f.orphans, f.students), total: (t) => share(t.orphans, t.students) },
  ],
  attendance: [
    { key: 'came', get: (f) => f.attended, total: (t) => t.attended },
    { key: 'absent', get: (f) => f.absent, total: (t) => t.absent },
    { key: 'rate', get: (f) => pct(f.attendanceRate), total: (t) => pct(t.attendanceRate) },
  ],
}

const CARD_ICONS: Record<ReportCard, LucideIcon> = {
  overview: LayoutDashboard,
  students: GraduationCap,
  staff: UserCheck,
  classes: ClassIcon,
  orphans: HeartHandshake,
  attendance: CalendarCheck,
}

const CARD_TONES: Record<ReportCard, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
  overview: 'default',
  students: 'info',
  staff: 'success',
  classes: 'info',
  orphans: 'warning',
  attendance: 'success',
}

/** The cards ticked last time, kept on this device only. */
const SELECTION_KEY = 'kmms.superadmin.reports.cards'

function loadSelection(): ReportCard[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SELECTION_KEY) ?? '[]')
    return Array.isArray(saved) ? REPORT_CARDS.filter((c) => saved.includes(c)) : []
  } catch {
    return []
  }
}

function saveSelection(cards: ReportCard[]) {
  try {
    window.localStorage.setItem(SELECTION_KEY, JSON.stringify(cards))
  } catch {
    /* private mode or blocked storage: the choice just is not remembered */
  }
}

/** Attendance rate colouring: 85% and up is healthy, below 70% needs attention. */
const rateVariant = (rate: number | null) => (rate === null ? 'secondary' : rate >= 85 ? 'success' : rate >= 70 ? 'warning' : 'destructive')

export default function SuperadminReportsPage() {
  const t = useTranslations('superadminTools.reports')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { figures, totals, ready, refreshing, refresh } = usePlatformFigures({ auto: false })

  const [selected, setSelected] = useState<ReportCard[]>([])
  const [shown, setShown] = useState<ReportCard[] | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [query, setQuery] = useState('')

  // Remembered after mount (not in the initial state) so the server and browser render the same first frame.
  useEffect(() => setSelected(loadSelection()), [])

  const choose = (next: ReportCard[]) => {
    setSelected(next)
    saveSelection(next)
  }
  const toggle = (card: ReportCard) => choose(selected.includes(card) ? selected.filter((c) => c !== card) : [...selected, card])

  // What pressing Generate will read, said in plain words before anything is read.
  const needs = reportNeeds(selected)
  const readItems = (['students', 'classes', 'attendance'] as const)
    .filter((k) => needs[k])
    .map((k) => t(`readItems.${k}`, { days: PLATFORM_ATTENDANCE_DAYS }))

  // Nothing is read until the button is pressed; the report appears once the numbers have arrived.
  const generate = async () => {
    if (selected.length === 0) return
    await refresh(reportNeeds(selected))
    // Keep the cards in their usual order, whatever order they were ticked in.
    setShown(REPORT_CARDS.filter((c) => selected.includes(c)))
    setGeneratedAt(new Date())
    setQuery('')
  }

  const num = (v: string | number) => (typeof v === 'number' ? format.number(v) : v)
  const statusLabel = (f: SchoolFigures) => (f.status === 'suspended' ? t('status.suspended') : t('status.active'))

  const exportCard = (card: ReportCard) => {
    const cols = COLUMNS[card]
    const head = [t('columns.medreseh'), ...(card === 'overview' ? [t('columns.status')] : []), ...cols.map((c) => t(`columns.${c.key}`))]
    const rows = figures.map((f) => [f.name, ...(card === 'overview' ? [statusLabel(f)] : []), ...cols.map((c) => c.get(f))])
    rows.push([t('total'), ...(card === 'overview' ? [''] : []), ...cols.map((c) => c.total(totals))])
    exportToCsv(`${card}-${dateStamp()}.csv`, head, rows)
  }

  /** The one number each card is about, with a short line of detail. */
  const headline = (card: ReportCard): { value: string | number; hint: string } => {
    switch (card) {
      case 'overview':
        return { value: totals.students, hint: `${num(totals.ustazes)} ${t('columns.ustazes')} · ${num(totals.classes)} ${t('columns.classes')}` }
      case 'students':
        return { value: totals.students, hint: t('hints.gender', { boys: num(totals.male), girls: num(totals.female) }) }
      case 'staff':
        return { value: totals.ustazes, hint: t('hints.admins', { count: num(totals.admins) }) }
      case 'classes':
        return { value: totals.classes, hint: t('hints.withoutUstaz', { count: num(totals.classesWithoutUstaz) }) }
      case 'orphans':
        return { value: totals.orphans, hint: t('hints.share', { percent: share(totals.orphans, totals.students) }) }
      case 'attendance':
        return { value: pct(totals.attendanceRate), hint: t('hints.attendance', { came: num(totals.attended), absent: num(totals.absent) }) }
    }
  }

  const cellFor = (c: Column, f: SchoolFigures) => {
    if (c.key === 'rate') return <Badge variant={rateVariant(f.attendanceRate)}>{num(c.get(f))}</Badge>
    const value = c.get(f)
    if (c.key === 'withoutUstaz' && typeof value === 'number' && value > 0) {
      return <span className="font-medium text-warning">{num(value)}</span>
    }
    return num(value)
  }

  const needsRecords = (card: ReportCard) => Object.values(reportNeeds([card])).some(Boolean)
  const unreadable = shown ? figures.filter((f) => !f.loaded && shown.some(needsRecords)).length : 0
  const q = query.trim().toLowerCase()
  const rowsShown = figures.filter((f) => !q || f.name.toLowerCase().includes(q))

  const jumpTo = (card: ReportCard) => document.getElementById(`report-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <section aria-labelledby="report-pick" className="mb-6 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="report-pick" className="text-sm font-semibold text-foreground">
              {t('pick')}
            </h2>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {t('selected', { selected: selected.length, total: REPORT_CARDS.length })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => choose([...REPORT_CARDS])} disabled={selected.length === REPORT_CARDS.length}>
              {t('selectAll')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => choose([])} disabled={selected.length === 0}>
              {t('clear')}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_CARDS.map((card) => {
            const Icon = CARD_ICONS[card]
            const on = selected.includes(card)
            return (
              <div key={card} className="relative">
                <input
                  id={`report-card-${card}`}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(card)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`report-card-${card}`}
                  className={cn(
                    'flex h-full min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                    on ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{t(`cards.${card}.title`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`cards.${card}.description`, { days: PLATFORM_ATTENDANCE_DAYS })}</span>
                  </span>
                  {on ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </label>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <Button type="button" onClick={generate} disabled={selected.length === 0 || refreshing} className="sm:w-auto">
            {refreshing ? <Loader2 className="animate-spin" /> : <FileBarChart />}
            {t('generate')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {selected.length === 0 ? t('selectOne') : readItems.length === 0 ? t('readsNothing') : t('reads', { items: readItems.join(', ') })}
          </p>
        </div>
      </section>

      {shown === null ? (
        refreshing ? (
          <div className="space-y-4" aria-busy="true">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <EmptyState icon={FileBarChart} title={t('empty.title')} description={t('empty.description')} />
        )
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {generatedAt && t('generatedAt', { time: format.dateTime(generatedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
              {!ready && ` · ${t('loading')}`}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('refresh')}
            </Button>
          </div>

          {unreadable > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('partial', { count: unreadable })}
            </p>
          )}

          <section aria-labelledby="report-glance">
            <h2 id="report-glance" className="mb-3 text-sm font-semibold text-foreground">
              {t('glance')}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {shown.map((card) => {
                const h = headline(card)
                return (
                  <StatCard
                    key={card}
                    label={t(`cards.${card}.title`)}
                    value={num(h.value)}
                    hint={h.hint}
                    icon={CARD_ICONS[card]}
                    tone={CARD_TONES[card]}
                    onClick={() => jumpTo(card)}
                  />
                )
              })}
            </div>
          </section>

          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label={t('filter')}
              placeholder={t('filterPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          {shown.map((card) => {
            const cols = COLUMNS[card]
            const Icon = CARD_ICONS[card]
            return (
              <section key={card} id={`report-${card}`} className="scroll-mt-20 rounded-xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-foreground">{t(`cards.${card}.title`)}</h2>
                      <p className="text-xs text-muted-foreground">
                        {card === 'attendance' ? t('attendancePeriod', { days: PLATFORM_ATTENDANCE_DAYS }) : t(`cards.${card}.description`, { days: PLATFORM_ATTENDANCE_DAYS })}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => exportCard(card)} disabled={figures.length === 0}>
                    <Download /> {tc('actions.exportCsv')}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2.5 [&_th]:whitespace-nowrap [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/30">
                    <thead>
                      <tr>
                        <th className="sticky start-0 text-start">{t('columns.medreseh')}</th>
                        {card === 'overview' && <th className="text-start">{t('columns.status')}</th>}
                        {cols.map((c) => (
                          <th key={c.key} className="text-end">
                            {t(`columns.${c.key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowsShown.length === 0 ? (
                        <tr>
                          <td colSpan={cols.length + (card === 'overview' ? 2 : 1)} className="text-center text-muted-foreground">
                            {t('noMatch')}
                          </td>
                        </tr>
                      ) : (
                        rowsShown.map((f) => (
                          <tr key={f.schoolId}>
                            <td className="sticky start-0 bg-card font-medium text-foreground">
                              {f.name}
                              {!f.loaded && needsRecords(card) && (
                                <Badge variant="warning" className="ms-2">
                                  {t('notLoaded')}
                                </Badge>
                              )}
                            </td>
                            {card === 'overview' && (
                              <td>
                                <Badge variant={f.status === 'suspended' ? 'warning' : 'success'}>{statusLabel(f)}</Badge>
                              </td>
                            )}
                            {cols.map((c) => (
                              <td key={c.key} className="text-end tabular-nums">
                                {cellFor(c, f)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                      <tr className="bg-muted/40 font-semibold">
                        <td className="sticky start-0 bg-muted">{t('total')}</td>
                        {card === 'overview' && <td />}
                        {cols.map((c) => (
                          <td key={c.key} className="text-end tabular-nums">
                            {num(c.total(totals))}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
