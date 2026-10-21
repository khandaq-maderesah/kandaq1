'use client'

/**
 * The Ustaz's data, from the shared offline-first store (see lib/dataStore.ts).
 *
 * Every teacher screen used to fetch "my classes", "their students" and "my
 * attendance" on its own with one-shot reads that never answer offline. These
 * hooks read the same live channels everywhere, so the data is downloaded once
 * per screen, stays in memory between screens and on the device between app
 * starts. Each returns undefined only while nothing is known yet.
 */

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { useLiveData, useLiveDataMany } from '@/lib/dataStore'
import type { Attendance, Class, Exam, Student } from '@/types'

/** Every class of the current school (live). */
export function useAllClasses(): Class[] | undefined {
  const { user } = useAuth()
  return useLiveData<Class[]>(user ? 'classes' : null, (emit) => rtdb.subscribeToClasses(emit)).data
}

/** The signed-in Ustaz's active classes. */
export function useMyClasses(): Class[] | undefined {
  const { user } = useAuth()
  const all = useAllClasses()
  const uid = user?.uid
  return useMemo(() => all?.filter((c) => c.teacherId === uid && c.isActive !== false), [all, uid])
}

const studentsChannel = {
  keyFor: (classId: string) => `studentsByClass:${classId}`,
  startFor: (classId: string) => (emit: (students: Student[]) => void) =>
    rtdb.subscribeToStudentsByClass(classId, emit),
}

/** The students of the given classes (server-filtered per class, live). */
export function useStudentsOfClasses(classes: Class[] | undefined): Student[] | undefined {
  const ids = useMemo(() => classes?.map((c) => c.id) ?? null, [classes])
  const lists = useLiveDataMany<Student[]>(ids, studentsChannel)
  return useMemo(() => {
    if (!lists) return undefined
    if (lists.some((l) => l === undefined)) return undefined
    return (lists as Student[][]).flat()
  }, [lists])
}

/** The students of one class (live). */
export function useStudentsOfClass(classId: string | null | undefined): Student[] | undefined {
  return useLiveData<Student[]>(
    classId ? studentsChannel.keyFor(classId) : null,
    classId ? studentsChannel.startFor(classId) : () => () => {}
  ).data
}

/** Every attendance record marked by the signed-in Ustaz (live). */
export function useMyAttendance(): Attendance[] | undefined {
  const { user } = useAuth()
  const uid = user?.uid
  return useLiveData<Attendance[]>(uid ? `attendance:teacher:${uid}` : null, (emit) =>
    rtdb.subscribeToAttendanceByTeacher(uid || '', emit)
  ).data
}

/** Every exam of the current school (live). */
export function useExams(): Exam[] | undefined {
  const { user } = useAuth()
  return useLiveData<Exam[]>(user ? 'exams' : null, (emit) => rtdb.subscribeToExams(emit)).data
}

/** Whether student registration is open for Ustazes (live). */
export function useRegistrationOpen(): boolean | undefined {
  const { user } = useAuth()
  return useLiveData<boolean>(user ? 'settings:registrationOpen' : null, (emit) =>
    rtdb.subscribeToRegistrationOpen(emit)
  ).data
}
