'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { Exam, ExamType } from '@/types'
import { TableContainer } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import {
  computeExam,
  examTotalMax,
  examTypeKey,
  fmt,
  DEFAULT_SUBJECT_MAX,
  type OverallStudentRow,
} from '@/lib/examMath'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'

/* ───────────────────────────── Formatting ───────────────────────────── */

/** Locale-aware number helpers for exam marks, averages, percentages and ranks. */
export function useExamFormat() {
  const format = useFormatter()
  return useMemo(() => {
    const round1 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 10) / 10
    return {
      /** Marks and totals: up to one decimal (e.g. 87 or 87.5). */
      num: (n: number) => format.number(round1(n), { maximumFractionDigits: 1 }),
      /** Averages: always one decimal. */
      avg: (n: number) =>
        format.number(round1(n), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      /** Percentage value 0–100 → "87.5%". */
      pct: (n: number) =>
        format.number(round1(n) / 100, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      /** Whole numbers (ranks, max marks, counts). */
      int: (n: number) => format.number(n, { maximumFractionDigits: 0 }),
    }
  }, [format])
}

/** Translated, de-duplicated list of the exam types in `exams` (e.g. "Mid exam and Final exam"). */
export function useExamTypeList() {
  const t = useTranslations('exams')
  const format = useFormatter()
  return useCallback(
    (exams: Exam[]) => {
      const types: ExamType[] = []
      exams.forEach((e) => {
        if (!types.includes(e.type)) types.push(e.type)
      })
      return format.list(
        types.map((type) => t(examTypeKey(type))),
        { type: 'conjunction' },
      )
    },
    [t, format],
  )
}

/* ───────────────────────────── CSV exports ──────────────────────────── */

export interface SubjectColumn {
  subject: string
  max: number
}

/** CSV downloads with translated headers. Numeric cells stay machine-readable. */
export function useExamCsv() {
  const t = useTranslations('exams.csv')
  return useMemo(
    () => ({
      exportExam: (exam: Exam) => {
        const computed = computeExam(exam)
        const rows = Object.values(computed.rows).sort((a, b) =>
          (a.rollNumber || '').localeCompare(b.rollNumber || ''),
        )
        exportToCsv(
          `${exam.title.replace(/\s+/g, '-')}-${dateStamp()}.csv`,
          [
            t('roll'),
            t('student'),
            ...exam.subjects,
            t('total'),
            t('average'),
            t('percentage'),
            t('rank'),
          ],
          rows.map((r) => [
            r.rollNumber || '',
            r.studentName,
            ...exam.subjects.map((sub) => r.marks?.[sub] ?? 0),
            r.total,
            fmt(r.average),
            fmt(r.percentage),
            r.rank,
          ]),
        )
      },
      exportOverall: (fileLabel: string, columns: SubjectColumn[], rows: OverallStudentRow[]) => {
        exportToCsv(
          `${t('overallFile')}-${fileLabel.replace(/\s+/g, '-')}-${dateStamp()}.csv`,
          [
            t('roll'),
            t('student'),
            ...columns.map((c) => t('subjectOutOf', { subject: c.subject, max: c.max })),
            t('grandTotal'),
            t('percentage'),
            t('rank'),
          ],
          rows.map((r) => [
            r.rollNumber || '',
            r.studentName,
            ...r.perSubject.map((p) => p.total),
            r.grandTotal,
            fmt(r.percentage),
            r.rank,
          ]),
        )
      },
    }),
    [t],
  )
}

/* ─────────────────────────── Shared table bits ──────────────────────── */

/** Sticky first-column classes (header + body) for wide result tables. */
export const stickyHeadClass =
  'sticky start-0 z-10 !bg-muted min-w-[10rem] shadow-[inset_-1px_0_0_hsl(var(--border))] rtl:shadow-[inset_1px_0_0_hsl(var(--border))]'
export const stickyCellClass =
  'sticky start-0 z-10 bg-card min-w-[10rem] shadow-[inset_-1px_0_0_hsl(var(--border))] rtl:shadow-[inset_1px_0_0_hsl(var(--border))]'

/** Student name with roll number underneath (used in the sticky first column). */
export function StudentCell({ name, roll, extra }: { name: string; roll?: string; extra?: ReactNode }) {
  const t = useTranslations('exams.table')
  return (
    <div className="min-w-0">
      <div className="font-medium text-foreground">{name}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {roll ? t('rollShort', { roll }) : t('noRoll')}
        {extra}
      </div>
    </div>
  )
}

/** Subject column heading with its maximum marks underneath. */
export function SubjectHead({ subject, max }: { subject: string; max: number }) {
  const t = useTranslations('exams.table')
  const f = useExamFormat()
  return (
    <th className="!text-center" title={t('maxMarks', { max })}>
      <span className="normal-case">{subject}</span>
      <div className="text-[10px] font-normal normal-case tracking-normal">
        {t('outOf', { max: f.int(max) })}
      </div>
    </th>
  )
}

function MetaLine({ items }: { items: (string | false | undefined | null)[] }) {
  const list = items.filter(Boolean) as string[]
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
      {list.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  )
}

/* ─────────────────────────── Single exam sheet ──────────────────────── */

/**
 * Read-only printable results sheet for a single exam.
 * Recomputes stats so it always reflects the current saved marks.
 */
export function ExamResultsSheet({ exam }: { exam: Exam }) {
  const t = useTranslations('exams')
  const f = useExamFormat()
  const computed = useMemo(() => computeExam(exam), [exam])
  const rows = Object.values(computed.rows).sort((a, b) =>
    (a.rollNumber || '').localeCompare(b.rollNumber || ''),
  )
  const totalMax = examTotalMax(exam.subjects, exam.subjectMax)
  const summary = computed.summary

  const statRow = (label: string, pick: (sub: string) => number, overall: number, fmtFn: (n: number) => string) => (
    <tr className="border-t bg-muted/40 text-xs text-muted-foreground">
      <td className={cn(stickyCellClass, '!bg-muted font-semibold text-foreground')}>{label}</td>
      {exam.subjects.map((sub) => (
        <td key={sub} className="text-center tabular-nums">
          {fmtFn(pick(sub))}
        </td>
      ))}
      <td className="text-center tabular-nums">{fmtFn(overall)}</td>
      <td colSpan={3}></td>
    </tr>
  )

  return (
    <div className="print-area space-y-3">
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold text-foreground">{exam.title}</h2>
        <MetaLine
          items={[
            t(examTypeKey(exam.type)),
            exam.className,
            exam.section && t('sheet.section', { section: exam.section }),
            t('sheet.totalMarks', { total: f.int(totalMax) }),
            t('sheet.studentCount', { count: rows.length }),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('sheet.noRows')}</p>
      ) : (
        <TableContainer className="shadow-none">
          <thead>
            <tr>
              <th className={stickyHeadClass}>{t('table.student')}</th>
              {exam.subjects.map((sub) => (
                <SubjectHead key={sub} subject={sub} max={exam.subjectMax?.[sub] ?? DEFAULT_SUBJECT_MAX} />
              ))}
              <th className="!text-center">{t('table.total')}</th>
              <th className="!text-center">{t('table.average')}</th>
              <th className="!text-center">{t('table.percent')}</th>
              <th className="!text-center">{t('table.rank')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className={stickyCellClass}>
                  <StudentCell name={r.studentName} roll={r.rollNumber} />
                </td>
                {exam.subjects.map((sub) => (
                  <td key={sub} className="text-center tabular-nums">
                    {f.num(r.marks?.[sub] ?? 0)}
                  </td>
                ))}
                <td className="text-center font-semibold tabular-nums">{f.num(r.total)}</td>
                <td className="text-center tabular-nums">{f.avg(r.average)}</td>
                <td className="text-center tabular-nums">{f.pct(r.percentage)}</td>
                <td className="text-center font-semibold tabular-nums">{f.int(r.rank)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {statRow(t('table.classAverage'), (s) => summary.subjectStats?.[s]?.average ?? 0, summary.overallAverage, f.avg)}
            {statRow(t('table.highest'), (s) => summary.subjectStats?.[s]?.max ?? 0, summary.overallMax, f.num)}
            {statRow(t('table.lowest'), (s) => summary.subjectStats?.[s]?.min ?? 0, summary.overallMin, f.num)}
          </tfoot>
        </TableContainer>
      )}
    </div>
  )
}

/* ─────────────────────────── Overall (merged) sheet ─────────────────── */

export interface OverallResultsSheetProps {
  /** Current school's name for the printed heading (`useAuth().school?.name`). */
  schoolName?: string
  className?: string
  section?: string
  /** Already-translated academic year label (or "All years"). */
  yearLabel: string
  exams: Exam[]
  rows: OverallStudentRow[]
  columns: SubjectColumn[]
  /** Optional per-row action (hidden when printing). */
  actionHeader?: string
  renderAction?: (row: OverallStudentRow) => ReactNode
}

/** Printable merged result for a class (all saved exams combined per subject). */
export function OverallResultsSheet({
  schoolName,
  className: classLabel,
  section,
  yearLabel,
  exams,
  rows,
  columns,
  actionHeader,
  renderAction,
}: OverallResultsSheetProps) {
  const t = useTranslations('exams')
  const f = useExamFormat()
  const format = useFormatter()
  const typeList = useExamTypeList()

  return (
    <div className="print-area space-y-3">
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold text-foreground">
          {schoolName ? t('overall.heading', { school: schoolName }) : t('overall.headingNoSchool')}
        </h2>
        <MetaLine
          items={[
            classLabel,
            section && t('sheet.section', { section }),
            yearLabel,
            exams.length > 0 && typeList(exams),
            t('overall.examsMerged', { count: exams.length }),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('overall.noStudents')}</p>
      ) : (
        <TableContainer className="shadow-none">
          <thead>
            <tr>
              <th className={stickyHeadClass}>{t('table.student')}</th>
              {columns.map((c) => (
                <SubjectHead key={c.subject} subject={c.subject} max={c.max} />
              ))}
              <th className="!text-center">{t('table.grandTotal')}</th>
              <th className="!text-center">{t('table.percent')}</th>
              <th className="!text-center">{t('table.rank')}</th>
              {renderAction && <th className="no-print !text-end">{actionHeader}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className={stickyCellClass}>
                  <StudentCell name={r.studentName} roll={r.rollNumber} />
                </td>
                {r.perSubject.map((p) => (
                  <td key={p.subject} className="text-center tabular-nums">
                    {f.num(p.total)}
                  </td>
                ))}
                <td className="text-center font-semibold tabular-nums">{f.num(r.grandTotal)}</td>
                <td className="text-center tabular-nums">{f.pct(r.percentage)}</td>
                <td className="text-center font-semibold tabular-nums">{f.int(r.rank)}</td>
                {renderAction && <td className="no-print text-end">{renderAction(r)}</td>}
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}
      <p className="text-xs text-muted-foreground">
        {t('overall.generated', {
          date: format.dateTime(new Date(), { dateStyle: 'medium', timeStyle: 'short' }),
        })}
      </p>
    </div>
  )
}
