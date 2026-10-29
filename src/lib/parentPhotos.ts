import { rtdb } from '@/lib/database'
import { isReachable, type GuardianKey, type RegistrationDetails } from '@/lib/registration'

/**
 * The parents' optional photos while a student form is open. A missing key
 * means "not touched / not loaded yet", so it is never written (an unreadable
 * saved photo is not wiped); '' means the photo was removed.
 */
export type ParentPhotos = Partial<Record<GuardianKey, string>>

/** Saves the touched photos of parents who can be contacted. Returns false if any write failed. */
export async function saveParentPhotos(studentId: string, photos: ParentPhotos, family: RegistrationDetails): Promise<boolean> {
  let ok = true
  for (const who of ['father', 'mother'] as const) {
    const photo = photos[who]
    if (photo === undefined || !isReachable(family[who].status)) continue
    try {
      await rtdb.setParentPhoto(studentId, who, photo)
    } catch {
      ok = false
    }
  }
  return ok
}

/** Merges photos loaded from the database under anything already touched in the form. */
export function mergeLoadedParentPhotos(current: ParentPhotos, loaded: { father: string; mother: string }): ParentPhotos {
  return { father: current.father ?? loaded.father, mother: current.mother ?? loaded.mother }
}
