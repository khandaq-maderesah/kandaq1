'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, ArrowLeft, CheckCircle2 } from 'lucide-react'
import type { Exam, Student } from '@/types'
import { computeExam, examTotalMax, fmt, toNumber, EXAM_TYPE_LABELS } from '@/lib/examMath'

interface LiveRow {
  studentId: string
  studentName: string
  rollNumber?: string
  total: number
  average: number
  percentage: number
  rank: number
}

export default function MarkExamPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const ex = await rtdb.getExam(id)
        if (!ex) {
          setError('Exam not found.')
          setLoading(false)
          return
        }
        // Only this exam's class needs its students — no full-school download.
        const clsStudentsRaw = await rtdb.getStudentsByClass(ex.classId)
        const clsStudents = clsStudentsRaw.filter((s) => s.isActive)
        setStudents(clsStudents)
        setExam(ex)

        const init: Record<string, Record<string, string>> = {}
        clsStudents.forEach((st) => {
          init[st.id] = {}
          ex.subjects.forEach((sub) => {
            const row = ex.rows?.[st.id]
            const v = row?.marks?.[sub]
            init[st.id][sub] = v != null ? String(v) : ''
          })
        })
        setMarks(init)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exam')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const totalMax = exam ? examTotalMax(exam.subjects, exam.subjectMax) : 0

  const liveRows = useMemo<LiveRow[]>(() => {
    if (!exam) return []
    const arr = students.map((st) => {
      const m = marks[st.id] || {}
      let total = 0
      exam.subjects.forEach((sub) => (total += toNumber(m[sub])))
      const average = exam.subjects.length ? total / exam.subjects.length : 0
      const percentage = totalMax ? (total / totalMax) * 100 : 0
      return { studentId: st.id, studentName: st.name, rollNumber: st.rollNumber, total, average, percentage, rank: 0 }
    })
    const sorted = [...arr].sort((a, b) => b.total - a.total)
    let prevTotal: number | null = null
    let prevRank = 0
    sorted.forEach((r, i) => {
      if (prevTotal !== null && r.total === prevTotal) r.rank = prevRank
      else {
        r.rank = i + 1
        prevRank = i + 1
        prevTotal = r.total
      }
    })
    return arr.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
  }, [students, marks, exam, totalMax])

  const setMark = (studentId: string, subject: string, value: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [subject]: value },
    }))
  }

  const handleSave = async () => {
    if (!exam || !user) return
    setSaving(true)
    setError('')
    setSavedFlash('')
    try {
      const rows: Exam['rows'] = {}
      students.forEach((st) => {
        const m: Record<string, number> = {}
        exam.subjects.forEach((sub) => (m[sub] = toNumber(marks[st.id]?.[sub])))
        rows[st.id] = {
          studentId: st.id,
          studentName: st.name,
          rollNumber: st.rollNumber,
          marks: m,
          total: 0,
          average: 0,
          percentage: 0,
          rank: 0,
        }
      })
      const computed = computeExam({ ...exam, rows })
      const now = new Date().toISOString()
      await rtdb.updateExam(exam.id, { ...computed, status: 'saved', updatedAt: now })
      await rtdb.logAction({
        actorId: user.uid,
        actorName: user.name,
        action: 'save',
        entity: 'exam',
        entityId: exam.id,
        details: exam.title,
      })
      setExam({ ...computed, status: 'saved', updatedAt: now })
      setSavedFlash('Results saved successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save results')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Exam not found.'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/teacher/exams')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to exams
        </Button>
      </div>
    )
  }

  const subjectMax = (sub: string) => exam.subjectMax?.[sub] ?? 100

  const classStat = (sub: string) => {
    const vals = liveRows.map((r) => toNumber(marks[r.studentId]?.[sub]))
    const sum = vals.reduce((a, b) => a + b, 0)
    const max = vals.length ? Math.max(...vals) : 0
    return { max, average: vals.length ? sum / vals.length : 0 }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
            {exam.status === 'saved' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {EXAM_TYPE_LABELS[exam.type]} • {exam.className}
            {exam.section ? ` • Section ${exam.section}` : ''} • Total Marks: {totalMax} • {students.length} students
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/teacher/exams')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Results
          </Button>
        </div>
      </div>

      {(error || savedFlash) && (
        <Alert variant={error ? 'destructive' : 'success'}>
          <AlertDescription>{error || savedFlash}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-2 py-2 font-medium">Roll</th>
                <th className="px-2 py-2 font-medium">Student</th>
                {exam.subjects.map((sub) => (
                  <th key={sub} className="px-2 py-2 text-center font-medium">
                    {sub}
                    <div className="text-[10px] font-normal text-slate-400">/ {subjectMax(sub)}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium">Total</th>
                <th className="px-2 py-2 text-center font-medium">Avg</th>
                <th className="px-2 py-2 text-center font-medium">%</th>
                <th className="px-2 py-2 text-center font-medium">Rank</th>
              </tr>
            </thead>
            <tbody>
              {liveRows.map((r) => (
                <tr key={r.studentId} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">{r.rollNumber || '—'}</td>
                  <td className="px-2 py-1.5 font-medium text-gray-900">{r.studentName}</td>
                  {exam.subjects.map((sub) => (
                    <td key={sub} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={subjectMax(sub)}
                        step={0.5}
                        value={marks[r.studentId]?.[sub] ?? ''}
                        onChange={(e) => setMark(r.studentId, sub, e.target.value)}
                        className="h-8 w-20 mx-auto text-center"
                        aria-label={`${r.studentName} - ${sub}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-semibold">{fmt(r.total)}</td>
                  <td className="px-2 py-1.5 text-center">{fmt(r.average)}</td>
                  <td className="px-2 py-1.5 text-center">{fmt(r.percentage)}%</td>
                  <td className="px-2 py-1.5 text-center font-semibold">{r.rank}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-xs text-slate-600">
                <td colSpan={2} className="px-2 py-1 font-semibold">Class Average</td>
                {exam.subjects.map((sub) => (
                  <td key={sub} className="px-2 py-1 text-center">{fmt(classStat(sub).average)}</td>
                ))}
                <td className="px-2 py-1 text-center">{fmt(liveRows.reduce((s, r) => s + r.total, 0) / (liveRows.length || 1))}</td>
                <td colSpan={3}></td>
              </tr>
              <tr className="bg-slate-50 text-xs text-slate-600">
                <td colSpan={2} className="px-2 py-1 font-semibold">Highest</td>
                {exam.subjects.map((sub) => (
                  <td key={sub} className="px-2 py-1 text-center">{fmt(classStat(sub).max, 0)}</td>
                ))}
                <td className="px-2 py-1 text-center">{liveRows.length ? fmt(Math.max(...liveRows.map((r) => r.total))) : '—'}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}