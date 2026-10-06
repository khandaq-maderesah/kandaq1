import type { Student } from '@/types'

/**
 * Compute the next suggested roll number for a class.
 *
 * Uses the highest existing numeric roll number in the class + 1 and pads it to
 * three digits (001, 002, ...), falling back to the student count when no roll
 * numbers have been assigned yet.
 */
export function getNextRollNumber(
  students: Student[],
  classId: string | null | undefined
): string {
  const inClass = classId
    ? students.filter((s) => s.classId === classId)
    : students

  const nums = inClass
    .map((s) => Number.parseInt(s.rollNumber || '', 10))
    .filter((n) => !Number.isNaN(n))

  const highest = nums.length > 0 ? Math.max(...nums) : 0
  const next = Math.max(highest + 1, inClass.length + 1)

  return String(next).padStart(3, '0')
}