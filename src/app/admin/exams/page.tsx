'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, Download, Printer, Award, ChevronDown, ChevronUp } from 'lucide-react'
import { ExamResultsSheet } from '@/components/ExamResultsSheet'
import type { Class, Exam, Student } from '@/types'
import { computeExam, computeOverall, fmt, EXAM_TYPE_LABELS, mergedSubjects } from '@/lib/examMath'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'

export default function AdminExamsPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [yearFilter, setYearFilter] = useState('') // empty = "All Years"
  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  const [printExamId, setPrintExamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [cls, ex] = await Promise.all([rtdb.getAllClasses(), rtdb.getAllExams()])
        setClasses(cls.filter((c) => c.isActive !== false))
        setExams(ex)
        if (!classId && cls.length) setClassId(cls[0].id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Only the selected class's students are fetched (server-filtered), instead of
  // downloading all 450+ students on page load.
  useEffect(() => {
    if (!classId) return
    let cancelled = false
    rtdb
      .getStudentsByClass(classId)
      .then((l) => {
        if (!cancelled) setStudents(l)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [classId])

  const classExams = useMemo(
    () =>
      exams
        .filter((e) => e.classId === classId && e.status === 'saved')
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [exams, classId],
  )

  // Unique academic years from the filtered exams (including "Legacy" for
  // exams without an academicYear field).
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    classExams.forEach((e) => {
      years.add(e.academicYear || 'Legacy')
    })
    return [...years].sort()
  }, [classExams])

  // Exams filtered by selected academic year.
  const filteredExams = useMemo(
    () =>
      !yearFilter
        ? classExams
        : classExams.filter((e) => (e.academicYear || 'Legacy') === yearFilter),
    [classExams, yearFilter],
  )

  const overallRows = useMemo(
    () =>
      computeOverall(
        filteredExams,
        students.filter((s) => s.classId === classId),
      ),
    [filteredExams, students, classId],
  )

  // One column per subject, aggregating marks across all saved exams.
  const subjectColumns = useMemo(() => {
    const subs = mergedSubjects(filteredExams)
    const byMax = new Map(overallRows[0]?.perSubject.map((p) => [p.subject, p.max]) ?? [])
    return subs.map((sub) => ({ subject: sub, max: byMax.get(sub) ?? 0 }))
  }, [filteredExams, overallRows])

  const handleExamExport = (exam: Exam) => {
    const computed = computeExam(exam)
    const rows = Object.values(computed.rows).sort((a, b) =>
      (a.rollNumber || '').localeCompare(b.rollNumber || ''),
    )
    exportToCsv(
      `${exam.title.replace(/\s+/g, '-')}-${dateStamp()}.csv`,
      ['Roll', 'Student', ...exam.subjects, 'Total', 'Average', 'Percentage %', 'Rank'],
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
  }

  const handleOverallExport = () => {
    const headers = [
      'Roll',
      'Student',
      ...subjectColumns.map((c) => `${c.subject} / ${c.max}`),
      'Grand Total',
      'Percentage %',
      'Rank',
    ]
    exportToCsv(
      `overall-result-${classId}-${dateStamp()}.csv`,
      headers,
      overallRows.map((r) => [
        r.rollNumber || '',
        r.studentName,
        ...r.perSubject.map((p) => p.total),
        r.grandTotal,
        fmt(r.percentage),
        r.rank,
      ]),
    )
  }

  useEffect(() => {
    if (!printExamId) return

    const handleAfterPrint = () => setPrintExamId(null)
    window.addEventListener('afterprint', handleAfterPrint)
    const printFrame = window.requestAnimationFrame(() => window.print())

    return () => {
      window.cancelAnimationFrame(printFrame)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printExamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
        <p className="text-gray-600 mt-1">
          View, download and print saved exam results of all classes
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-md">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Class
          </CardTitle>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` • ${c.section}` : ''}
              </option>
            ))}
          </select>
          <CardDescription>{classExams.length} saved exams for this class</CardDescription>
        </CardHeader>
        <CardContent>
          {classExams.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">No saved exams for this class yet.</p>
          ) : (
            <div className="space-y-2">
              {classExams.map((e) => (
                <div key={e.id} className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setActiveExamId(activeExamId === e.id ? null : e.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {activeExamId === e.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span className="font-medium text-gray-900">{e.title}</span>
                      <span className="text-xs text-slate-500">{EXAM_TYPE_LABELS[e.type]}</span>
                      <span className="text-xs text-slate-400">
                        • {Object.keys(e.rows || {}).length} students
                      </span>
                      <span className="ml-auto text-xs text-slate-500">
                        {new Date(e.updatedAt || e.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <div className="no-print flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleExamExport(e)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveExamId(e.id)
                          setPrintExamId(e.id)
                        }}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {activeExamId === e.id && (
                    <div className="border-t border-gray-100 p-3">
                      <div className={printExamId === e.id ? 'print-target' : undefined}>
                        <ExamResultsSheet exam={e} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {classId && classExams.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" /> Overall Result (Merged)
            </CardTitle>
            <CardDescription>
              Combines all saved exams for this class into one overall sheet.
            </CardDescription>
            <div className="no-print flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Academic Year:</span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" size="sm" onClick={handleOverallExport}>
                <Download className="h-4 w-4 mr-2" /> Download CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            </div>
          </CardHeader>
          <CardContent className="print-area overflow-x-auto">
            <div className="mb-3 border-b-2 border-slate-800 pb-2">
              <h2 className="text-lg font-bold text-slate-900">Khandaq Madresah — Overall Result</h2>
              <p className="text-sm text-slate-600">
                {classes.find((c) => c.id === classId)?.name || classId} • {yearFilter ? yearFilter : 'All years'} •{' '}
                {filteredExams.map((e) => EXAM_TYPE_LABELS[e.type]).join(', ')}
              </p>
            </div>
            <table className="w-full text-sm border-collapse border border-slate-300 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5">
              <thead>
                <tr className="text-left text-slate-700">
                  <th>Roll</th>
                  <th>Student</th>
                  {subjectColumns.map((c) => (
                    <th key={c.subject} className="text-center">
                      {c.subject}
                      <div className="text-[10px] font-normal text-slate-400">/ {c.max}</div>
                    </th>
                  ))}
                  <th className="text-center">Grand Total</th>
                  <th className="text-center">%</th>
                  <th className="text-center">Rank</th>
                </tr>
              </thead>
              <tbody>
                {overallRows.map((r) => (
                  <tr key={r.studentId}>
                    <td>{r.rollNumber || '—'}</td>
                    <td className="font-medium">{r.studentName}</td>
                    {r.perSubject.map((p) => (
                      <td key={p.subject} className="text-center">
                        {fmt(p.total)}
                      </td>
                    ))}
                    <td className="text-center font-semibold">{fmt(r.grandTotal)}</td>
                    <td className="text-center">{fmt(r.percentage)}%</td>
                    <td className="text-center font-semibold">{r.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
