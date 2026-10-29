'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Download, FileBarChart, Loader2, RefreshCw } from 'lucide-react'
import { usePlatformFigures, PLATFORM_ATTENDANCE_DAYS } from '@/hooks/usePlatformFigures'
import { REPORT_CARDS, type PlatformTotals, type ReportCard, type SchoolFigures } from '@/lib/platformStats'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/page'

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

export default function SuperadminReportsPage() {
  const t = useTranslations('superadminTools.reports')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { figures, totals, ready, refreshing, refresh } = usePlatformFigures()

  const [selected, setSelected] = useState<ReportCard[]>([])
  const [shown, setShown] = useState<ReportCard[] | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const toggle = (card: ReportCard) =>
    setSelected((cur) => (cur.includes(card) ? cur.filter((c) => c !== card) : [...cur, card]))

  const generate = () => {
    if (selected.length === 0) return
    // Keep the cards in their usual order, whatever order they were ticked in.
    setShown(REPORT_CARDS.filter((c) => selected.includes(c)))
    setGeneratedAt(new Date())
    refresh()
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

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <section className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t('pick')}</h2>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([...REPORT_CARDS])}>
              {t('selectAll')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])} disabled={selected.length === 0}>
              {t('clear')}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_CARDS.map((card) => (
            <label
              key={card}
              htmlFor={`report-card-${card}`}
              className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
            >
              <input
                id={`report-card-${card}`}
                type="checkbox"
                checked={selected.includes(card)}
                onChange={() => toggle(card)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
              />
              <span>
                <span className="block font-medium text-foreground">{t(`cards.${card}.title`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`cards.${card}.description`, { days: PLATFORM_ATTENDANCE_DAYS })}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={generate} disabled={selected.length === 0 || refreshing}>
            {refreshing ? <Loader2 className="animate-spin" /> : <FileBarChart />}
            {t('generate')}
          </Button>
          {selected.length === 0 && <p className="text-xs text-muted-foreground">{t('selectOne')}</p>}
        </div>
      </section>

      {shown === null ? (
        <EmptyState icon={FileBarChart} title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {generatedAt && t('generatedAt', { time: format.dateTime(generatedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}
              {!ready && ` · ${t('loading')}`}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('refresh')}
            </Button>
          </div>

          {shown.map((card) => {
            const cols = COLUMNS[card]
            return (
              <section key={card} className="rounded-xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
                  <div>
                    <h2 className="font-semibold text-foreground">{t(`cards.${card}.title`)}</h2>
                    {card === 'attendance' && <p className="text-xs text-muted-foreground">{t('attendancePeriod', { days: PLATFORM_ATTENDANCE_DAYS })}</p>}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => exportCard(card)} disabled={figures.length === 0}>
                    <Download /> {tc('actions.exportCsv')}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm [&_td]:px-4 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_tbody_tr]:border-t">
                    <thead>
                      <tr>
                        <th>{t('columns.medreseh')}</th>
                        {card === 'overview' && <th>{t('columns.status')}</th>}
                        {cols.map((c) => (
                          <th key={c.key}>{t(`columns.${c.key}`)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {figures.map((f) => (
                        <tr key={f.schoolId}>
                          <td className="font-medium text-foreground">
                            {f.name}
                            {!f.loaded && (
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
                            <td key={c.key} className="tabular-nums">
                              {num(c.get(f))}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-semibold">
                        <td>{t('total')}</td>
                        {card === 'overview' && <td />}
                        {cols.map((c) => (
                          <td key={c.key} className="tabular-nums">
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
