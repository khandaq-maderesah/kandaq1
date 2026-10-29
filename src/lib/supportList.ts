/**
 * The admin's "Family support" list: active students who are orphans (a parent
 * recorded as deceased) or whose family has been marked as needing help.
 * Pure (no React, no Firebase) so the rules can be unit tested.
 */
import { orphanKind, supportNeedsReview, type OrphanKind } from '@/lib/registration'
import type { Student, StudentSupport } from '@/types'

export interface SupportRow {
  student: Student
  orphan: OrphanKind | null
  /** null = no help assessment saved (an orphan nobody has assessed yet). */
  support: StudentSupport | null
  /** The assessment is older than the review period. */
  review: boolean
}

export type SupportFilter = 'all' | 'orphans' | 'needs' | 'urgent' | 'review'

/** Students that belong on the list, most urgent first, then by name. */
export function buildSupportRows(students: Student[], supports: StudentSupport[], now: Date = new Date()): SupportRow[] {
  const byStudent = new Map(supports.map((s) => [s.studentId, s]))
  const rows: SupportRow[] = []
  for (const student of students) {
    if (student.isActive === false) continue
    const orphan = orphanKind(student)
    const support = byStudent.get(student.id) ?? null
    if (!orphan && !support) continue
    rows.push({ student, orphan, support, review: support ? supportNeedsReview(support, now) : false })
  }
  const rank = (r: SupportRow) => (r.support?.level === 'urgent' ? 0 : r.support?.level === 'needs' ? 1 : 2)
  return rows.sort((a, b) => rank(a) - rank(b) || a.student.name.localeCompare(b.student.name))
}

export interface SupportCounts {
  orphans: number
  needs: number
  urgent: number
  review: number
}

export function countSupportRows(rows: SupportRow[]): SupportCounts {
  return {
    orphans: rows.filter((r) => r.orphan).length,
    needs: rows.filter((r) => r.support).length,
    urgent: rows.filter((r) => r.support?.level === 'urgent').length,
    review: rows.filter((r) => r.review).length,
  }
}

export function filterSupportRows(
  rows: SupportRow[],
  options: { filter: SupportFilter; kind: string; search: string }
): SupportRow[] {
  const q = options.search.trim().toLowerCase()
  return rows.filter((r) => {
    if (options.filter === 'orphans' && !r.orphan) return false
    if (options.filter === 'needs' && !r.support) return false
    if (options.filter === 'urgent' && r.support?.level !== 'urgent') return false
    if (options.filter === 'review' && !r.review) return false
    if (options.kind && !r.support?.kinds?.[options.kind]) return false
    if (!q) return true
    return (
      r.student.name.toLowerCase().includes(q) ||
      (r.student.className ?? '').toLowerCase().includes(q) ||
      (r.student.parentName ?? '').toLowerCase().includes(q) ||
      (r.student.parentPhone ?? '').includes(q)
    )
  })
}
