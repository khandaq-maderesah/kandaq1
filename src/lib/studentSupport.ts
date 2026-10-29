import { rtdb } from '@/lib/database'
import { supportToRecord, type SupportDetails } from '@/lib/registration'

/**
 * Saves a student's help assessment from the registration form, only when it
 * differs from what was loaded (so opening and saving a student does not reset
 * the "last reviewed" date). Returns false when the save failed; the student
 * itself is already saved by then, so the caller only warns.
 */
export async function saveSupportIfChanged(
  studentId: string,
  current: SupportDetails | null,
  loaded: SupportDetails | null,
  by: { uid: string; name?: string }
): Promise<boolean> {
  // null = the saved assessment could not be loaded: leave it alone.
  if (!current) return true
  if (JSON.stringify(current) === JSON.stringify(loaded)) return true
  try {
    await rtdb.setStudentSupport(studentId, supportToRecord(current, by))
    return true
  } catch {
    return false
  }
}
