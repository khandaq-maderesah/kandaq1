'use client'

import { useMemo } from 'react'
import type { Exam } from '@/types'
import { computeExam, examTotalMax, fmt, EXAM_TYPE_LABELS } from '@/lib/examMath'

/**
 * Read-only printable results sheet for a single exam.
 * Recomputes stats so it always reflects the current saved marks.
 */
export function ExamResultsSheet({ exam }: { exam: Exam }) {
  const computed = useMemo(() => computeExam(exam), [exam])
  const rows = Object.values(computed.rows).sort((a, b) =>
    (a.rollNumber || '').localeCompare(b.rollNumber || '')
  )
  const totalMax = examTotalMax(exam.subjects, exam.subjectMax)
  const summary = computed.summary

  return (
    <div className="print-area overflow-x-auto">
      <div className="mb-4 border-b-2 border-slate-800 pb-2">
        <h2 className="text-lg font-bold text-slate-900">{exam.title}</h2>
        <p className="text-sm text-slate-600">
          {EXAM_TYPE_LABELS[exam.type]} • {exam.className}
          {exam.section ? ` • Section ${exam.section}` : ''} • Total Marks: {totalMax}
        </p>
      </div>

      <table className="w-full text-sm border-collapse border border-slate-300 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5">
        <thead>
          <tr className="text-left text-slate-700">
            <th>Roll</th>
            <th>Student</th>
            {exam.subjects.map((sub) => (
              <th key={sub} title={`Max ${exam.subjectMax?.[sub] ?? 100}`}>
                {sub}
              </th>
            ))}
            <th>Total</th>
            <th>Avg</th>
            <th>%</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId}>
              <td>{r.rollNumber || '—'}</td>
              <td className="font-medium">{r.studentName}</td>
              {exam.subjects.map((sub) => (
                <td key={sub} className="text-center">{fmt(r.marks?.[sub] ?? 0, 0)}</td>
              ))}
              <td className="text-center font-semibold">{fmt(r.total)}</td>
              <td className="text-center">{fmt(r.average)}</td>
              <td className="text-center">{fmt(r.percentage)}%</td>
              <td className="text-center font-semibold">{r.rank}</td>
            </tr>
          ))}
        </tbody>
        {/* Per-subject statistics */}
        <tfoot>
          <tr className="bg-slate-50 text-xs text-slate-600">
            <td colSpan={2} className="font-semibold">Class Average</td>
            {exam.subjects.map((sub) => (
              <td key={sub} className="text-center">{fmt(summary.subjectStats?.[sub]?.average ?? 0)}</td>
            ))}
            <td className="text-center">{fmt(summary.overallAverage)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr className="bg-slate-50 text-xs text-slate-600">
            <td colSpan={2} className="font-semibold">Highest (Max)</td>
            {exam.subjects.map((sub) => (
              <td key={sub} className="text-center">{fmt(summary.subjectStats?.[sub]?.max ?? 0, 0)}</td>
            ))}
            <td className="text-center">{fmt(summary.overallMax)}</td>
            <td colSpan={3}></td>
          </tr>
          <tr className="bg-slate-50 text-xs text-slate-600">
            <td colSpan={2} className="font-semibold">Lowest (Min)</td>
            {exam.subjects.map((sub) => (
              <td key={sub} className="text-center">{fmt(summary.subjectStats?.[sub]?.min ?? 0, 0)}</td>
            ))}
            <td className="text-center">{fmt(summary.overallMin)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}