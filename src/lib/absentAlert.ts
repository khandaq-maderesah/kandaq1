import type { Attendance } from '@/types'

/**
 * Count how many consecutive days (per attendance records) a student has been
 * absent, counting backwards from the most recent record. Any non-absent record
 * (present/late) breaks the streak.
 */
export function getConsecutiveAbsentCount(records: Attendance[]): number {
  const sorted = [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let count = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === 'absent') count++
    else break
  }
  return count
}
