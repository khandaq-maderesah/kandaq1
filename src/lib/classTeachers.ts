/**
 * A class can have several Ustaz.
 *
 * `teacherIds` ({ [uid]: true }) is the full list. `teacherId` stays as the
 * first (lead) Ustaz so older records and screens that only know one Ustaz keep
 * working; `teacherName` holds every name, comma separated.
 */
type ClassTeacherFields = {
  teacherId?: string | null
  teacherIds?: Record<string, boolean> | null
}

/** Every Ustaz uid of the class, lead first, without duplicates. */
export function classTeacherIds(c: ClassTeacherFields): string[] {
  const ids = Object.keys(c.teacherIds ?? {}).filter((uid) => c.teacherIds?.[uid] && uid !== c.teacherId)
  // The database stores the map sorted by key, so the lead is put first explicitly.
  if (c.teacherId) ids.unshift(c.teacherId)
  return ids
}

/** True when `uid` is one of the class's Ustaz. */
export function isClassTeacher(c: ClassTeacherFields, uid: string | null | undefined): boolean {
  return !!uid && classTeacherIds(c).includes(uid)
}

/** True when the class has at least one Ustaz. */
export function hasTeacher(c: ClassTeacherFields): boolean {
  return classTeacherIds(c).length > 0
}

/**
 * The class's Ustaz after adding (`assigned`) or removing `uid`. Others keep
 * their order; any uid `nameOf` no longer knows (deleted account) is dropped.
 */
export function teachersAfterChange(
  c: ClassTeacherFields,
  uid: string,
  assigned: boolean,
  nameOf: (uid: string) => string | undefined
): Array<{ uid: string; name: string }> {
  const ids = classTeacherIds(c).filter((id) => id !== uid)
  if (assigned) ids.push(uid)
  const out: Array<{ uid: string; name: string }> = []
  for (const id of ids) {
    const name = nameOf(id)
    if (name !== undefined) out.push({ uid: id, name })
  }
  return out
}

/** The fields to write on a class for the given Ustaz (uid -> name), or nulls when empty. */
export function teacherFieldsFor(teachers: Array<{ uid: string; name: string }>): {
  teacherId: string | null
  teacherName: string | null
  teacherIds: Record<string, true> | null
} {
  if (teachers.length === 0) return { teacherId: null, teacherName: null, teacherIds: null }
  return {
    teacherId: teachers[0].uid,
    teacherName: teachers.map((t) => t.name).join(', '),
    teacherIds: Object.fromEntries(teachers.map((t) => [t.uid, true as const])),
  }
}
