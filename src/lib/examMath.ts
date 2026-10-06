import type { Exam, ExamRow, ExamSummary, ExamType, Student } from '@/types'

export const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'mid', label: 'Mid Exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'final', label: 'Final Exam' },
]
export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  mid: 'Mid Exam',
  assignment: 'Assignment',
  final: 'Final Exam',
}
export const DEFAULT_SUBJECTS = ['Hadith', 'Iman', 'Fiqh', 'Sirah', 'Quran']
export const DEFAULT_SUBJECT_MAX = 100

export function toNumber(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Total possible marks for an exam = sum of each subject's max marks. */
export function examTotalMax(subjects: string[], subjectMax?: Record<string, number>): number {
  return subjects.reduce((s, sub) => s + (subjectMax?.[sub] ?? DEFAULT_SUBJECT_MAX), 0)
}

export function emptySummary(subjects: string[]): ExamSummary {
  const subjectStats: ExamSummary['subjectStats'] = {}
  subjects.forEach((sub) => {
    subjectStats[sub] = { max: 0, min: 0, sum: 0, average: 0 }
  })
  return {
    subjectStats,
    overallMax: 0,
    overallMin: 0,
    overallSum: 0,
    overallAverage: 0,
  }
}

/**
 * Given an exam whose rows contain marks, computes each student's total,
 * average, percentage and rank, plus the subject-level summary. Returns a
 * new exam object with rows and summary filled in.
 */
export function computeExam(exam: Exam): Exam {
  const rows = exam.rows || {}
  const entries = Object.values(rows).map((r) => ({
    ...r,
    marks: { ...(r.marks || {}) },
  }))
  const tMax = examTotalMax(exam.subjects, exam.subjectMax)

  entries.forEach((r) => {
    let total = 0
    exam.subjects.forEach((sub) => (total += toNumber(r.marks[sub])))
    r.total = total
    r.average = exam.subjects.length ? total / exam.subjects.length : 0
    r.percentage = tMax ? (total / tMax) * 100 : 0
  })

  // Rank (competition style: equal totals share the same rank).
  const sorted = [...entries].sort((a, b) => b.total - a.total)
  let prevTotal: number | null = null
  let prevRank = 0
  sorted.forEach((r, i) => {
    if (prevTotal !== null && r.total === prevTotal) {
      r.rank = prevRank
    } else {
      r.rank = i + 1
      prevRank = i + 1
      prevTotal = r.total
    }
  })

  // Per-subject statistics.
  const subjectStats: ExamSummary['subjectStats'] = {}
  exam.subjects.forEach((sub) => {
    const vals = entries.map((e) => toNumber(e.marks[sub]))
    const sum = vals.reduce((a, b) => a + b, 0)
    subjectStats[sub] = {
      max: vals.length ? Math.max(...vals) : 0,
      min: vals.length ? Math.min(...vals) : 0,
      sum,
      average: vals.length ? sum / vals.length : 0,
    }
  })
  const totals = entries.map((e) => e.total)
  const overallSum = totals.reduce((a, b) => a + b, 0)
  const summary: ExamSummary = {
    subjectStats,
    overallMax: totals.length ? Math.max(...totals) : 0,
    overallMin: totals.length ? Math.min(...totals) : 0,
    overallSum,
    overallAverage: totals.length ? overallSum / totals.length : 0,
  }

  const newRows: Record<string, ExamRow> = {}
  entries.forEach((e) => (newRows[e.studentId] = e))

  return { ...exam, rows: newRows, summary }
}

export interface OverallSubjectColumn {
  subject: string
  total: number
  max: number
}

export interface OverallStudentRow {
  studentId: string
  studentName: string
  rollNumber?: string
  /** One column per subject (in `mergedSubjects` order). */
  perSubject: OverallSubjectColumn[]
  grandTotal: number
  grandMax: number
  percentage: number
  rank: number
}

/**
 * Union of every subject name that appears across the given exams, in
 * first-seen order. The overall result table shows one column per subject.
 */
export function mergedSubjects(exams: Exam[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  exams.forEach((ex) => {
    ;(ex.subjects || []).forEach((sub) => {
      if (!seen.has(sub)) {
        seen.add(sub)
        out.push(sub)
      }
    })
  })
  return out
}

/**
 * Merge all exams for a class into a single overall result sheet.
 *
 * Results are aggregated **per subject** across every saved exam (Mid +
 * Assignment + Final combined). A column is shown for each subject — e.g.
 * "Sirah" pools the Sirah marks from the mid exam, final exam and assignment
 * together, and is therefore out of the *sum* of that subject's max marks
 * across all exams (commonly 100). The grand total / max / percentage then
 * roll up across all the per-subject columns.
 */
export function computeOverall(exams: Exam[], students: Student[]): OverallStudentRow[] {
  const subjects = mergedSubjects(exams)

  // Max marks for each subject = sum of that subject's max across all exams.
  const subjectMaxes: Record<string, number> = {}
  exams.forEach((ex) => {
    subjects.forEach((sub) => {
      if (ex.subjects?.includes(sub)) {
        subjectMaxes[sub] = (subjectMaxes[sub] || 0) + (ex.subjectMax?.[sub] ?? DEFAULT_SUBJECT_MAX)
      }
    })
  })

  const active = students.filter((s) => s.isActive)
  const rows = active.map((s) => {
    const perSubject: OverallSubjectColumn[] = subjects.map((sub) => {
      let total = 0
      exams.forEach((ex) => {
        if (ex.subjects?.includes(sub)) {
          total += toNumber(ex.rows?.[s.id]?.marks?.[sub])
        }
      })
      return { subject: sub, total, max: subjectMaxes[sub] ?? 0 }
    })
    const grandTotal = perSubject.reduce((a, p) => a + p.total, 0)
    const grandMax = perSubject.reduce((a, p) => a + p.max, 0)
    return {
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      perSubject,
      grandTotal,
      grandMax,
      percentage: grandMax ? (grandTotal / grandMax) * 100 : 0,
      rank: 0,
    }
  })

  rows.sort((a, b) => b.grandTotal - a.grandTotal)
  let prevTotal: number | null = null
  let prevRank = 0
  rows.forEach((r, i) => {
    if (prevTotal !== null && r.grandTotal === prevTotal) {
      r.rank = prevRank
    } else {
      r.rank = i + 1
      prevRank = i + 1
      prevTotal = r.grandTotal
    }
  })
  return rows
}

export function fmt(n: number, digits = 1): string {
  return (Math.round(n * 10) / 10).toFixed(digits)
}
