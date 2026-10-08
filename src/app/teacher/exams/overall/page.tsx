'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Printer, Download, ArrowLeft, Award, X } from 'lucide-react'
import type { Class, Exam, Student } from '@/types'
import { computeOverall, fmt, EXAM_TYPE_LABELS, mergedSubjects } from '@/lib/examMath'
import {
  CertificateOverlay,
  buildCertificateStudent,
  type CertificateStudent,
} from '@/components/CertificateOverlay'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'

export default function OverallResultsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [yearFilter, setYearFilter] = useState('') // empty = "All Years"
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [certStudent, setCertStudent] = useState<CertificateStudent | null>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const cls = await rtdb.getAllClasses()
        const myClasses = cls.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        setClasses(myClasses)
        // Only the teacher's own classes' students + exams are fetched (server-filtered).
        const [st, ex] = await Promise.all([
          Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id))).then((lists) =>
            lists.flat(),
          ),
          Promise.all(myClasses.map((c) => rtdb.getExamsByClass(c.id))).then((lists) =>
            lists.flat(),
          ),
        ])
        setExams(ex)
        setStudents(st)
        if (!classId && myClasses.length) setClassId(myClasses[0].id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const classExams = useMemo(
    () =>
      exams
        .filter((e) => e.classId === classId && e.status === 'saved')
        .sort((a, b) =>
          a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type),
        ),
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

  const selClass = classes.find((c) => c.id === classId)

  const handleExport = () => {
    const headers = [
      'Roll',
      'Student',
      ...subjectColumns.map((c) => `${c.subject} / ${c.max}`),
      'Grand Total',
      'Percentage %',
      'Rank',
    ]
    const rows = overallRows.map((r) => [
      r.rollNumber || '',
      r.studentName,
      ...r.perSubject.map((p) => p.total),
      r.grandTotal,
      fmt(r.percentage),
      r.rank,
    ])
    exportToCsv(`overall-result-${selClass?.name || classId}-${dateStamp()}.csv`, headers, rows)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Overall Result</h1>
          <p className="text-gray-600 mt-1">
            Merged result combining all saved exams (Mid, Assignment, Final)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/teacher/exams')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Exams
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!classExams.length}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!classExams.length}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-md">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Select Class
          </CardTitle>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` • ${c.section}` : ''}
              </option>
            ))}
          </select>
          {classId && availableYears.length > 0 && (
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
          )}
          <CardDescription>
            {classExams.length
              ? `${filteredExams.length} exam(s) merged (${yearFilter || 'All years'}) · ${overallRows.length} students`
              : 'No saved exams found for this class yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!classId ? (
            <p className="text-gray-500 py-8 text-center">
              Please select a class to see the overall result.
            </p>
          ) : classExams.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">
              No saved exams for this class yet. Save results first, then return here to merge them.
            </p>
          ) : (
            <div className="no-print mb-3 text-sm text-slate-500">
              Showing overall totals. Use <b>Print</b> or <b>Download CSV</b> to save a copy.
            </div>
          )}
        </CardContent>
      </Card>

      {classExams.length > 0 && (
        <div className="print-area overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
          <div className="border-b-2 border-slate-800 p-4 pb-2">
            <h2 className="text-lg font-bold text-slate-900">Khendeq Medresah — Overall Result</h2>
            <p className="text-sm text-slate-600">
              {selClass?.name}
              {selClass?.section ? ` • Section ${selClass.section}` : ''} • {yearFilter || 'All years'} •{' '}
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
                <th className="text-center">Actions</th>
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
                  <td className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const stu = students.find((s) => s.id === r.studentId)
                        if (stu) setCertStudent(buildCertificateStudent(stu, selClass, classExams))
                      }}
                    >
                      <Award className="h-4 w-4 mr-1" /> Certificate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-500">
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      )}

      {/* ── Certificate preview modal ──────────────────────────── */}
      {certStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 no-print"
          onClick={() => setCertStudent(null)}
        >
          <div
            className="cert-print relative w-full shrink-0 rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between no-print">
              <h3 className="text-lg font-bold text-gray-900">Certificate — {certStudent.name}</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCertStudent(null)}>
                  <X className="h-4 w-4" /> Close
                </Button>
              </div>
            </div>
            <div className="w-full">
              <CertificateOverlay student={certStudent} debug={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
